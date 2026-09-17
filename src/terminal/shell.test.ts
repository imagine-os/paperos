import { describe, expect, it } from "vitest";
import { memoryShellFs } from "./fs";
import {
  displayPath,
  globToRegExp,
  isChildOf,
  isUnder,
  resolveShellPath,
} from "./paths";
import { columns, ProjectShell, tokenize, type ShellHost } from "./shell";

function setup() {
  const fs = memoryShellFs({
    "index.html": "<h1>Hello</h1>\n<p>World</p>\n",
    "app.js": "console.log('hi');\nconst x = 1;\n",
    "styles.css": "body { color: red }\n",
    "README.md": "# Readme\n\nA sample.\n",
    "pages/home.json": '{"name":"home"}',
    "pages/admin.json": '{"name":"admin"}',
    "data/schema.json": "{}",
    "data/users.json": "[]",
    "boards/ship-feature.json": "{}",
    "src/lib/util.js": "export const util = 1;\n",
  });
  const calls: string[] = [];
  const host: ShellHost = {
    openFile: (p) => void calls.push(`open:${p}`),
    preview: (p) => void calls.push(`preview:${p}`),
    openData: (t) => void calls.push(`data:${t}`),
    openBoard: (b) => void calls.push(`board:${b}`),
    layout: (p) => void calls.push(`layout:${p}`),
    api: async (e) => {
      calls.push(`api:${e}`);
      if (e.startsWith("boom")) throw new Error("nope");
      return { expression: e };
    },
    evalJs: async (code) => {
      calls.push(`js:${code}`);
      if (code === "throw") throw new Error("bad js");
      return code === "undefined" ? undefined : `result of ${code}`;
    },
  };
  const shell = new ProjectShell(fs, host);
  const run = async (line: string) => {
    const r = await shell.run(line);
    return r.lines.join("\n");
  };
  return { fs, host, calls, shell, run };
}

describe("paths", () => {
  it("resolves against the cwd and normalizes", () => {
    expect(resolveShellPath("", "src")).toBe("src");
    expect(resolveShellPath("src", "../pages/./home.json")).toBe(
      "pages/home.json"
    );
    expect(resolveShellPath("src/lib", "/index.html")).toBe("index.html");
    expect(resolveShellPath("src", "../../..")).toBe("");
    expect(displayPath("")).toBe("/");
    expect(isChildOf("src/lib", "src")).toBe(true);
    expect(isChildOf("src/lib/x", "src")).toBe(false);
    expect(isUnder("src/lib/x", "src")).toBe(true);
    expect(isUnder("x", "")).toBe(true);
    expect(globToRegExp("*.js").test("app.js")).toBe(true);
    expect(globToRegExp("*.js").test("src/app.js")).toBe(false);
    expect(globToRegExp("a?c.txt").test("abc.txt")).toBe(true);
  });
});

