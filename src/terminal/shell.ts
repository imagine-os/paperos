/**
 * The project shell: a small command interpreter over a project's virtual
 * file system, in the browser, no server. It knows the usual file commands
 * (ls, cd, cat, grep, find, tree, ...), pipes and `>` / `>>` redirection,
 * and a handful of PaperOS commands that hand off to the desktop through a
 * `ShellHost` (open a file in an editor, preview a page, open a table, a
 * board, a layout, evaluate an expression against the Canvas API, a JS
 * REPL). Pure apart from the host and the fs it is given.
 */
import type { ShellEntry, ShellFs } from "./fs";
import {
  displayPath,
  globToRegExp,
  hasGlob,
  isChildOf,
  isUnder,
  nameOf,
  resolveShellPath,
} from "./paths";

export interface ShellHost {
  openFile(path: string): void | Promise<void>;
  /** Sets the preview entry (`index.html`, `pages/home.json`). */
  preview(entry: string): void | Promise<void>;
  openData(table: string): void | Promise<void>;
  openBoard(name: string): void | Promise<void>;
  layout(preset: string): void | Promise<void>;
  /** Evaluates a JavaScript expression with `paperos` in scope (`windows.list()` is prefixed). */
  api(expression: string): Promise<unknown>;
  /** Evaluates JavaScript (the `js` REPL); `paperos` is in scope. */
  evalJs(code: string): Promise<unknown>;
}

export interface ShellResult {
  /** Output lines (stderr and stdout mixed, in order). */
  lines: string[];
  error: boolean;
  /** The command asked for the screen to be cleared. */
  cleared?: boolean;
}

export interface Completion {
  /** The whole line with the last word completed (unchanged when ambiguous). */
  line: string;
  /** Every candidate for the last word (shown when more than one). */
  candidates: string[];
}

export type ShellMode = "shell" | "js";

export const LAYOUT_PRESETS = [
  "free",
  "columns",
  "grid",
  "bento-1-2",
  "bento-2-1",
  "bento-mosaic",
] as const;

interface CommandIo {
  args: string[];
  stdin: string | null;
}

interface CommandOut {
  out: string;
  err?: string;
}

type CommandFn = (io: CommandIo) => Promise<CommandOut> | CommandOut;

const HELP: Record<string, string> = {
  ls: "ls [-l] [path...]        list a directory",
  cd: "cd [path]                change directory (no path: root)",
  pwd: "pwd                      print the working directory",
  cat: "cat <file...>            print files (or stdin)",
  echo: "echo <text>              print text; `> file` writes, `>> file` appends",
  mkdir: "mkdir <dir...>           create directories",
  touch: "touch <file...>          create empty files",
  rm: "rm [-r] <path...>        remove files (-r for directories)",
  mv: "mv <from> <to>           move or rename",
  cp: "cp [-r] <from> <to>      copy",
  find: "find [path] [-name glob] [-type f|d]",
  grep: "grep [-i] [-n] <pattern> [path...]   search (directories recurse; reads stdin in a pipe)",
  head: "head [-n N] [file]       first lines (default 10)",
  tail: "tail [-n N] [file]       last lines (default 10)",
  wc: "wc [-l|-w|-c] [file...]  count lines, words, characters",
  tree: "tree [path]              the directory tree",
  clear: "clear                    clear the screen",
  help: "help [command]           this list",
  history: "history                  commands run in this terminal",
  open: "open <file>              open the file in an editor window",
  preview:
    "preview [entry]          set the Preview entry (index.html, pages/home.json, home)",
  data: "data <table>             open the table in a Data window",
  board: "board <name>             open a board (boards/<name>.json)",
  layout: `layout <preset>          apply a layout: ${LAYOUT_PRESETS.join(", ")}`,
  api: "api <expression>         evaluate against the Canvas API: api windows.list()",
  js: "js                       enter the JavaScript REPL (exit leaves it)",
  exit: "exit                     leave the JavaScript REPL",
};

export const SHELL_COMMANDS = Object.keys(HELP);

