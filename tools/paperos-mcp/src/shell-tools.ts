/**
 * `shell.*`: a real shell on the user's machine for the Terminal window's
 * "Bridge shell" backend. Tab-only (not offered to the agent over MCP): the
 * agent has its own shell, and the person opts in from the Terminal window.
 * node-pty is optional; without it the shell runs on pipes in line mode
 * (no prompt echo, no colors, no interactive programs). Output streams to
 * the tab as `stream` messages on channel `shell:<id>`.
 *
 * Set PAPEROS_BRIDGE_NO_SHELL=1 to refuse every spawn.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { homedir, platform } from "node:os";
import { num, str, type LocalTool, type LocalToolContext } from "./local-tools.js";

interface PtyLike {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(cb: (data: string) => void): unknown;
  onExit(cb: (e: { exitCode: number }) => void): unknown;
}

interface NodePtyLike {
  spawn(
    file: string,
    args: string[],
    options: { name: string; cols: number; rows: number; cwd: string; env: NodeJS.ProcessEnv }
  ): PtyLike;
}

interface Session {
  id: string;
  backend: "pty" | "pipe";
  shell: string;
  cwd: string;
  alive: boolean;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

let nodePty: NodePtyLike | null | undefined;

async function loadNodePty(): Promise<NodePtyLike | null> {
  if (nodePty !== undefined) return nodePty;
  try {
    const name = "node-pty";
    nodePty = (await import(name)) as NodePtyLike;
  } catch {
    nodePty = null;
  }
  return nodePty;
}

/** For tests: pretend node-pty is (un)available. */
export function setNodePtyForTests(mod: NodePtyLike | null | undefined): void {
  nodePty = mod;
}

export function defaultShell(): string {
  if (platform() === "win32") return process.env.COMSPEC || "powershell.exe";
  return process.env.SHELL || "/bin/sh";
}

export const SHELL_DISABLED_MESSAGE =
  "The bridge shell is disabled on this machine (PAPEROS_BRIDGE_NO_SHELL is set).";

const sessions = new Map<string, Session>();
let counter = 0;

export function shellSessions(): Session[] {
  return [...sessions.values()];
}

export function killAllShells(): void {
  for (const s of sessions.values()) if (s.alive) s.kill();
  sessions.clear();
}

async function spawnShell(args: Record<string, unknown>, ctx: LocalToolContext): Promise<unknown> {
  if (process.env.PAPEROS_BRIDGE_NO_SHELL === "1") throw new Error(SHELL_DISABLED_MESSAGE);
  const cols = Math.min(500, Math.max(20, Math.trunc(num(args, "cols", 100))));
  const rows = Math.min(200, Math.max(5, Math.trunc(num(args, "rows", 30))));
  const cwd = str(args, "cwd", false) || process.env.PAPEROS_SHELL_CWD || process.cwd() || homedir();
  const shell = defaultShell();
  counter += 1;
  const id = `s${counter}`;
  const channel = `shell:${id}`;
  const push = (event: string, data?: unknown) => ctx.push({ type: "stream", channel, event, data });

  const pty = await loadNodePty();
  let session: Session;
  if (pty) {
    const p = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: { ...process.env, TERM: "xterm-256color", PAPEROS: "1" },
    });
    session = {
      id,
      backend: "pty",
      shell,
      cwd,
      alive: true,
      write: (d) => p.write(d),
      resize: (c, r) => p.resize(c, r),
      kill: () => p.kill(),
    };
    p.onData((data) => push("data", data));
    p.onExit(({ exitCode }) => {
      session.alive = false;
      push("exit", { code: exitCode });
      sessions.delete(id);
    });
  } else {
    const child: ChildProcess = spawn(shell, [], {
      cwd,
      env: { ...process.env, TERM: "dumb", PAPEROS: "1", PS1: "$ " },
      stdio: ["pipe", "pipe", "pipe"],
    });
    session = {
      id,
      backend: "pipe",
      shell,
      cwd,
      alive: true,
      write: (d) => void child.stdin?.write(d),
      resize: () => {},
      kill: () => void child.kill(),
    };
    child.stdout?.on("data", (b: Buffer) => push("data", b.toString()));
    child.stderr?.on("data", (b: Buffer) => push("data", b.toString()));
    child.on("error", (e) => push("data", `\n[shell error: ${e.message}]\n`));
    child.on("exit", (code) => {
      session.alive = false;
      push("exit", { code: code ?? 0 });
      sessions.delete(id);
    });
  }
  sessions.set(id, session);
  ctx.log(`shell ${id} started (${session.backend}, ${shell}, ${cwd})`);
  return { id, backend: session.backend, shell, cwd, platform: platform(), channel };
}

function session(args: Record<string, unknown>): Session {
  const id = str(args, "id");
  const s = sessions.get(id);
  if (!s) throw new Error(`No shell session "${id}" (it may have exited)`);
  return s;
}

export const SHELL_TOOLS: LocalTool[] = [
  {
    name: "shell.spawn",
    description: "Starts a shell on this machine for the Terminal window (node-pty when installed, pipes otherwise).",
    tabOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        cols: { type: "number" },
        rows: { type: "number" },
        cwd: { type: "string", description: "Working directory (default: where the CLI runs)" },
      },
    },
    run: spawnShell,
  },
  {
    name: "shell.write",
    description: "Sends keystrokes or a line to a shell session.",
    tabOnly: true,
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "string" } }, required: ["id", "data"] },
    async run(args) {
      const s = session(args);
      const data = args.data;
      if (typeof data !== "string") throw new Error("data must be a string");
      s.write(data);
      return { ok: true };
    },
  },
  {
    name: "shell.resize",
    description: "Resizes a pty session.",
    tabOnly: true,
    inputSchema: { type: "object", properties: { id: { type: "string" }, cols: { type: "number" }, rows: { type: "number" } }, required: ["id"] },
    async run(args) {
      const s = session(args);
      s.resize(Math.max(20, Math.trunc(num(args, "cols", 100))), Math.max(5, Math.trunc(num(args, "rows", 30))));
      return { ok: true };
    },
  },
  {
    name: "shell.kill",
    description: "Ends a shell session.",
    tabOnly: true,
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    async run(args) {
      const s = sessions.get(str(args, "id"));
      if (s?.alive) s.kill();
      if (s) sessions.delete(s.id);
      return { ok: true, killed: !!s };
    },
  },
  {
    name: "shell.list",
    description: "The shell sessions this CLI is running.",
    tabOnly: true,
    readOnly: true,
    inputSchema: { type: "object", properties: {} },
    async run() {
      return shellSessions().map((s) => ({ id: s.id, backend: s.backend, shell: s.shell, cwd: s.cwd, alive: s.alive }));
    },
  },
];
