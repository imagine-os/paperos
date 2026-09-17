/**
 * Which transport a room uses. Pure so the selection is unit tested.
 *
 * - `webrtc` (default): peers connect directly; a signaling server only
 *   introduces them. y-webrtc's public server is the default; a self-hosted
 *   one is a URL away (`NEXT_PUBLIC_PAPEROS_SIGNALING`, or the Share window).
 * - `websocket`: a y-websocket server relays updates (`tools/paperos-sync`).
 *   Chosen when the link carries `sync=`, when the Share window says so, or
 *   when `NEXT_PUBLIC_PAPEROS_SYNC_URL` is set.
 *
 * Swapping in a hosted backend later is one more entry in `providers.ts`.
 */

export type TransportKind = "webrtc" | "websocket";

export type Transport =
  { kind: "webrtc"; signaling: string[] } | { kind: "websocket"; url: string };

/** y-webrtc's public signaling server (no account; fine for trying it out). */
export const DEFAULT_SIGNALING = ["wss://y-webrtc-eu.fly.dev"];

export interface TransportEnv {
  /** Comma-separated signaling URLs (`NEXT_PUBLIC_PAPEROS_SIGNALING`). */
  signaling?: string;
  /** A sync server that makes websocket the default (`NEXT_PUBLIC_PAPEROS_SYNC_URL`). */
  syncUrl?: string;
}

/** What the Share window remembers in localStorage. */
export interface StoredTransport {
  kind?: TransportKind;
  syncUrl?: string;
  signaling?: string;
}

export function parseUrlList(text: string | undefined): string[] {
  return (text ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^wss?:\/\//.test(s));
}

/**
 * Picks the transport for a room. Precedence: an explicit choice (a link's
 * `sync=` or an API/UI argument), then the stored preference, then the build
 * environment, then peer-to-peer with the public signaling server.
 */
export function selectTransport(input: {
  explicit?: { kind?: TransportKind; url?: string } | null;
  stored?: StoredTransport | null;
  env?: TransportEnv | null;
}): Transport {
  const { explicit, stored, env } = input;
  const signaling =
    parseUrlList(explicit?.kind === "webrtc" ? explicit.url : undefined)[0] ??
    null;
  const signalingList = [
    ...(signaling ? [signaling] : []),
    ...parseUrlList(stored?.signaling),
    ...parseUrlList(env?.signaling),
  ];
  const websocketUrl =
    (explicit?.kind === "websocket" || (!explicit?.kind && explicit?.url)
      ? parseUrlList(explicit?.url)[0]
      : undefined) ??
    parseUrlList(stored?.syncUrl)[0] ??
    parseUrlList(env?.syncUrl)[0];

  const kind: TransportKind =
    explicit?.kind ??
    (explicit?.url ? "websocket" : undefined) ??
    stored?.kind ??
    (parseUrlList(env?.syncUrl).length ? "websocket" : "webrtc");

  if (kind === "websocket") {
    if (!websocketUrl)
      throw new Error(
        "No sync server URL: pass one (ws://host:port) or set NEXT_PUBLIC_PAPEROS_SYNC_URL"
      );
    return { kind, url: websocketUrl };
  }
  return {
    kind: "webrtc",
    signaling: signalingList.length ? signalingList : DEFAULT_SIGNALING,
  };
}

/** Short label for status lines: "WebRTC via wss://..." / "Sync server ws://...". */
export function describeTransport(t: Transport): string {
  return t.kind === "webrtc"
    ? `WebRTC via ${t.signaling[0]}`
    : `Sync server ${t.url}`;
}
