/**
 * One Terminal window's state, independent of React so the Canvas API can
 * drive it: a scrollback of lines, a backend switch (project shell in the
 * tab, or a real shell on the user's machine through the agent bridge) and
 * output listeners. The bridge is injected as a small interface so the
 * session is unit tested without a socket.
 */
import { signal, type Signal } from "@/ide/signal";
import type { StreamMessage } from "@/api/bridge-protocol";
import { appendStream } from "./ansi";
import type { Completion, ProjectShell } from "./shell";

export type TerminalBackend = "project" | "bridge";
export type LineKind = "input" | "output" | "error" | "system";

export interface TermLine {
  id: number;
  kind: LineKind;
  text: string;
}

/** What a Terminal window keeps in its `content` prop. */
export interface TerminalContent {
  backend?: TerminalBackend;
  /** Commands to run once when the window first opens (boards use this). */
  run?: string[];
}

export function parseTerminalContent(content: string): TerminalContent {
  if (!content) return {};
  try {
    const raw = JSON.parse(content) as TerminalContent;
    if (typeof raw !== "object" || raw === null) return {};
    return {
      backend: raw.backend === "bridge" ? "bridge" : "project",
      run: Array.isArray(raw.run)
        ? raw.run.filter((r): r is string => typeof r === "string")
        : undefined,
    };
  } catch {
    return {};
  }
}

export interface BridgeShellInfo {
  id: string;
  backend: "pty" | "pipe";
  shell: string;
  cwd: string;
}

/** The part of the BridgeClient the session needs. */
export interface BridgeShellApi {
  status: Signal<"off" | "waiting" | "connected">;
  request(tool: string, args?: Record<string, unknown>): Promise<unknown>;
  onStream(channel: string, handler: (m: StreamMessage) => void): () => void;
}

export const MAX_LINES = 2000;
export const BRIDGE_RUN_SETTLE_MS = 600;

let lineCounter = 0;

export class TerminalSession {
  readonly lines = signal<TermLine[]>([]);
  readonly backend = signal<TerminalBackend>("project");
  readonly bridgeShell = signal<BridgeShellInfo | null>(null);
  readonly busy = signal(false);
  /** Bumped when the prompt may have changed (cwd, mode, backend). */
  readonly promptTick = signal(0);
  readonly history: string[] = [];
  private listeners = new Set<(text: string, kind: LineKind) => void>();
  private offStream: (() => void) | null = null;
  private disposed = false;
  private ranInitial = false;

  constructor(
    readonly id: string,
    readonly shell: ProjectShell,
    readonly bridge: BridgeShellApi | null,
    readonly projectName: string | null
  ) {
    this.system(
      projectName
        ? `Project shell over "${projectName}". Type help for the commands; Tab completes.`
        : "No project is open: the project shell has no files. Open a project, or use the bridge shell."
    );
  }

  prompt(): string {
    if (this.backend.get() === "bridge") {
      const s = this.bridgeShell.get();
      return s ? (s.backend === "pty" ? "" : "$") : "bridge>";
    }
    return this.shell.prompt();
  }

  /** Runs the window's initial commands once (boards pass them in `content`). */
  async runInitial(commands: string[] | undefined): Promise<void> {
    if (this.ranInitial || !commands?.length) return;
    this.ranInitial = true;
    for (const c of commands) await this.run(c);
  }

  // ----- lines ----------------------------------------------------------------------

  private push(kind: LineKind, text: string) {
    const rows = text
      .split("\n")
      .map((t) => ({ id: ++lineCounter, kind, text: t }));
    this.lines.update((list) => {
      const next = [...list, ...rows];
      return next.length > MAX_LINES
        ? next.slice(next.length - MAX_LINES)
        : next;
    });
    if (kind !== "input") this.listeners.forEach((l) => l(text, kind));
  }

  system(text: string): void {
    this.push("system", text);
  }

  clear(): void {
    this.lines.set([]);
  }

