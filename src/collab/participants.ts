/**
 * Awareness state <-> participants. Pure.
 *
 * Every peer publishes one awareness state per tab:
 *   user      {id, name, color, colorLight}   (y-codemirror.next reads `user`)
 *   focus     {window, file}                  the focused window / its file
 *   agent     true when an MCP bridge agent is connected to that tab
 *   presence  the tldraw instance_presence record (cursor, selection)
 *   cursor    y-codemirror.next's editor selection
 */

export interface AwarenessUser {
  id: string;
  name: string;
  color: string;
  colorLight?: string;
}

export interface AwarenessFocus {
  /** Focused window id (a tldraw shape id), or null. */
  window: string | null;
  /** `<project>:<path>` of the file the focused window shows, or null. */
  file: string | null;
}

export interface AwarenessState {
  user?: AwarenessUser;
  focus?: AwarenessFocus;
  agent?: boolean;
  presence?: unknown;
  cursor?: unknown;
}

export interface Participant {
  /** Awareness client id of the tab (agents share their tab's id). */
  clientId: number;
  /** Stable per browser (`identity.ts`); agents get `<id>:agent`. */
  id: string;
  name: string;
  color: string;
  /** This participant is an agent driving the tab over the MCP bridge. */
  agent: boolean;
  /** This is the local tab (or its agent). */
  local: boolean;
  window: string | null;
  file: string | null;
}

/** Distinguishable on light and dark paper; tldraw's cursor colors are similar. */
export const PARTICIPANT_COLORS = [
  "#e0503a",
  "#d9820f",
  "#c4a30a",
  "#3f9d55",
  "#1f9e9a",
  "#2f7fe0",
  "#7358d9",
  "#c74ba7",
  "#a0522d",
  "#5b8a2f",
];

export function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PARTICIPANT_COLORS[h % PARTICIPANT_COLORS.length];
}

/** `#rrggbb` -> the same color at 25% for selection backgrounds. */
export function lightColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}40` : color;
}

const FIRST = [
  "Quiet",
  "Brisk",
  "Sunny",
  "Calm",
  "Witty",
  "Keen",
  "Gentle",
  "Vivid",
];
const SECOND = [
  "Otter",
  "Heron",
  "Lynx",
  "Finch",
  "Panda",
  "Wren",
  "Fox",
  "Seal",
];

export function newUserName(random: () => number = Math.random): string {
  const pick = (l: string[]) =>
    l[Math.min(l.length - 1, Math.floor(random() * l.length))];
  return `${pick(FIRST)} ${pick(SECOND)}`;
}

/** `Quiet Otter` -> `QO`, `alice` -> `A`. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * The participants a set of awareness states describes: one per tab with a
 * `user`, plus one agent entry per tab that has a bridge agent connected.
 * The local tab comes first, the rest sorted by name.
 */
export function participantsFromStates(
  states: Map<number, AwarenessState | undefined | null>,
  localClientId: number
): Participant[] {
  const out: Participant[] = [];
  for (const [clientId, state] of states) {
    const user = state?.user;
    if (!user || typeof user.name !== "string") continue;
    const focus = state?.focus ?? { window: null, file: null };
    const local = clientId === localClientId;
    out.push({
      clientId,
      id: user.id,
      name: user.name,
      color: user.color,
      agent: false,
      local,
      window: focus.window ?? null,
      file: focus.file ?? null,
    });
    if (state?.agent) {
      out.push({
        clientId,
        id: `${user.id}:agent`,
        name: `${user.name}'s agent`,
        color: user.color,
        agent: true,
        local,
        window: focus.window ?? null,
        file: focus.file ?? null,
      });
    }
  }
  return out.sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    if (a.agent !== b.agent) return a.agent ? 1 : -1;
    return a.name.localeCompare(b.name) || a.clientId - b.clientId;
  });
}

/** Remote participants looking at a window: focused on it, or on the file it shows. */
export function participantsOnWindow(
  participants: Participant[],
  window: { id: string; file: string | null }
): Participant[] {
  return participants.filter(
    (p) =>
      !p.local &&
      (p.window === window.id ||
        (window.file !== null && p.file === window.file))
  );
}
