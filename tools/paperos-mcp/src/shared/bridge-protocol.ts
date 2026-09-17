/**
 * The wire protocol between a PaperOS tab and the local MCP bridge
 * (`tools/paperos-mcp`). JSON messages over one WebSocket. No imports, so
 * the file is copied verbatim into the CLI (see scripts/gen-api.ts).
 *
 *   tab    -> bridge : hello, result, event, request
 *   bridge -> tab    : welcome, call, response
 *
 * `call`/`result` run Canvas API tools in the tab for the agent;
 * `request`/`response` go the other way: the tab asks the CLI for something
 * only a process on the user's machine can do (a real browser through
 * Playwright, a shell), see `tools/paperos-mcp/src/local-tools.ts`.
 */

export const BRIDGE_PROTOCOL_VERSION = 2;
export const BRIDGE_DEFAULT_PORT = 7331;
export const BRIDGE_DEFAULT_URL = `ws://127.0.0.1:${BRIDGE_DEFAULT_PORT}`;
export const BRIDGE_CALL_TIMEOUT_MS = 30_000;

export interface HelloMessage {
  type: "hello";
  version: number;
  client: string;
  apiVersion: number;
  /** Dotted tool names the tab can run. */
  tools: string[];
}

export interface WelcomeMessage {
  type: "welcome";
  version: number;
  server: string;
}

export interface CallMessage {
  type: "call";
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

export type ResultMessage =
  | { type: "result"; id: string; ok: true; result: unknown }
  | { type: "result"; id: string; ok: false; error: string };

export interface EventMessage {
  type: "event";
  name: string;
  time: number;
  payload: unknown;
}

/** The tab asks the CLI to run one of its local tools (`browser.fetch`, `shell.spawn`, ...). */
export interface RequestMessage {
  type: "request";
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

export type ResponseMessage =
  | { type: "response"; id: string; ok: true; result: unknown }
  | { type: "response"; id: string; ok: false; error: string };

export type BridgeMessage =
  | HelloMessage
  | WelcomeMessage
  | CallMessage
  | ResultMessage
  | EventMessage
  | RequestMessage
  | ResponseMessage;

export function encodeMessage(message: BridgeMessage): string {
  return JSON.stringify(message);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parses and validates one incoming message; null for anything malformed. */
export function decodeMessage(raw: unknown): BridgeMessage | null {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(data) || typeof data.type !== "string") return null;
  switch (data.type) {
    case "hello":
      return typeof data.version === "number" &&
        typeof data.client === "string" &&
        typeof data.apiVersion === "number" &&
        Array.isArray(data.tools) &&
        data.tools.every((t) => typeof t === "string")
        ? (data as unknown as HelloMessage)
        : null;
    case "welcome":
      return typeof data.version === "number" && typeof data.server === "string"
        ? (data as unknown as WelcomeMessage)
        : null;
    case "call":
    case "request":
      return typeof data.id === "string" &&
        typeof data.tool === "string" &&
        (data.args === undefined || isRecord(data.args))
        ? {
            type: data.type,
            id: data.id,
            tool: data.tool,
            args: (data.args as Record<string, unknown>) ?? {},
          }
        : null;
    case "result":
    case "response": {
      if (typeof data.id !== "string" || typeof data.ok !== "boolean")
        return null;
      const type = data.type;
      if (data.ok) return { type, id: data.id, ok: true, result: data.result };
      return typeof data.error === "string"
        ? { type, id: data.id, ok: false, error: data.error }
        : null;
    }
    case "event":
      return typeof data.name === "string" && typeof data.time === "number"
        ? {
            type: "event",
            name: data.name,
            time: data.time,
            payload: data.payload,
          }
        : null;
    default:
      return null;
  }
}

let callCounter = 0;

export function newCallId(prefix = "c"): string {
  callCounter += 1;
  return `${prefix}${Date.now().toString(36)}-${callCounter.toString(36)}`;
}

export interface PendingCalls {
  /** Registers a call and resolves/rejects when its result arrives (or it times out). */
  start(id: string, tool: string): Promise<unknown>;
  /** Delivers a result. False when no call with that id is pending. */
  settle(message: ResultMessage | ResponseMessage): boolean;
  /** Rejects every pending call (the tab went away). */
  rejectAll(reason: string): void;
  size(): number;
}

export interface PendingCallsOptions {
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** Matches results to calls by id, with a timeout per call. */
export function createPendingCalls(
  options: PendingCallsOptions = {}
): PendingCalls {
  const timeoutMs = options.timeoutMs ?? BRIDGE_CALL_TIMEOUT_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ??
    ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const pending = new Map<
    string,
    {
      tool: string;
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: unknown;
    }
  >();

  const finish = (id: string) => {
    const p = pending.get(id);
    if (!p) return null;
    pending.delete(id);
    clearTimer(p.timer);
    return p;
  };

  return {
    start(id, tool) {
      return new Promise((resolve, reject) => {
        const timer = setTimer(() => {
          const p = finish(id);
          p?.reject(
            new Error(
              `${tool}: the PaperOS tab did not answer within ${timeoutMs} ms`
            )
          );
        }, timeoutMs);
        pending.set(id, { tool, resolve, reject, timer });
      });
    },
    settle(message) {
      const p = finish(message.id);
      if (!p) return false;
      if (message.ok) p.resolve(message.result);
      else p.reject(new Error(message.error));
      return true;
    },
    rejectAll(reason) {
      for (const id of [...pending.keys()])
        finish(id)?.reject(new Error(reason));
    },
    size: () => pending.size,
  };
}

/** Message the tab shows when it asks the CLI for something while disconnected. */
export const NO_BRIDGE_ERROR =
  'The agent bridge is not connected. Turn on "Agent bridge" in the top bar and start the CLI (npm run mcp, or through your agent).';

/** Message the bridge answers with when no tab is connected. */
export const NO_TAB_ERROR =
  'No PaperOS tab is connected. Open the app (npm run dev, http://localhost:3000) and turn on "Agent bridge" in the top bar, or open it with ?bridge=1.';