  onOutput(listener: (text: string, kind: LineKind) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  // ----- running --------------------------------------------------------------------

  complete(line: string): Completion {
    if (this.backend.get() === "bridge") return { line, candidates: [] };
    return this.shell.complete(line);
  }

  /** Runs a line in the active backend; resolves with the output it produced. */
  async run(line: string): Promise<{ output: string; error: boolean }> {
    const text = line.trim();
    if (text) this.history.push(text);
    if (this.backend.get() === "bridge") return this.runOnBridge(line);
    this.push("input", `${this.shell.prompt()} ${line}`);
    this.busy.set(true);
    try {
      const result = await this.shell.run(line);
      if (result.cleared) this.clear();
      const output = result.lines.join("\n");
      if (output) this.push(result.error ? "error" : "output", output);
      return { output, error: result.error };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.push("error", message);
      return { output: message, error: true };
    } finally {
      this.busy.set(false);
      this.promptTick.update((n) => n + 1);
    }
  }

  private async runOnBridge(line: string) {
    const shell = this.bridgeShell.get();
    if (!shell) {
      const msg =
        "No bridge shell is running. Start one with the Bridge shell switch.";
      this.push("error", msg);
      return { output: msg, error: true };
    }
    if (shell.backend === "pipe") this.push("input", `$ ${line}`);
    const collected: string[] = [];
    const off = this.onOutput((t) => collected.push(t));
    try {
      await this.write(`${line}\n`);
      await new Promise((r) => setTimeout(r, BRIDGE_RUN_SETTLE_MS));
    } finally {
      off();
    }
    return { output: collected.join("\n"), error: false };
  }

  /** Sends raw data (keystrokes) to the bridge shell. */
  async write(data: string): Promise<void> {
    const shell = this.bridgeShell.get();
    if (!this.bridge || !shell) throw new Error("No bridge shell is running");
    await this.bridge.request("shell.write", { id: shell.id, data });
  }

  // ----- bridge shell -------------------------------------------------------------

  bridgeStatus(): "off" | "waiting" | "connected" | "unavailable" {
    return this.bridge ? this.bridge.status.get() : "unavailable";
  }

  async startBridgeShell(
    options: { cols?: number; rows?: number } = {}
  ): Promise<BridgeShellInfo> {
    if (!this.bridge)
      throw new Error("The agent bridge is not available in this tab");
    if (this.bridge.status.get() !== "connected")
      throw new Error(
        'The agent bridge is not connected. Turn on "Agent bridge" in the top bar and start the CLI (npm run mcp).'
      );
    const existing = this.bridgeShell.get();
    if (existing) return existing;
    const info = (await this.bridge.request("shell.spawn", {
      cols: options.cols ?? 100,
      rows: options.rows ?? 30,
    })) as BridgeShellInfo;
    this.bridgeShell.set(info);
    this.backend.set("bridge");
    this.system(
      `Bridge shell: ${info.shell} in ${info.cwd} (${info.backend === "pty" ? "pty" : "pipes, line mode"}). Commands run on your machine.`
    );
    this.offStream = this.bridge.onStream(`shell:${info.id}`, (m) => {
      if (m.event === "data" && typeof m.data === "string") {
        this.appendRaw(m.data);
      } else if (m.event === "exit") {
        const code = (m.data as { code?: number } | undefined)?.code;
        this.endBridgeShell(
          `Shell exited${code === undefined ? "" : ` with code ${code}`}.`
        );
      } else if (m.event === "disconnected") {
        this.endBridgeShell(
          "The agent bridge disconnected; the shell is gone."
        );
      }
    });
    this.promptTick.update((n) => n + 1);
    return info;
  }

  /** Raw stream data grows the last output line until a newline. */
  private appendRaw(data: string) {
    this.lines.update((list) => {
      const last = list[list.length - 1];
      const tail =
        last && last.kind === "output" && !last.text.endsWith(" ")
          ? [last.text]
          : [];
      const grown = appendStream(tail, data);
      const base = tail.length ? list.slice(0, -1) : list;
      const rows = grown.map((t, i) => ({
        id: tail.length && i === 0 ? last.id : ++lineCounter,
        kind: "output" as const,
        text: t,
      }));
      const next = [...base, ...rows];
      return next.length > MAX_LINES
        ? next.slice(next.length - MAX_LINES)
        : next;
    });
    this.listeners.forEach((l) => l(data, "output"));
  }

  private endBridgeShell(reason: string) {
    this.offStream?.();
    this.offStream = null;
    if (this.bridgeShell.get()) {
      this.bridgeShell.set(null);
      this.system(reason);
    }
    this.backend.set("project");
    this.promptTick.update((n) => n + 1);
  }

  async stopBridgeShell(): Promise<void> {
    const shell = this.bridgeShell.get();
    if (shell && this.bridge) {
      try {
        await this.bridge.request("shell.kill", { id: shell.id });
      } catch {
        // The bridge may be gone already.
      }
    }
    this.endBridgeShell("Bridge shell stopped.");
  }

  setBackend(backend: TerminalBackend): void {
    if (backend === "project") {
      this.backend.set("project");
      this.promptTick.update((n) => n + 1);
    } else if (this.bridgeShell.get()) {
      this.backend.set("bridge");
      this.promptTick.update((n) => n + 1);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void this.stopBridgeShell();
    this.listeners.clear();
  }
}
