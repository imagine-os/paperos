/**
 * Network providers behind one small interface. The room session only knows
 * `CollabProvider`; adding a hosted backend (Liveblocks Yjs, y-sweet, ...) is
 * one more entry in `PROVIDERS` that wraps that vendor's Yjs provider.
 * Providers load on demand so the desktop bundle carries none of them until
 * a room is joined.
 */
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { signal, type Signal } from "@/ide/signal";
import type { Transport, TransportKind } from "./config";

export type ProviderStatus = "connecting" | "connected" | "disconnected";

export interface CollabProvider {
  kind: TransportKind;
  /** The signaling or sync server in use, for status lines. */
  endpoint: string;
  status: Signal<ProviderStatus>;
  /** Peers this tab is talking to right now (data channels or the server's other clients). */
  peers: Signal<number>;
  /** Resolves after the first sync with someone else. May never resolve in an empty room. */
  whenSynced: Promise<void>;
  destroy(): void;
}

export interface ProviderInput {
  transport: Transport;
  /** The transport-level room name (`roomKey()`). */
  room: string;
  doc: Y.Doc;
  awareness: Awareness;
  password?: string;
}

export type ProviderFactory = (input: ProviderInput) => Promise<CollabProvider>;

const webrtc: ProviderFactory = async ({
  transport,
  room,
  doc,
  awareness,
  password,
}) => {
  if (transport.kind !== "webrtc") throw new Error("wrong transport");
  const { WebrtcProvider } = await import("y-webrtc");
  const provider = new WebrtcProvider(room, doc, {
    signaling: transport.signaling,
    password: password || undefined,
    awareness,
  });
  const status = signal<ProviderStatus>("connecting");
  const peers = signal(0);
  let resolveSynced: () => void = () => {};
  const whenSynced = new Promise<void>((r) => (resolveSynced = r));
  provider.on("status", (e: { connected: boolean }) =>
    status.set(e.connected ? "connected" : "disconnected")
  );
  provider.on("peers", (e: { webrtcPeers: string[]; bcPeers: string[] }) =>
    peers.set(e.webrtcPeers.length + e.bcPeers.length)
  );
  provider.on("synced", () => resolveSynced());
  return {
    kind: "webrtc",
    endpoint: transport.signaling[0],
    status,
    peers,
    whenSynced,
    destroy() {
      provider.destroy();
    },
  };
};

const websocket: ProviderFactory = async ({
  transport,
  room,
  doc,
  awareness,
}) => {
  if (transport.kind !== "websocket") throw new Error("wrong transport");
  const { WebsocketProvider } = await import("y-websocket");
  const provider = new WebsocketProvider(transport.url, room, doc, {
    awareness,
  });
  const status = signal<ProviderStatus>("connecting");
  const peers = signal(0);
  let resolveSynced: () => void = () => {};
  const whenSynced = new Promise<void>((r) => (resolveSynced = r));
  provider.on("status", (e: { status: string }) =>
    status.set(
      e.status === "connected"
        ? "connected"
        : e.status === "connecting"
          ? "connecting"
          : "disconnected"
    )
  );
  provider.on("sync", (synced: boolean) => {
    if (synced) resolveSynced();
  });
  const onAwareness = () =>
    peers.set(Math.max(0, awareness.getStates().size - 1));
  awareness.on("change", onAwareness);
  return {
    kind: "websocket",
    endpoint: transport.url,
    status,
    peers,
    whenSynced,
    destroy() {
      awareness.off("change", onAwareness);
      provider.destroy();
    },
  };
};

/** One entry per transport. A hosted backend is one more line here. */
export const PROVIDERS: Record<TransportKind, ProviderFactory> = {
  webrtc,
  websocket,
};

export function createProvider(input: ProviderInput): Promise<CollabProvider> {
  return PROVIDERS[input.transport.kind](input);
}
