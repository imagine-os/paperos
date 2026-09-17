/**
 * The WebSocket side of the bridge: one local server the PaperOS tab
 * connects to. Tool calls are forwarded to the most recently connected tab
 * and matched to their results by id.
 */
import { WebSocketServer, type WebSocket } from "ws";
import { BROWSER_TOOLS } from "./browser-tools.js";
import { LocalTools } from "./local-tools.js";
import {
  BRIDGE_PROTOCOL_VERSION,
  createPendingCalls,
  decodeMessage,
  encodeMessage,
  newCallId,
  NO_TAB_ERROR,
  type HelloMessage,
  type RequestMessage,
} from "./shared/bridge-protocol.js";

export interface BridgeServerOptions {
  port: number;
  host?: string;
  log?: (line: string) => void;
  callTimeoutMs?: number;
}

export type BridgeState = "listening" | "connected";

export class BridgeServer {
  private wss: WebSocketServer | null = null;
  private tab: WebSocket | null = null;
  private hello: HelloMessage | null = null;
  private readonly pending;
  private readonly log: (line: string) => void;
  /** Tools this process runs for the tab and the agent (browser.*, shell.*). */
  readonly local: LocalTools;

  constructor(private readonly options: BridgeServerOptions) {
    this.log = options.log ?? (() => {});
    this.pending = createPendingCalls({ timeoutMs: options.callTimeoutMs });
    this.local = new LocalTools({
      log: this.log,
      push: (message) => this.push(message),
    });
    for (const t of BROWSER_TOOLS) this.local.register(t);
  }

  /** Sends a message to the connected tab (streams from local tools); false when there is none. */
  push(message: unknown): boolean {
    if (!this.tab) return false;
    try {
      this.tab.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  private async onRequest(socket: WebSocket, request: RequestMessage) {
    let reply: string;
    try {
      const result = await this.local.run(request.tool, request.args);
      reply = encodeMessage({
        type: "response",
        id: request.id,
        ok: true,
        result: result ?? null,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.log(`${request.tool} failed: ${error}`);
      reply = encodeMessage({
        type: "response",
        id: request.id,
        ok: false,
        error,
      });
    }
    if (this.tab === socket) socket.send(reply);
  }

  /** Starts listening; resolves once the port is bound. */
  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({
        port: this.options.port,
        host: this.options.host ?? "127.0.0.1",
      });
      this.wss = wss;
      wss.once("listening", () => {
        this.log(
          `bridge listening on ws://${this.options.host ?? "127.0.0.1"}:${this.options.port}`
        );
        resolve();
      });
      wss.once("error", (e) => reject(e));
      wss.on("connection", (socket, req) =>
        this.onConnection(socket, req.socket.remoteAddress)
      );
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.pending.rejectAll("bridge shutting down");
      this.tab?.close();
      this.tab = null;
      if (!this.wss) return resolve();
      this.wss.close(() => resolve());
      this.wss = null;
    });
  }

  state(): BridgeState {
    return this.tab ? "connected" : "listening";
  }

  /** What the connected tab announced, if any. */
  tabInfo(): HelloMessage | null {
    return this.hello;
  }

  private onConnection(socket: WebSocket, remote: string | undefined) {
    // Loopback only: the bridge is for the user's own browser.
    if (remote && !/^(127\.|::1$|::ffff:127\.)/.test(remote)) {
      this.log(`refused connection from ${remote}`);
      socket.close(1008, "loopback only");
      return;
    }
    if (this.tab && this.tab !== socket) {
      this.log("a new tab connected; the previous one is replaced");
      this.pending.rejectAll("another PaperOS tab connected");
      this.tab.close(1000, "replaced by a newer tab");
    }
    this.tab = socket;
    this.hello = null;
    socket.on("message", (data) => {
      const message = decodeMessage(data.toString());
      if (!message) return;
      if (message.type === "hello") {
        this.hello = message;
        this.log(
          `tab connected: ${message.client} (API v${message.apiVersion}, ${message.tools.length} tools)`
        );
        socket.send(
          encodeMessage({
            type: "welcome",
            version: BRIDGE_PROTOCOL_VERSION,
            server: "paperos-mcp",
          })
        );
      } else if (message.type === "result") {
        this.pending.settle(message);
      } else if (message.type === "request") {
        void this.onRequest(socket, message);
      }
    });
    socket.on("close", () => {
      if (this.tab !== socket) return;
      this.tab = null;
      this.hello = null;
      this.pending.rejectAll("the PaperOS tab disconnected");
      this.log("tab disconnected");
    });
    socket.on("error", (e) => this.log(`socket error: ${e.message}`));
  }

  /** Runs a Canvas API tool in the connected tab. */
  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const tab = this.tab;
    if (!tab || !this.hello) throw new Error(NO_TAB_ERROR);
    const id = newCallId();
    const result = this.pending.start(id, tool);
    tab.send(encodeMessage({ type: "call", id, tool, args }));
    return result;
  }
}
