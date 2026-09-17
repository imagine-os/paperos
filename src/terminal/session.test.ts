import { describe, expect, it } from "vitest";
import { signal } from "@/ide/signal";
import type { StreamMessage } from "@/api/bridge-protocol";
import { appendStream, stripAnsi } from "./ansi";
import { memoryShellFs } from "./fs";
import { ProjectShell, type ShellHost } from "./shell";
import {
  BRIDGE_RUN_SETTLE_MS,
  parseTerminalContent,
  TerminalSession,
  type BridgeShellApi,
} from "./session";

const host: ShellHost = {
  openFile: () => {},
  preview: () => {},
  openData: () => {},
  openBoard: () => {},
  layout: () => {},
  api: async () => 1,
  evalJs: async () => 2,
};

function fakeBridge(connected = true) {
  const status = signal<"off" | "waiting" | "connected">(
    connected ? "connected" : "off"
  );
  const requests: { tool: string; args: Record<string, unknown> }[] = [];
  const handlers = new Map<string, (m: StreamMessage) => void>();
  const bridge: BridgeShellApi = {
    status,
    async request(tool, args = {}) {
      requests.push({ tool, args });
      if (tool === "shell.spawn")
        return { id: "s1", backend: "pipe", shell: "/bin/sh", cwd: "/home/me" };
      return { ok: true };
    },
    onStream(channel, handler) {
      handlers.set(channel, handler);
      return () => void handlers.delete(channel);
    },
  };
  const emit = (channel: string, event: string, data?: unknown) =>
    handlers.get(channel)?.({ type: "stream", channel, event, data });
  return { bridge, requests, emit, status, handlers };
}

function session(bridge: BridgeShellApi | null = null) {
  const fs = memoryShellFs({ "index.html": "<h1>Hi</h1>\n", "app.js": "x" });
  return new TerminalSession(
    "w1",
    new ProjectShell(fs, host),
    bridge,
    "Sample"
  );
}

describe("ansi", () => {
  it("strips colors, cursor codes, titles and carriage returns", () => {
    expect(
      stripAnsi("\u001b[32mgreen\u001b[0m and \u001b]0;title\u0007x\r\n")
    ).toBe("green and x\n");
    expect(appendStream([], "a\nb")).toEqual(["a", "b"]);
    expect(appendStream(["$ ", "x"], "yz\n")).toEqual(["$ ", "xyz", ""]);
    expect(appendStream(["keep"], "")).toEqual(["keep"]);
  });
});

describe("terminal content", () => {
  it("parses backend and initial commands tolerantly", () => {
    expect(parseTerminalContent("")).toEqual({});
    expect(parseTerminalContent("garbage")).toEqual({});
    expect(
      parseTerminalContent(
        JSON.stringify({ backend: "bridge", run: ["ls", 3] })
      )
    ).toEqual({
      backend: "bridge",
      run: ["ls"],
    });
    expect(parseTerminalContent("{}")).toEqual({
      backend: "project",
      run: undefined,
    });
  });
});

describe("terminal session (project shell)", () => {
  it("runs commands, records lines, notifies listeners and clears", async () => {
    const s = session();
    expect(s.lines.get()[0].kind).toBe("system");
    expect(s.prompt()).toBe("/ $");
    const got: string[] = [];
    const off = s.onOutput((t, k) => got.push(`${k}:${t}`));
    const r = await s.run("ls");
    expect(r).toEqual({ output: "app.js  index.html", error: false });
    expect(s.lines.get().map((l) => l.kind)).toEqual([
      "system",
      "input",
      "output",
    ]);
    expect(s.lines.get()[1].text).toBe("/ $ ls");
    const bad = await s.run("nope");
    expect(bad.error).toBe(true);
    expect(got).toEqual([
      "output:app.js  index.html",
      "error:nope: command not found (try help)",
    ]);
    off();
    await s.run("clear");
    expect(s.lines.get()).toHaveLength(0);
    expect(s.history).toEqual(["ls", "nope", "clear"]);
    expect(s.complete("ca").line).toBe("cat ");
    await s.runInitial(["echo one", "echo two"]);
    await s.runInitial(["echo three"]);
    expect(
      s.lines
        .get()
        .filter((l) => l.kind === "output")
        .map((l) => l.text)
    ).toEqual(["one", "two"]);
  });

  it("without a bridge the bridge shell cannot start", async () => {
    const s = session(null);
    expect(s.bridgeStatus()).toBe("unavailable");
    await expect(s.startBridgeShell()).rejects.toThrow(/not available/);
    const r = await s.run("ls");
    expect(r.error).toBe(false);
    s.setBackend("bridge");
    expect(s.backend.get()).toBe("project");
  });
});