describe("tokenize", () => {
  it("handles quotes, escapes and operators", () => {
    expect(tokenize(`echo "hello world" 'a b' c\\ d`)).toEqual([
      "echo",
      "hello world",
      "a b",
      "c d",
    ]);
    expect(tokenize("cat a.txt|grep x>>out.txt")).toEqual([
      "cat",
      "a.txt",
      "|",
      "grep",
      "x",
      ">>",
      "out.txt",
    ]);
    expect(tokenize('echo "" > empty')).toEqual(["echo", "", ">", "empty"]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("project shell", () => {
  it("ls, cd, pwd and tree", async () => {
    const { shell, run } = setup();
    expect(shell.prompt()).toBe("/ $");
    expect((await run("ls")).split(/\s+/).sort()).toEqual([
      "README.md",
      "app.js",
      "boards/",
      "data/",
      "index.html",
      "pages/",
      "src/",
      "styles.css",
    ]);
    expect(await run("ls -l pages")).toContain("-     15  home.json");
    expect(await run("ls nope")).toBe("ls: nope: no such file or directory");
    expect(await run("cd src/lib")).toBe("");
    expect(await run("pwd")).toBe("/src/lib");
    expect(shell.prompt()).toBe("/src/lib $");
    expect(await run("cd ..")).toBe("");
    expect(await run("ls")).toBe("lib/");
    expect(await run("cd app.js")).toBe("cd: app.js: not a directory");
    expect(await run("cd")).toBe("");
    expect(await run("tree src")).toBe(
      [
        "/src",
        "└── lib/",
        "    └── util.js",
        "",
        "1 directories, 1 files",
      ].join("\n")
    );
    expect((await run("tree")).split("\n").at(-1)).toBe(
      "5 directories, 10 files"
    );
  });

  it("cat, head, tail, wc, grep, find and pipes", async () => {
    const { run } = setup();
    expect(await run("cat README.md")).toBe("# Readme\n\nA sample.");
    expect(await run("cat missing.txt")).toBe("cat: missing.txt: no such file");
    expect(await run("head -n 1 index.html")).toBe("<h1>Hello</h1>");
    expect(await run("tail -1 index.html")).toBe("<p>World</p>");
    expect(await run("wc app.js")).toBe("     2     5    32 app.js");
    expect(await run("wc -l app.js")).toBe("     2 app.js");
    expect(await run("grep -n const app.js")).toBe("2:const x = 1;");
    expect(await run("grep -i HELLO .")).toBe("index.html:<h1>Hello</h1>");
    expect(await run("grep name pages")).toBe(
      'pages/admin.json:{"name":"admin"}\npages/home.json:{"name":"home"}'
    );
    expect(await run("cat app.js | grep x | wc -l")).toBe("     1");
    expect(await run("find pages -name '*.json'")).toBe(
      "/pages/admin.json\n/pages/home.json"
    );
    expect(await run("find . -type d")).toBe(
      "/boards\n/data\n/pages\n/src\n/src/lib"
    );
    expect(await run("ls *.js")).toBe("app.js");
    expect(await run("cat pages/*.json | wc -l")).toBe("     1");
  });

  it("creates, writes, moves, copies and removes files", async () => {
    const { fs, run } = setup();
    expect(await run("mkdir notes/ideas")).toBe("");
    expect(await run("touch notes/ideas/a.txt")).toBe("");
    expect(await run("echo hello > notes/hi.txt")).toBe("");
    expect(await run("echo again >> notes/hi.txt")).toBe("");
    expect(await run("cat notes/hi.txt")).toBe("hello\nagain");
    expect(await run("cat README.md | head -n 1 > notes/title.md")).toBe("");
    expect(fs.files.get("notes/title.md")).toBe("# Readme\n");
    expect(await run("mv notes/hi.txt notes/ideas")).toBe("");
    expect(await run("ls notes/ideas")).toBe("a.txt  hi.txt");
    expect(await run("cp notes/ideas/hi.txt copy.txt")).toBe("");
    expect(fs.files.get("copy.txt")).toBe("hello\nagain\n");
    expect(await run("cp notes backup")).toContain("use cp -r");
    expect(await run("cp -r notes backup")).toBe("");
    expect(fs.files.get("backup/ideas/hi.txt")).toBe("hello\nagain\n");
    expect(await run("rm notes")).toBe("rm: notes: is a directory (use rm -r)");
    expect(await run("rm -r notes backup copy.txt")).toBe("");
    expect(await run("ls")).not.toContain("notes");
    expect(await run("rm /")).toBe("rm: refusing to remove the project root");
    expect(await run("echo x > pages")).toBe("pages: is a directory");
    expect(await run("mv app.js index.html")).toBe(
      "mv: index.html: already exists"
    );
  });

  it("hands PaperOS commands to the host", async () => {
    const { calls, run } = setup();
    expect(await run("open index.html")).toBe(
      "Opened /index.html in an editor."
    );
    expect(await run("open nope.js")).toBe("open: nope.js: no such file");
    expect(await run("preview")).toBe("Preview entry set to /index.html.");
    expect(await run("preview home")).toBe(
      "Preview entry set to /pages/home.json."
    );
    expect(await run("preview nothing")).toBe("preview: nothing: no such file");
    expect(await run("data users")).toBe("");
    expect(await run("data")).toBe("missing table");
    expect(await run("board ship-feature")).toBe("");
    expect(await run("layout grid")).toBe("Layout: grid");
    expect(await run("layout weird")).toContain("layout: usage");
    expect(await run("api windows.list()")).toBe(
      JSON.stringify({ expression: "windows.list()" }, null, 2)
    );
    expect(await run("api boom()")).toBe("api: nope");
    expect(calls).toEqual([
      "open:index.html",
      "preview:index.html",
      "preview:pages/home.json",
      "data:users",
      "board:ship-feature",
      "layout:grid",
      "api:windows.list()",
      "api:boom()",
    ]);
  });

  it("has a JavaScript REPL mode", async () => {
    const { shell, run } = setup();
    expect(await run("js")).toContain("JavaScript REPL");
    expect(shell.mode).toBe("js");
    expect(shell.prompt()).toBe("js>");
    expect(await run("1 + 1")).toBe("result of 1 + 1");
    expect(await run("undefined")).toBe("");
    expect(await run("throw")).toBe("bad js");
    expect((await shell.run("clear")).cleared).toBe(true);
    expect(await run("exit")).toBe("Back in the project shell.");
    expect(shell.mode).toBe("shell");
    expect(await run("exit")).toContain("Not in the JavaScript REPL");
  });

  it("reports unknown commands, clear, help and history", async () => {
    const { shell, run } = setup();
    const r = await shell.run("frobnicate now");
    expect(r.error).toBe(true);
    expect(r.lines[0]).toBe("frobnicate: command not found (try help)");
    expect((await shell.run("clear")).cleared).toBe(true);
    expect((await shell.run("   ")).lines).toEqual([]);
    expect(await run("help")).toContain("grep [-i] [-n]");
    expect(await run("help tree")).toBe(
      "tree [path]              the directory tree"
    );
    expect(await run("help zzz")).toContain("no such command");
    expect(await run("history")).toContain("   1  frobnicate now");
    expect(await run("echo >")).toBe(
      "syntax error: missing file after redirection"
    );
  });

  it("completes commands, paths, presets, boards and tables", async () => {
    const { shell } = setup();
    expect(shell.complete("gr")).toEqual({
      line: "grep ",
      candidates: ["grep"],
    });
    expect(shell.complete("c").candidates).toEqual([
      "cat",
      "cd",
      "clear",
      "cp",
    ]);
    expect(shell.complete("cat pa")).toEqual({
      line: "cat pages/",
      candidates: ["pages/"],
    });
    expect(shell.complete("cat pages/")).toEqual({
      line: "cat pages/",
      candidates: ["pages/admin.json", "pages/home.json"],
    });
    expect(shell.complete("cat pages/h")).toEqual({
      line: "cat pages/home.json ",
      candidates: ["pages/home.json"],
    });
    expect(shell.complete("cat pages/x")).toEqual({
      line: "cat pages/x",
      candidates: [],
    });
    expect(shell.complete("cat s").line).toBe("cat s");
    expect(shell.complete("cat s").candidates).toEqual(["src/", "styles.css"]);
    expect(shell.complete("layout ben").line).toBe("layout bento-");
    expect(shell.complete("board sh")).toEqual({
      line: "board ship-feature ",
      candidates: ["ship-feature"],
    });
    expect(shell.complete("data ").candidates).toEqual(["users"]);
    shell.mode = "js";
    expect(shell.complete("pap")).toEqual({ line: "pap", candidates: [] });
  });

  it("lays names out in columns", () => {
    expect(columns([])).toBe("");
    expect(columns(["a", "b"])).toBe("a  b");
    const many = Array.from({ length: 30 }, (_, i) => `file-${i}.txt`);
    const out = columns(many, 40);
    expect(out.split("\n").length).toBeGreaterThan(5);
    expect(out).toContain("file-0.txt");
  });
});
