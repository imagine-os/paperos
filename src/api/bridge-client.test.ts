import { describe, expect, it } from "vitest";
import {
  BridgeClient,
  BRIDGE_KEY,
  summarize,
  type SocketLike,
} from "./bridge-client";
import { decodeMessage } from "./bridge-protocol";
import { createCanvasApi } from "./canvas-api";
import { createEventBus } from "./events";
import { fakeHost } from "./fake-host";
import { memoryStorage } from "@/wm/storage";

class FakeSocket implements SocketLike {
  sent: string[] = [];
  closed = false;
  onopen: SocketLike["onopen"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  onmessage: SocketLike["onmessage"] = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
}

function setup() {
  const host = fakeHost();
  const api = createCanvasApi(host, createEventBus());
  const sockets: FakeSocket[] = [];
  const storage = memoryStorage();
  let t = 1000;
  const client = new BridgeClient(api, {
    url: "ws://test",
    connect: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    retryMs: 5,
    now: () => (t += 3),
    storage,
  });
  return { host, api, client, sockets, storage };
}

const last = (s: FakeSocket) => decodeMessage(s.sent.at(-1));

describe("bridge client", () => {
  it("connects, says hello, becomes connected on welcome and remembers the choice", () => {
    const { client, sockets, storage } = setup();
    expect(client.status.get()).toBe("off");
    client.start();
    expect(client.status.get()).toBe("waiting");
    expect(storage.getItem(BRIDGE_KEY)).toBe("on");
    const s = sockets[0];
    s.onopen?.();
    const hello = last(s);
    expect(hello).toMatchObject({
      type: "hello",
      client: "paperos-tab",
      apiVersion: 1,
    });
    expect((hello as { tools: string[] }).tools).toContain("windows.create");
    expect((hello as { tools: string[] }).tools).not.toContain("events.on");
    s.onmessage?.({
      data: JSON.stringify({
        type: "welcome",
        version: 1,
        server: "paperos-mcp",
      }),
    });
    expect(client.status.get()).toBe("connected");
    client.stop();
    expect(s.closed).toBe(true);
    expect(client.status.get()).toBe("off");
    expect(storage.getItem(BRIDGE_KEY)).toBeNull();
  });

  it("runs calls against the API, answers, and records a transcript", async () => {
    const { client, sockets, api } = setup();
    client.start();
    const s = sockets[0];
    s.onopen?.();
    await client.handleIncoming(
      JSON.stringify({
        type: "call",
        id: "c1",
        tool: "windows.create",
        args: { kind: "note", title: "From agent" },
      })
    );
    const reply = last(s);
    expect(reply).toMatchObject({ type: "result", id: "c1", ok: true });
    expect((reply as { result: { title: string } }).result.title).toBe(
      "From agent"
    );
    expect(api.windows.list()).toHaveLength(1);

    await client.handleIncoming({
      type: "call",
      id: "c2",
      tool: "windows.get",
      args: { id: "shape:zzz" },
    });
    expect(last(s)).toEqual({
      type: "result",
      id: "c2",
      ok: true,
      result: null,
    });

    await client.handleIncoming({
      type: "call",
      id: "c3",
      tool: "layout.apply",
      args: { preset: "diagonal" },
    });
    expect(last(s)).toMatchObject({
      type: "result",
      id: "c3",
      ok: false,
      error: expect.stringMatching(/Unknown preset/),
    });

    await client.handleIncoming("garbage");
    const t = client.transcript.get();
    expect(t.map((e) => [e.tool, e.ok])).toEqual([
      ["windows.create", true],
      ["windows.get", true],
      ["layout.apply", false],
    ]);
    expect(t[0].ms).toBe(3);
    expect(t[0].summary).toContain('"title":"From agent"');
  });

  it("refuses calls while paused and reconnects after a close", async () => {
    const { client, sockets, api } = setup();
    client.start();
    const s = sockets[0];
    s.onopen?.();
    client.setPaused(true);
    await client.handleIncoming({
      type: "call",
      id: "p",
      tool: "windows.create",
      args: { kind: "note" },
    });
    expect(last(s)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/paused/),
    });
    expect(api.windows.list()).toHaveLength(0);
    client.setPaused(false);

    s.onclose?.();
    expect(client.status.get()).toBe("waiting");
    await new Promise((r) => setTimeout(r, 15));
    expect(sockets).toHaveLength(2);
    client.stop();
    await new Promise((r) => setTimeout(r, 15));
    expect(sockets).toHaveLength(2);
  });

  it("auto-starts from ?bridge=1 or the stored preference", () => {
    const { client, storage } = setup();
    expect(client.shouldAutoStart("?x=1")).toBe(false);
    expect(client.shouldAutoStart("?bridge=1")).toBe(true);
    expect(client.shouldAutoStart("?a=b&bridge=on")).toBe(true);
    storage.setItem(BRIDGE_KEY, "on");
    expect(client.shouldAutoStart("")).toBe(true);
  });

  it("summarizes results", () => {
    expect(summarize({ a: 1 })).toBe('{"a":1}');
    expect(summarize("data:image/png;base64,AAAA")).toBe("[image 26 chars]");
    expect(summarize("x".repeat(200), 10)).toHaveLength(10);
    expect(summarize(undefined)).toBe("undefined");
  });
});

describe("bridge client requests to the CLI", () => {
  it("rejects at once while disconnected", async () => {
    const { client } = setup();
    await expect(client.request("browser.fetch", { url: "x" })).rejects.toThrow(
      /not connected/
    );
    client.start();
    await expect(client.request("browser.fetch")).rejects.toThrow(
      /not connected/
    );
  });

  it("sends a request and settles on the matching response", async () => {
    const { client, sockets } = setup();
    client.start();
    const s = sockets[0];
    s.onopen?.();
    s.onmessage?.({
      data: JSON.stringify({ type: "welcome", version: 2, server: "x" }),
    });
    const p = client.request("browser.fetch", { url: "https://example.com" });
    const sent = last(s) as {
      type: string;
      id: string;
      tool: string;
      args: unknown;
    };
    expect(sent).toMatchObject({
      type: "request",
      tool: "browser.fetch",
      args: { url: "https://example.com" },
    });
    await client.handleIncoming({
      type: "response",
      id: sent.id,
      ok: true,
      result: { text: "hi" },
    });
    await expect(p).resolves.toEqual({ text: "hi" });

    const failing = client.request("shell.spawn");
    const req = last(s) as { id: string };
    await client.handleIncoming({
      type: "response",
      id: req.id,
      ok: false,
      error: "no pty",
    });
    await expect(failing).rejects.toThrow("no pty");

    const dropped = client.request("browser.screenshot");
    s.close();
    await expect(dropped).rejects.toThrow(/disconnected/);
  });
});
