/**
 * The tab side of the agent bridge. Connects to the local MCP CLI
 * (`tools/paperos-mcp`, ws://127.0.0.1:7331 by default), announces the tool
 * list, runs incoming `call` messages against the Canvas API and answers
 * with `result` messages. Every call is recorded in a transcript for the
 * Agent window; a pause switch makes calls fail without touching the canvas.
 *
 * The socket is injected (`SocketLike`) so the protocol handling is unit
 * tested without a network.
 */
import { signal, type Signal } from "@/ide/signal";
import {
  BRIDGE_DEFAULT_URL,
  BRIDGE_PROTOCOL_VERSION,
  createPendingCalls,
  decodeMessage,
  encodeMessage,
  newCallId,
  NO_BRIDGE_ERROR,
  type BridgeMessage,
  type CallMessage,
  type PendingCalls,
  type StreamMessage,
} from "./bridge-protocol";
import type { CanvasApi } from "./canvas-api";
import { invokeTool } from "./invoke";
import { API_VERSION, bridgeTools } from "./schema";

export type BridgeStatus = "off" | "waiting" | "connected";

export interface TranscriptEntry {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  time: number;
  ms: number;
  ok: boolean;
  /** Short rendering of the result or the error. */
  summary: string;
}

export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export interface BridgeClientOptions {
  url?: string;
  connect?: (url: string) => SocketLike;
  /** Reconnect delay while enabled and disconnected. */
  retryMs?: number;
  /** How long a `request()` to the CLI may take (default 60 s). */
  requestTimeoutMs?: number;
  now?: () => number;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}

export const BRIDGE_KEY = "paperos-v2:bridge";
export const TRANSCRIPT_LIMIT = 300;