/** Splits a line into words (quotes) and the operators `|`, `>` and `>>`. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let has = false;
  const push = () => {
    if (has) tokens.push(cur);
    cur = "";
    has = false;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < line.length)
        cur += line[++i];
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (ch === "\\" && i + 1 < line.length) {
      cur += line[++i];
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      continue;
    }
    if (ch === "|") {
      push();
      tokens.push("|");
      continue;
    }
    if (ch === ">") {
      push();
      if (line[i + 1] === ">") {
        tokens.push(">>");
        i++;
      } else tokens.push(">");
      continue;
    }
    cur += ch;
    has = true;
  }
  push();
  return tokens;
}

const fmtSize = (n: string) => n.padStart(6);

export class ProjectShell {
  cwd = "";
  mode: ShellMode = "shell";
  readonly history: string[] = [];
  private readonly commands: Record<string, CommandFn>;

  constructor(
    private readonly fs: ShellFs,
    private readonly host: ShellHost
  ) {
    this.commands = {
      ls: (io) => this.ls(io),
      cd: (io) => this.cd(io),
      pwd: () => ({ out: displayPath(this.cwd) }),
      cat: (io) => this.cat(io),
      echo: (io) => ({ out: io.args.join(" ") }),
      mkdir: (io) => this.mkdir(io),
      touch: (io) => this.touch(io),
      rm: (io) => this.rm(io),
      mv: (io) => this.mv(io),
      cp: (io) => this.cp(io),
      find: (io) => this.find(io),
      grep: (io) => this.grep(io),
      head: (io) => this.headTail(io, "head"),
      tail: (io) => this.headTail(io, "tail"),
      wc: (io) => this.wc(io),
      tree: (io) => this.tree(io),
      clear: () => ({ out: "" }),
      help: (io) => this.help(io),
      history: () => ({
        out: this.history
          .map((h, i) => `${`${i + 1}`.padStart(4)}  ${h}`)
          .join("\n"),
      }),
      open: (io) => this.open(io),
      preview: (io) => this.preview(io),
      data: (io) => this.simpleHost(io, "table", (t) => this.host.openData(t)),
      board: (io) =>
        this.simpleHost(io, "board name", (b) => this.host.openBoard(b)),
      layout: (io) => this.layout(io),
      api: (io) => this.api(io),
      js: () => {
        this.mode = "js";
        return {
          out: "JavaScript REPL: `paperos` is in scope; `exit` returns to the shell.",
        };
      },
      exit: () => ({
        out: "Not in the JavaScript REPL (type `js` to enter it).",
      }),
    };
  }

  prompt(): string {
    return this.mode === "js" ? "js>" : `${displayPath(this.cwd)} $`;
  }

  // ----- running --------------------------------------------------------------

  async run(rawLine: string): Promise<ShellResult> {
    const line = rawLine.trim();
    if (!line) return { lines: [], error: false };
    this.history.push(line);

    if (this.mode === "js") {
      if (line === "exit" || line === ".exit") {
        this.mode = "shell";
        return { lines: ["Back in the project shell."], error: false };
      }
      if (line === "clear") return { lines: [], error: false, cleared: true };
      try {
        const value = await this.host.evalJs(line);
        return {
          lines: value === undefined ? [] : [render(value)],
          error: false,
        };
      } catch (e) {
        return { lines: [message(e)], error: true };
      }
    }

    const tokens = tokenize(line);
    if (tokens.length === 0) return { lines: [], error: false };
    if (tokens[0] === "clear")
      return { lines: [], error: false, cleared: true };

    // Split the pipeline; each segment may end with a redirection.
    const segments: string[][] = [[]];
    for (const t of tokens) {
      if (t === "|") segments.push([]);
      else segments[segments.length - 1].push(t);
    }
    let stdin: string | null = null;
    const lines: string[] = [];
    let error = false;
    for (const seg of segments) {
      let redirect: { mode: ">" | ">>"; target: string } | null = null;
      const words: string[] = [];
      for (let i = 0; i < seg.length; i++) {
        if (seg[i] === ">" || seg[i] === ">>") {
          const target = seg[i + 1];
          if (!target)
            return {
              lines: ["syntax error: missing file after redirection"],
              error: true,
            };
          redirect = { mode: seg[i] as ">" | ">>", target };
          i++;
        } else words.push(seg[i]);
      }
      if (words.length === 0)
        return { lines: ["syntax error: empty command"], error: true };
      const [name, ...rawArgs] = words;
      const fn = this.commands[name];
      if (!fn) {
        lines.push(`${name}: command not found (try help)`);
        return { lines, error: true };
      }
      let result: CommandOut;
      try {
        result = await fn({ args: this.expandGlobs(rawArgs), stdin });
      } catch (e) {
        result = { out: "", err: `${name}: ${message(e)}` };
      }
      if (result.err) {
        lines.push(...result.err.split("\n"));
        error = true;
      }
      if (redirect) {
        const path = this.resolve(redirect.target);
        if (this.isDir(path)) {
          lines.push(`${redirect.target}: is a directory`);
          return { lines, error: true };
        }
        const previous =
          redirect.mode === ">>" ? ((await this.fs.read(path)) ?? "") : "";
        const joiner = previous && !previous.endsWith("\n") ? "\n" : "";
        await this.fs.write(
          path,
          `${previous}${joiner}${result.out}${result.out.endsWith("\n") || !result.out ? "" : "\n"}`
        );
        stdin = "";
      } else {
        stdin = result.out;
      }
    }
    if (stdin) lines.push(...stdin.replace(/\n$/, "").split("\n"));
    return { lines, error };
  }

  // ----- completion -----------------------------------------------------------

  complete(line: string): Completion {
    if (this.mode === "js") return { line, candidates: [] };
    const m = /(^|\s)(\S*)$/.exec(line);
    const word = m ? m[2] : "";
    const start = line.length - word.length;
    const firstWord = !line.slice(0, start).trim();
    let candidates: string[];
    if (firstWord) {
      candidates = SHELL_COMMANDS.filter((c) => c.startsWith(word)).sort();
    } else {
      const command = line.trim().split(/\s+/)[0];
      if (command === "layout") {
        candidates = LAYOUT_PRESETS.filter((p) => p.startsWith(word));
      } else if (command === "board") {
        candidates = this.entries()
          .filter(
            (e) => e.type === "file" && /^boards\/[^/]+\.json$/.test(e.path)
          )
          .map((e) => nameOf(e.path).replace(/\.json$/, ""))
          .filter((n) => n.startsWith(word));
      } else if (command === "data") {
        candidates = this.entries()
          .filter(
            (e) =>
              e.type === "file" &&
              /^data\/[^/]+\.json$/.test(e.path) &&
              e.path !== "data/schema.json"
          )
          .map((e) => nameOf(e.path).replace(/\.json$/, ""))
          .filter((n) => n.startsWith(word));
      } else {
        candidates = this.completePath(word);
      }
    }
    if (candidates.length === 1) {
      const c = candidates[0];
      const suffix = firstWord || !c.endsWith("/") ? " " : "";
      return { line: line.slice(0, start) + c + suffix, candidates };
    }
    if (candidates.length > 1) {
      // Extend to the longest common prefix.
      let prefix = candidates[0];
      for (const c of candidates) {
        let i = 0;
        while (i < prefix.length && i < c.length && prefix[i] === c[i]) i++;
        prefix = prefix.slice(0, i);
      }
      if (prefix.length > word.length)
        return { line: line.slice(0, start) + prefix, candidates };
    }
    return { line, candidates };
  }

  private completePath(word: string): string[] {
    const slash = word.lastIndexOf("/");
    const dirPart = slash === -1 ? "" : word.slice(0, slash + 1);
    const base = slash === -1 ? word : word.slice(slash + 1);
    const dir = this.resolve(dirPart || ".");
    if (dirPart && !this.isDir(dir)) return [];
    return this.entries()
      .filter((e) => isChildOf(e.path, dir) && nameOf(e.path).startsWith(base))
      .map((e) => `${dirPart}${nameOf(e.path)}${e.type === "dir" ? "/" : ""}`)
      .sort();
  }

  // ----- file system helpers ------------------------------------------------------

  private entries(): ShellEntry[] {
    return this.fs.entries();
  }

  resolve(arg: string): string {
    return resolveShellPath(this.cwd, arg);
  }

  private entry(path: string): ShellEntry | undefined {
    if (path === "") return { path: "", type: "dir" };
    return this.entries().find((e) => e.path === path);
  }

  private isDir(path: string): boolean {
    return this.entry(path)?.type === "dir";
  }

  private isFile(path: string): boolean {
    return this.entry(path)?.type === "file";
  }

  private children(dir: string): ShellEntry[] {
    return this.entries()
      .filter((e) => isChildOf(e.path, dir))
      .sort((a, b) =>
        a.type === b.type
          ? a.path.localeCompare(b.path)
          : a.type === "dir"
            ? -1
            : 1
      );
  }

  private filesUnder(dir: string): string[] {
    return this.entries()
      .filter(
        (e) => e.type === "file" && (dir === "" ? true : isUnder(e.path, dir))
      )
      .map((e) => e.path)
      .sort();
  }

  private expandGlobs(args: string[]): string[] {
    const out: string[] = [];
    for (const a of args) {
      if (!hasGlob(a) || a.startsWith("-")) {
        out.push(a);
        continue;
      }
      const slash = a.lastIndexOf("/");
      const dirPart = slash === -1 ? "" : a.slice(0, slash + 1);
      const dir = this.resolve(dirPart || ".");
      const re = globToRegExp(slash === -1 ? a : a.slice(slash + 1));
      const hits = this.children(dir)
        .filter((e) => re.test(nameOf(e.path)))
        .map((e) => `${dirPart}${nameOf(e.path)}`);
      out.push(...(hits.length ? hits : [a]));
    }
    return out;
  }

  private async readFile(arg: string): Promise<string> {
    const path = this.resolve(arg);
    if (this.isDir(path)) throw new Error(`${arg}: is a directory`);
    const text = await this.fs.read(path);
    if (text === null) throw new Error(`${arg}: no such file`);
    return text;
  }

  /** Splits flags (`-rf`, `-name x` for those in `valued`) from positional arguments. */
  private flags(
    args: string[],
    valued: string[] = []
  ): { flags: Set<string>; rest: string[]; values: Record<string, string> } {
    const flags = new Set<string>();
    const rest: string[] = [];
    const values: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^-\d+$/.test(a)) {
        values.n = a.slice(1);
      } else if (a.startsWith("-") && valued.includes(a.slice(1))) {
        const v = args[i + 1];
        if (v !== undefined) {
          values[a.slice(1)] = v;
          i++;
        } else flags.add(a.slice(1));
      } else if (/^-[a-zA-Z]+$/.test(a)) {
        for (const ch of a.slice(1)) flags.add(ch);
      } else rest.push(a);
    }
    return { flags, rest, values };
  }

  // ----- commands -------------------------------------------------------------------

  private ls({ args }: CommandIo): CommandOut {
    const { flags, rest } = this.flags(args);
    const targets = rest.length ? rest : ["."];
    const blocks: string[] = [];
    let err = "";
    for (const t of targets) {
      const path = this.resolve(t);
      const e = this.entry(path);
      if (!e) {
        err += `ls: ${t}: no such file or directory\n`;
        continue;
      }
      const list = e.type === "dir" ? this.children(path) : [e];
      const rows = list.map((c) => {
        const name = e.type === "dir" ? nameOf(c.path) : t;
        return flags.has("l")
          ? `${c.type === "dir" ? "d" : "-"} ${fmtSize(c.type === "dir" ? `${this.children(c.path).length}` : this.size(c.path))}  ${name}${c.type === "dir" ? "/" : ""}`
          : `${name}${c.type === "dir" ? "/" : ""}`;
      });
      const body = flags.has("l") ? rows.join("\n") : columns(rows);
      blocks.push(targets.length > 1 ? `${t}:\n${body}` : body);
    }
    return {
      out: blocks.filter(Boolean).join("\n\n"),
      err: err.trim() || undefined,
    };
  }

  private size(path: string): string {
    const n = this.fs.size?.(path);
    return n === null || n === undefined ? "-" : `${n}`;
  }

  private cd({ args }: CommandIo): CommandOut {
    const target = args[0] ?? "/";
    const path = this.resolve(target);
    if (!this.isDir(path))
      return { out: "", err: `cd: ${target}: not a directory` };
    this.cwd = path;
    return { out: "" };
  }

  private async cat({ args, stdin }: CommandIo): Promise<CommandOut> {
    if (args.length === 0) return { out: stdin ?? "" };
    const parts: string[] = [];
    let err = "";
    for (const a of args) {
      try {
        parts.push(await this.readFile(a));
      } catch (e) {
        err += `cat: ${message(e)}\n`;
      }
    }
    return { out: parts.join(""), err: err.trim() || undefined };
  }

  private async mkdir({ args }: CommandIo): Promise<CommandOut> {
    const { rest } = this.flags(args);
    if (rest.length === 0) return { out: "", err: "mkdir: missing directory" };
    for (const a of rest) {
      const path = this.resolve(a);
      if (this.isFile(path))
        return { out: "", err: `mkdir: ${a}: a file exists there` };
      if (!this.isDir(path)) await this.fs.mkdir(path);
    }
    return { out: "" };
  }

  private async touch({ args }: CommandIo): Promise<CommandOut> {
    if (args.length === 0) return { out: "", err: "touch: missing file" };
    for (const a of args) {
      const path = this.resolve(a);
      if (this.isDir(path))
        return { out: "", err: `touch: ${a}: is a directory` };
      if (!this.isFile(path)) await this.fs.write(path, "");
    }
    return { out: "" };
  }

  private async rm({ args }: CommandIo): Promise<CommandOut> {
    const { flags, rest } = this.flags(args);
    if (rest.length === 0) return { out: "", err: "rm: missing path" };
    let err = "";
    for (const a of rest) {
      const path = this.resolve(a);
      if (!path) {
        err += "rm: refusing to remove the project root\n";
        continue;
      }
      const e = this.entry(path);
      if (!e) err += `rm: ${a}: no such file or directory\n`;
      else if (e.type === "dir" && !flags.has("r"))
        err += `rm: ${a}: is a directory (use rm -r)\n`;
      else await this.fs.remove(path);
    }
    return { out: "", err: err.trim() || undefined };
  }

  private destination(from: string, toArg: string): string {
    const to = this.resolve(toArg);
    return this.isDir(to) ? `${to}/${nameOf(from)}` : to;
  }

  private async mv({ args }: CommandIo): Promise<CommandOut> {
    if (args.length !== 2) return { out: "", err: "mv: usage: mv <from> <to>" };
    const from = this.resolve(args[0]);
    if (!this.entry(from) || !from)
      return { out: "", err: `mv: ${args[0]}: no such file or directory` };
    const to = this.destination(from, args[1]);
    if (to === from) return { out: "" };
    if (this.entry(to))
      return { out: "", err: `mv: ${args[1]}: already exists` };
    await this.fs.rename(from, to);
    return { out: "" };
  }

  private async cp({ args }: CommandIo): Promise<CommandOut> {
    const { flags, rest } = this.flags(args);
    if (rest.length !== 2)
      return { out: "", err: "cp: usage: cp [-r] <from> <to>" };
    const from = this.resolve(rest[0]);
    const e = this.entry(from);
    if (!e)
      return { out: "", err: `cp: ${rest[0]}: no such file or directory` };
    const to = this.destination(from, rest[1]);
    if (e.type === "dir") {
      if (!flags.has("r"))
        return { out: "", err: `cp: ${rest[0]}: is a directory (use cp -r)` };
      if (to === from || isUnder(to, from))
        return { out: "", err: "cp: cannot copy a directory into itself" };
      await this.fs.mkdir(to);
      for (const f of this.filesUnder(from)) {
        const text = (await this.fs.read(f)) ?? "";
        await this.fs.write(to + f.slice(from.length), text);
      }
      return { out: "" };
    }
    const text = (await this.fs.read(from)) ?? "";
    await this.fs.write(to, text);
    return { out: "" };
  }

  private find({ args }: CommandIo): CommandOut {
    const { rest, values } = this.flags(args, ["name", "type"]);
    const dir = this.resolve(rest[0] ?? ".");
    if (!this.isDir(dir))
      return { out: "", err: `find: ${rest[0]}: not a directory` };
    const re = values.name ? globToRegExp(values.name) : null;
    const type = values.type;
    const hits = this.entries()
      .filter((e) => (dir === "" ? e.path !== "" : isUnder(e.path, dir)))
      .filter(
        (e) => !type || (type === "d" ? e.type === "dir" : e.type === "file")
      )
      .filter((e) => !re || re.test(nameOf(e.path)))
      .map((e) => displayPath(e.path))
      .sort();
    return { out: hits.join("\n") };
  }

  private async grep({ args, stdin }: CommandIo): Promise<CommandOut> {
    const { flags, rest } = this.flags(args);
    if (rest.length === 0)
      return {
        out: "",
        err: "grep: usage: grep [-i] [-n] <pattern> [path...]",
      };
    const [pattern, ...paths] = rest;
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags.has("i") ? "i" : "");
    } catch {
      re = new RegExp(
        pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        flags.has("i") ? "i" : ""
      );
    }
    const scan = (text: string, label: string | null) =>
      text
        .split("\n")
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => re.test(l))
        .map(
          ({ l, i }) =>
            `${label !== null ? `${label}:` : ""}${flags.has("n") ? `${i + 1}:` : ""}${l}`
        );
    if (paths.length === 0 && stdin !== null)
      return { out: scan(stdin, null).join("\n") };
    const files: { arg: string; path: string }[] = [];
    let err = "";
    for (const p of paths.length ? paths : ["."]) {
      const path = this.resolve(p);
      const e = this.entry(path);
      if (!e) err += `grep: ${p}: no such file or directory\n`;
      else if (e.type === "dir")
        files.push(...this.filesUnder(path).map((f) => ({ arg: f, path: f })));
      else files.push({ arg: p, path });
    }
    const labeled =
      files.length > 1 ||
      paths.length === 0 ||
      this.isDir(this.resolve(paths[0]));
    const out: string[] = [];
    for (const f of files) {
      const text = await this.fs.read(f.path);
      if (text === null) continue;
      out.push(...scan(text, labeled ? f.arg : null));
    }
    return { out: out.join("\n"), err: err.trim() || undefined };
  }

  private async headTail(
    { args, stdin }: CommandIo,
    which: "head" | "tail"
  ): Promise<CommandOut> {
    const { rest, values } = this.flags(args, ["n"]);
    const n = Math.max(0, Number(values.n ?? 10) || 10);
    let text: string;
    if (rest.length === 0) {
      if (stdin === null) return { out: "", err: `${which}: missing file` };
      text = stdin;
    } else text = await this.readFile(rest[0]);
    const lines = text.replace(/\n$/, "").split("\n");
    const picked =
      which === "head"
        ? lines.slice(0, n)
        : lines.slice(Math.max(0, lines.length - n));
    return { out: picked.join("\n") };
  }

  private async wc({ args, stdin }: CommandIo): Promise<CommandOut> {
    const { flags, rest } = this.flags(args);
    const count = (text: string, label: string) => {
      const l = text
        ? text.split("\n").length - (text.endsWith("\n") ? 1 : 0)
        : 0;
      const w = text.trim() ? text.trim().split(/\s+/).length : 0;
      const c = text.length;
      const cols = flags.size
        ? [
            flags.has("l") ? l : null,
            flags.has("w") ? w : null,
            flags.has("c") ? c : null,
          ].filter((v) => v !== null)
        : [l, w, c];
      return `${cols.map((v) => `${v}`.padStart(6)).join("")}${label ? ` ${label}` : ""}`;
    };
    if (rest.length === 0) return { out: count(stdin ?? "", "") };
    const out: string[] = [];
    for (const a of rest) out.push(count(await this.readFile(a), a));
    return { out: out.join("\n") };
  }

  private tree({ args }: CommandIo): CommandOut {
    const dir = this.resolve(args[0] ?? ".");
    if (!this.isDir(dir))
      return { out: "", err: `tree: ${args[0]}: not a directory` };
    const lines = [displayPath(dir)];
    let dirs = 0;
    let files = 0;
    const walk = (d: string, prefix: string) => {
      const kids = this.children(d);
      kids.forEach((k, i) => {
        const last = i === kids.length - 1;
        lines.push(
          `${prefix}${last ? "└── " : "├── "}${nameOf(k.path)}${k.type === "dir" ? "/" : ""}`
        );
        if (k.type === "dir") {
          dirs++;
          walk(k.path, `${prefix}${last ? "    " : "│   "}`);
        } else files++;
      });
    };
    walk(dir, "");
    lines.push("", `${dirs} directories, ${files} files`);
    return { out: lines.join("\n") };
  }

  private help({ args }: CommandIo): CommandOut {
    if (args[0]) {
      const h = HELP[args[0]];
      return h
        ? { out: h }
        : { out: "", err: `help: no such command "${args[0]}"` };
    }
    return {
      out: [
        "Project shell: commands run against the project's files in this browser tab.",
        "Pipes (|) and redirection (>, >>) work; Tab completes commands and paths.",
        "",
        ...Object.values(HELP),
      ].join("\n"),
    };
  }

  private async open({ args }: CommandIo): Promise<CommandOut> {
    if (!args[0]) return { out: "", err: "open: usage: open <file>" };
    const path = this.resolve(args[0]);
    if (!this.isFile(path))
      return { out: "", err: `open: ${args[0]}: no such file` };
    await this.host.openFile(path);
    return { out: `Opened ${displayPath(path)} in an editor.` };
  }

  private async preview({ args }: CommandIo): Promise<CommandOut> {
    let entry = args[0] ?? "index.html";
    let path = this.resolve(entry);
    if (
      !this.isFile(path) &&
      !/[./]/.test(entry) &&
      this.isFile(`pages/${entry}.json`)
    ) {
      path = `pages/${entry}.json`;
    }
    if (!this.isFile(path))
      return { out: "", err: `preview: ${entry}: no such file` };
    entry = path;
    await this.host.preview(entry);
    return { out: `Preview entry set to ${displayPath(entry)}.` };
  }

  private async simpleHost(
    { args }: CommandIo,
    what: string,
    fn: (value: string) => void | Promise<void>
  ): Promise<CommandOut> {
    if (!args[0]) return { out: "", err: `missing ${what}` };
    await fn(args[0]);
    return { out: "" };
  }

  private async layout({ args }: CommandIo): Promise<CommandOut> {
    const preset = args[0];
    if (!preset || !(LAYOUT_PRESETS as readonly string[]).includes(preset))
      return {
        out: "",
        err: `layout: usage: layout <${LAYOUT_PRESETS.join("|")}>`,
      };
    await this.host.layout(preset);
    return { out: `Layout: ${preset}` };
  }

  private async api({ args }: CommandIo): Promise<CommandOut> {
    const expression = args.join(" ");
    if (!expression)
      return {
        out: "",
        err: "api: usage: api <expression>, e.g. api windows.list()",
      };
    const value = await this.host.api(expression);
    return { out: value === undefined ? "" : render(value) };
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function render(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    const text = JSON.stringify(value, null, 2);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

/** Lays names out in columns like `ls` (80 columns). */
export function columns(names: string[], width = 80): string {
  if (names.length === 0) return "";
  const colWidth = Math.max(...names.map((n) => n.length)) + 2;
  const perRow = Math.max(1, Math.floor(width / colWidth));
  if (perRow >= names.length) return names.join("  ");
  const rows: string[] = [];
  const rowCount = Math.ceil(names.length / perRow);
  for (let r = 0; r < rowCount; r++) {
    const row: string[] = [];
    for (let c = 0; c < perRow; c++) {
      const name = names[c * rowCount + r];
      if (name !== undefined) row.push(name.padEnd(colWidth));
    }
    rows.push(row.join("").trimEnd());
  }
  return rows.join("\n");
}
