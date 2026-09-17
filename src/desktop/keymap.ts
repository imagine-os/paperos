/**
 * The keyboard map behind the `keys` window: every shortcut, grouped. The
 * entries come from the command registry (palette commands with a
 * `shortcut`) and from tldraw's actions and tools (which include the
 * window-manager actions), so the map cannot drift from what the keys do;
 * the editor and terminal keys, which live in CodeMirror keymaps and key
 * handlers, are listed here once. Pure TypeScript, unit tested.
 */
import type { Command } from "@/ide/commands";

export type KeyGroup =
  "Desktop" | "Windows" | "Layouts" | "Canvas" | "Editors" | "Terminal";

export const KEY_GROUPS: KeyGroup[] = [
  "Desktop",
  "Windows",
  "Layouts",
  "Canvas",
  "Editors",
  "Terminal",
];

export interface KeyBinding {
  /** Normalized, e.g. "Ctrl+K", "Alt+Shift+Left", "?" */
  keys: string;
  label: string;
  group: KeyGroup;
  /** Where the binding was read from. */
  source: "command" | "tldraw" | "static";
}

export interface TldrawShortcut {
  id: string;
  label: string;
  kbd: string;
}

export interface KeyGroupList {
  group: KeyGroup;
  bindings: KeyBinding[];
}

const KEY_NAMES: Record<string, string> = {
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
  enter: "Enter",
  escape: "Esc",
  esc: "Esc",
  del: "Delete",
  delete: "Delete",
  backspace: "Backspace",
  "⌫": "Backspace",
  pageup: "PageUp",
  pagedown: "PageDown",
  space: "Space",
  " ": "Space",
  tab: "Tab",
};

/**
 * One shortcut string in one spelling. Accepts tldraw's forms
 * ("cmd+shift+z,ctrl+shift+z", "$k", "!0", "?a", "alt+A") and ours
 * ("Alt+Shift+Left"); the first alternative wins, cmd reads as Ctrl,
 * modifiers come out in the order Ctrl, Alt, Shift.
 */
export function normalizeKeys(raw: string): string {
  const first = raw.split(",")[0].trim();
  if (!first) return "";
  let ctrl = false;
  let alt = false;
  let shift = false;
  let key = "";
  if (/^[$!?]+.+/.test(first) && !first.includes("+")) {
    // Old tldraw prefixes: $ = Ctrl, ! = Shift, ? = Alt.
    const m = /^([$!?]+)(.+)$/.exec(first)!;
    ctrl = m[1].includes("$");
    shift = m[1].includes("!");
    alt = m[1].includes("?");
    key = m[2];
  } else {
    const parts = first.split("+").filter((p) => p !== "");
    // A trailing "+" key ("shift+=" is fine; "ctrl++" means Ctrl and "+").
    if (first.endsWith("+") && parts.length) parts.push("+");
    key = parts.pop() ?? "";
    for (const p of parts) {
      const q = p.toLowerCase();
      if (q === "cmd" || q === "ctrl" || q === "mod" || q === "control")
        ctrl = true;
      else if (q === "alt" || q === "option") alt = true;
      else if (q === "shift") shift = true;
    }
  }
  const lower = key.toLowerCase();
  const name = KEY_NAMES[lower] ?? (key.length === 1 ? key.toUpperCase() : key);
  return [ctrl && "Ctrl", alt && "Alt", shift && "Shift", name]
    .filter(Boolean)
    .join("+");
}

/** Which group a palette command's shortcut belongs to. */
export function commandGroup(cmd: Pick<Command, "group">): KeyGroup {
  switch (cmd.group) {
    case "Layout":
      return "Layouts";
    case "Window":
      return "Windows";
    default:
      return "Desktop";
  }
}

/** Which group a tldraw action or tool belongs to, by id. */
export function tldrawGroup(id: string): KeyGroup {
  if (id.startsWith("wm-layout") || id === "wm-focus-mode") return "Layouts";
  if (id.startsWith("wm-") || id === "window") return "Windows";
  if (id.startsWith("ide-")) return "Desktop";
  return "Canvas";
}