export function summarize(value: unknown, max = 160): string {
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  if (text === undefined) text = "undefined";
  if (text.startsWith("data:image/")) return `[image ${text.length} chars]`;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export class BridgeClient {
  readonly status: Signal<BridgeStatus> = signal<BridgeStatus>("off");
  readonly paused: Signal<boolean> = signal(false);
  readonly transcript: Signal<TranscriptEntry[]> = signal<TranscriptEntry[]>(
    []
  );
  readonly url: string;
  private socket: SocketLike | null = null;
  private enabled = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private readonly connectFn: (url: string) => SocketLike;
  private readonly retryMs: number;
  private readonly now: () => number;
  private readonly storage: BridgeClientOptions["storage"];
  private readonly requests: PendingCalls;
  private readonly streams = new Map<string, Set<(m: StreamMessage) => void>>();

  constructor(
    private readonly api: CanvasApi,
    options: BridgeClientOptions = {}
  ) {
    this.url = options.url ?? BRIDGE_DEFAULT_URL;
    this.connectFn =
      options.connect ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.retryMs = options.retryMs ?? 2000;
    this.now = options.now ?? Date.now;
    this.storage =
      options.storage === undefined ? safeStorage() : options.storage;
    this.requests = createPendingCalls({
      timeoutMs: options.requestTimeoutMs ?? 60_000,
    });
  }

  /** Listens to a stream channel from the CLI (`shell:<id>`); returns an unsubscribe function. */
  onStream(
    channel: string,
    handler: (message: StreamMessage) => void
  ): () => void {
    let set = this.streams.get(channel);
    if (!set) {
      set = new Set();
      this.streams.set(channel, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
      if (set && set.size === 0) this.streams.delete(channel);
    };
  }

  /**
   * Asks the CLI to run one of its local tools (`browser.fetch`,
   * `browser.screenshot`, `shell.*`). Rejects at once when no bridge is
   * connected.
   */
  request(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (this.status.get() !== "connected" || !this.socket)
      return Promise.reject(new Error(NO_BRIDGE_ERROR));
    const id = newCallId("r");
    const result = this.requests.start(id, tool);
    this.send({ type: "request", id, tool, args });
    return result;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** True when the stored preference or `?bridge=1` asks for the bridge. */
  shouldAutoStart(
    search = typeof location !== "undefined" ? location.search : ""
  ): boolean {
    if (/[?&]bridge=(1|true|on)\b/.test(search)) return true;
    try {
      return this.storage?.getItem(BRIDGE_KEY) === "on";
    } catch {
      return false;
    }
  }

  start(): void {
    if (this.enabled) return;
    this.enabled = true;
    try {
      this.storage?.setItem(BRIDGE_KEY, "on");
    } catch {
      // Storage blocked: the choice lives for this session.
    }
    this.open();
  }

  stop(): void {
    this.enabled = false;
    try {
      this.storage?.removeItem(BRIDGE_KEY);
    } catch {
      // ignore
    }
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.socket?.close();
    this.socket = null;
    this.requests.rejectAll("the agent bridge was turned off");
    this.status.set("off");
  }

  toggle(): void {
    if (this.enabled) this.stop();
    else this.start();
  }

  setPaused(paused: boolean): void {
    this.paused.set(paused);
  }

  clearTranscript(): void {
    this.transcript.set([]);
  }

  private open() {
    if (!this.enabled) return;
    this.status.set("waiting");
    let socket: SocketLike;
    try {
      socket = this.connectFn(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.send({
        type: "hello",
        version: BRIDGE_PROTOCOL_VERSION,
        client: "paperos-tab",
        apiVersion: API_VERSION,
        tools: bridgeTools().map((t) => t.name),
      });
    };
    socket.onmessage = (ev) => {
      if (this.socket !== socket) return;
      void this.handleIncoming(ev.data);
    };
    socket.onerror = () => {
      // onclose follows; nothing to do here.
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.requests.rejectAll("the agent bridge disconnected");
      // Shell sessions die with the connection: tell their listeners.
      for (const [channel, set] of [...this.streams])
        set.forEach((h) =>
          h({ type: "stream", channel, event: "disconnected" })
        );
      if (this.enabled) {
        this.status.set("waiting");
        this.scheduleRetry();
      }
    };
  }

  private scheduleRetry() {
    if (!this.enabled || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.open();
    }, this.retryMs);
  }

  private send(message: BridgeMessage) {
    try {
      this.socket?.send(encodeMessage(message));
    } catch {
      // The socket closed under us; onclose reconnects.
    }
  }

  /** Handles one raw message from the bridge (public for tests). */
  async handleIncoming(raw: unknown): Promise<void> {
    const message = decodeMessage(raw);
    if (!message) return;
    if (message.type === "welcome") {
      this.status.set("connected");
      return;
    }
    if (message.type === "response") {
      this.requests.settle(message);
      return;
    }
    if (message.type === "stream") {
      this.streams.get(message.channel)?.forEach((h) => h(message));
      return;
    }
    if (message.type === "call") await this.handleCall(message);
  }

  private async handleCall(call: CallMessage) {
    const started = this.now();
    let ok = false;
    let summary: string;
    try {
      if (this.paused.get())
        throw new Error(
          "The agent bridge is paused in PaperOS (Agent window)."
        );
      const result = await invokeTool(this.api, call.tool, call.args);
      this.send({
        type: "result",
        id: call.id,
        ok: true,
        result: result ?? null,
      });
      ok = true;
      summary = summarize(result);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.send({ type: "result", id: call.id, ok: false, error });
      summary = error;
    }
    const entry: TranscriptEntry = {
      id: call.id,
      tool: call.tool,
      args: call.args,
      time: started,
      ms: this.now() - started,
      ok,
      summary,
    };
    this.transcript.update((list) => [...list, entry].slice(-TRANSCRIPT_LIMIT));
  }
}

function safeStorage(): BridgeClientOptions["storage"] {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let client: BridgeClient | null = null;

/** The tab's bridge client (created by the desktop with the Canvas API). */
export function getBridgeClient(): BridgeClient | null {
  return client;
}

export function installBridgeClient(api: CanvasApi): BridgeClient {
  client?.stop();
  client = new BridgeClient(api);
  if (client.shouldAutoStart()) client.start();
  return client;
}
