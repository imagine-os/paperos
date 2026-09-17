/**
 * Room ids and links. Pure: no browser APIs.
 *
 * A room id is readable (`amber-fox-417`), a link is `/app?room=<id>` with an
 * optional `sync=<ws url>` for a self-hosted sync server. Room passwords
 * never travel in links.
 */

const ADJECTIVES = [
  "amber",
  "brisk",
  "calm",
  "coral",
  "crisp",
  "dusty",
  "eager",
  "fair",
  "gentle",
  "golden",
  "hazel",
  "ivory",
  "jolly",
  "keen",
  "lucid",
  "mellow",
  "misty",
  "noble",
  "olive",
  "pale",
  "quiet",
  "rosy",
  "sage",
  "silver",
  "sunny",
  "tidy",
  "umber",
  "vivid",
  "warm",
  "witty",
  "young",
  "zesty",
];

const NOUNS = [
  "ant",
  "bear",
  "crane",
  "deer",
  "eagle",
  "finch",
  "fox",
  "gull",
  "hare",
  "ibis",
  "jay",
  "koala",
  "lark",
  "mole",
  "newt",
  "otter",
  "owl",
  "panda",
  "quail",
  "raven",
  "seal",
  "swan",
  "tern",
  "urchin",
  "vole",
  "wren",
  "yak",
  "zebra",
  "lynx",
  "moth",
  "heron",
  "trout",
];

/** `word-word-ddd`, also what pasted ids are checked against. */
export const ROOM_ID_RE = /^[a-z]+-[a-z]+-\d{3}$/;

/** A readable id: adjective-noun-3 digits (32 x 32 x 1000 = one million rooms). */
export function newRoomId(random: () => number = Math.random): string {
  const pick = <T>(list: T[]) =>
    list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  const n = Math.floor(random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${n}`;
}

export function isRoomId(v: unknown): v is string {
  return typeof v === "string" && ROOM_ID_RE.test(v);
}

/** Any lowercase word-ish id is accepted when joining (custom ids from the API). */
export function normalizeRoomId(raw: string): string | null {
  const id = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (!id || id.length > 64) return null;
  return id;
}

export interface RoomLink {
  id: string;
  /** Self-hosted sync server (`ws://` or `wss://`), or undefined for the default transport. */
  sync?: string;
}

/**
 * Reads a room id out of a link or a bare id: `amber-fox-417`,
 * `https://host/paperos/app?room=amber-fox-417&sync=wss://x`, `?room=...`.
 */
export function parseRoomLink(input: string): RoomLink | null {
  const text = input.trim();
  if (!text) return null;
  const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : null;
  if (query !== null) {
    const params = new URLSearchParams(query.split("#")[0]);
    const id = params.get("room");
    if (!id) return null;
    const norm = normalizeRoomId(id);
    if (!norm) return null;
    const sync = params.get("sync");
    return sync && isSyncUrl(sync) ? { id: norm, sync } : { id: norm };
  }
  const norm = normalizeRoomId(text);
  return norm ? { id: norm } : null;
}

export function isSyncUrl(v: unknown): v is string {
  return typeof v === "string" && /^wss?:\/\/[^\s/?#]+/.test(v);
}

/** `<base>/app?room=<id>[&sync=<url>]`; base is the origin plus base path. */
export function roomLink(base: string, link: RoomLink): string {
  const params = new URLSearchParams({ room: link.id });
  if (link.sync) params.set("sync", link.sync);
  const root = base.replace(/\/+$/, "");
  return `${root}/app?${params.toString()}`;
}

/** Small FNV-1a hash (hex). Not a secret: it partitions rooms by password. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * The name the transport uses for a room. With a password the name carries
 * a hash of it, so peers without the password land in a different (empty)
 * room; y-webrtc additionally encrypts signaling with the password.
 */
export function roomKey(id: string, password?: string): string {
  const base = `paperos-${id}`;
  return password ? `${base}-${hashText(`${id}:${password}`)}` : base;
}