/** Keys handled by the desktop itself, outside the registries. */
export const DESKTOP_KEYS: Omit<KeyBinding, "source">[] = [
  { keys: "?", label: "Keyboard shortcuts (this window)", group: "Desktop" },
  { keys: "Ctrl+K", label: "Command palette", group: "Desktop" },
  { keys: "Right", label: "Tour: next step", group: "Desktop" },
  { keys: "Left", label: "Tour: previous step", group: "Desktop" },
  { keys: "Esc", label: "Tour: exit", group: "Desktop" },
];

/** CodeMirror keymaps in the Editor and Script windows. */
export const EDITOR_KEYS: Omit<KeyBinding, "source">[] = [
  { keys: "Ctrl+S", label: "Save the file", group: "Editors" },
  { keys: "Shift+Alt+F", label: "Format with Prettier", group: "Editors" },
  {
    keys: "Ctrl+Enter",
    label: "Run the script (Script window)",
    group: "Editors",
  },
  { keys: "Ctrl+F", label: "Find in the file", group: "Editors" },
  { keys: "Ctrl+Z", label: "Undo in the editor", group: "Editors" },
  { keys: "Ctrl+Shift+Z", label: "Redo in the editor", group: "Editors" },
  { keys: "Ctrl+/", label: "Toggle line comment", group: "Editors" },
  { keys: "Alt+Up", label: "Move line up", group: "Editors" },
  { keys: "Alt+Down", label: "Move line down", group: "Editors" },
];

/** Keys the Terminal window handles. */
export const TERMINAL_KEYS: Omit<KeyBinding, "source">[] = [
  { keys: "Enter", label: "Run the command line", group: "Terminal" },
  { keys: "Tab", label: "Complete a command or path", group: "Terminal" },
  { keys: "Up", label: "Previous command (history)", group: "Terminal" },
  { keys: "Down", label: "Next command (history)", group: "Terminal" },
  { keys: "Ctrl+L", label: "Clear the terminal", group: "Terminal" },
  { keys: "Ctrl+C", label: "Interrupt (bridge shell)", group: "Terminal" },
];

/**
 * Builds the grouped map: commands first (their labels are the palette
 * titles), then tldraw's shortcuts, then the static lists; a key already
 * listed in a group is not repeated.
 */
export function buildKeymap(
  commands: Pick<Command, "id" | "title" | "group" | "shortcut">[],
  tldraw: TldrawShortcut[] = []
): KeyGroupList[] {
  const groups = new Map<KeyGroup, KeyBinding[]>();
  for (const g of KEY_GROUPS) groups.set(g, []);
  const seen = new Set<string>();
  const add = (b: KeyBinding) => {
    if (!b.keys) return;
    const id = `${b.group}:${b.keys}`;
    if (seen.has(id)) return;
    seen.add(id);
    groups.get(b.group)!.push(b);
  };
  for (const c of commands)
    if (c.shortcut)
      add({
        keys: normalizeKeys(c.shortcut),
        label: c.title,
        group: commandGroup(c),
        source: "command",
      });
  for (const t of tldraw)
    if (t.kbd)
      add({
        keys: normalizeKeys(t.kbd),
        label: t.label,
        group: tldrawGroup(t.id),
        source: "tldraw",
      });
  for (const b of [...DESKTOP_KEYS, ...EDITOR_KEYS, ...TERMINAL_KEYS])
    add({ ...b, keys: normalizeKeys(b.keys), source: "static" });
  return KEY_GROUPS.map((group) => ({
    group,
    bindings: groups.get(group)!,
  })).filter((g) => g.bindings.length > 0);
}

/** Groups filtered to the bindings whose label or keys contain `query` (case-insensitive). */
export function filterKeymap(
  groups: KeyGroupList[],
  query: string
): KeyGroupList[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      group: g.group,
      bindings: g.bindings.filter(
        (b) =>
          b.label.toLowerCase().includes(q) ||
          b.keys.toLowerCase().includes(q) ||
          b.keys.toLowerCase().replace(/\+/g, " ").includes(q)
      ),
    }))
    .filter((g) => g.bindings.length > 0);
}

/** "Alt+Shift+Left" -> ["Alt", "Shift", "Left"] for rendering as key caps. */
export function keyCaps(keys: string): string[] {
  if (keys === "+") return ["+"];
  return keys.split("+").filter((k) => k !== "");
}