describe("terminal session (bridge shell)", () => {
  it("refuses while disconnected, then spawns, streams, writes and stops", async () => {
    const off = fakeBridge(false);
    const s0 = session(off.bridge);
    await expect(s0.startBridgeShell()).rejects.toThrow(/not connected/);

    const fb = fakeBridge(true);
    const s = session(fb.bridge);
    const info = await s.startBridgeShell({ cols: 80, rows: 24 });
    expect(info).toMatchObject({ id: "s1", backend: "pipe" });
    expect(fb.requests[0]).toEqual({
      tool: "shell.spawn",
      args: { cols: 80, rows: 24 },
    });
    expect(s.backend.get()).toBe("bridge");
    expect(s.prompt()).toBe("$");
    expect(s.lines.get().at(-1)?.text).toContain(
      "Bridge shell: /bin/sh in /home/me"
    );
    expect(s.complete("ls").candidates).toEqual([]);

    // Output streams in, growing the last line until a newline.
    fb.emit("shell:s1", "data", "hel");
    fb.emit("shell:s1", "data", "lo\u001b[0m\nwor");
    const texts = () =>
      s.lines
        .get()
        .filter((l) => l.kind === "output")
        .map((l) => l.text);
    expect(texts()).toEqual(["hello", "wor"]);
    fb.emit("shell:s1", "data", "ld\n");
    expect(texts()).toEqual(["hello", "world", ""]);

    // run() echoes the line in pipe mode, writes it, and collects output for a moment.
    const started = Date.now();
    const p = s.run("pwd");
    setTimeout(() => fb.emit("shell:s1", "data", "/home/me\n"), 50);
    const r = await p;
    expect(Date.now() - started).toBeGreaterThanOrEqual(
      BRIDGE_RUN_SETTLE_MS - 20
    );
    expect(fb.requests.at(-1)).toEqual({
      tool: "shell.write",
      args: { id: "s1", data: "pwd\n" },
    });
    expect(r.output).toContain("/home/me");
    expect(
      s.lines.get().some((l) => l.kind === "input" && l.text === "$ pwd")
    ).toBe(true);

    await s.write("\u0003");
    expect(fb.requests.at(-1)?.args).toEqual({ id: "s1", data: "\u0003" });

    // Switching back and forth keeps the shell alive.
    s.setBackend("project");
    expect(s.prompt()).toBe("/ $");
    s.setBackend("bridge");
    expect(s.backend.get()).toBe("bridge");

    await s.stopBridgeShell();
    expect(s.bridgeShell.get()).toBeNull();
    expect(s.backend.get()).toBe("project");
    expect(fb.requests.at(-1)?.tool).toBe("shell.kill");
    expect(fb.handlers.size).toBe(0);
    const r2 = await s.run("ls");
    expect(r2.error).toBe(false);
  });

  it("an exit or a disconnect ends the bridge shell", async () => {
    const fb = fakeBridge(true);
    const s = session(fb.bridge);
    await s.startBridgeShell();
    fb.emit("shell:s1", "exit", { code: 0 });
    expect(s.bridgeShell.get()).toBeNull();
    expect(s.lines.get().at(-1)?.text).toBe("Shell exited with code 0.");
    await s.startBridgeShell();
    fb.emit("shell:s1", "disconnected");
    expect(s.lines.get().at(-1)?.text).toContain("disconnected");
    expect(s.backend.get()).toBe("project");
    const r = await s.run("echo x");
    expect(r.output).toBe("x");
  });
});
