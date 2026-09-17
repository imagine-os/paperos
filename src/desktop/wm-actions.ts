import type { Editor, TLUiActionsContextType } from "tldraw";
import type { LayoutPreset, Side } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { createWindow } from "./create-window";
import { togglePalette } from "@/ide/palette-state";

/**
 * Window-manager keyboard shortcuts, registered as tldraw actions so they show
 * in the shortcuts dialog. All Alt-based. tldraw's own Alt+Arrow (change page)
 * and Alt+F (tldraw focus mode) are moved to Alt+PageUp/PageDown and
 * Alt+Shift+F so nothing clashes.
 */
export const WM_ACTION_IDS = [
  "wm-layout-free",
  "wm-layout-columns",
  "wm-layout-grid",
  "wm-layout-bento",
  "wm-layout-split-tree",
  "wm-focus-left",
  "wm-focus-right",
  "wm-focus-up",
  "wm-focus-down",
  "wm-swap-left",
  "wm-swap-right",
  "wm-swap-up",
  "wm-swap-down",
  "wm-toggle-tile",
  "wm-focus-mode",
  "wm-new-window",
  "ide-command-palette",
] as const;

/** The layout presets' shortcuts as menus and the palette show them. */
export const PRESET_SHORTCUTS: Partial<Record<LayoutPreset, string>> = {
  free: "Alt+1",
  columns: "Alt+2",
  grid: "Alt+3",
  "bento-1-2": "Alt+4",
  "split-tree": "Alt+5",
};

const PRESET_KEYS: [string, LayoutPreset, string][] = [
  ["wm-layout-free", "free", "alt+1"],
  ["wm-layout-columns", "columns", "alt+2"],
  ["wm-layout-grid", "grid", "alt+3"],
  ["wm-layout-bento", "bento-1-2", "alt+4"],
  ["wm-layout-split-tree", "split-tree", "alt+5"],
];

const ARROWS: [Side, string, string][] = [
  ["left", "left", "left"],
  ["right", "right", "right"],
  ["top", "up", "up"],
  ["bottom", "down", "down"],
];

export function wmActions(
  editor: Editor,
  actions: TLUiActionsContextType
): TLUiActionsContextType {
  const wm = () => getWindowManager(editor);

  // Free the Alt combos the window manager uses.
  if (actions["change-page-prev"])
    actions["change-page-prev"].kbd = "alt+pageup";
  if (actions["change-page-next"])
    actions["change-page-next"].kbd = "alt+pagedown";
  if (actions["toggle-focus-mode"])
    actions["toggle-focus-mode"].kbd = "alt+shift+f";

  for (const [id, preset, kbd] of PRESET_KEYS) {
    const label =
      preset === "bento-1-2"
        ? "Bento"
        : preset === "split-tree"
          ? "Split tree"
          : preset[0].toUpperCase() + preset.slice(1);
    actions[id] = {
      id,
      label: `Layout: ${label}`,
      kbd,
      readonlyOk: true,
      onSelect: () => wm().applyPreset(preset),
    };
  }

  for (const [side, name, key] of ARROWS) {
    actions[`wm-focus-${name}`] = {
      id: `wm-focus-${name}`,
      label: `Focus window ${name}`,
      kbd: `alt+${key}`,
      readonlyOk: true,
      onSelect: () => wm().moveFocus(side),
    };
    actions[`wm-swap-${name}`] = {
      id: `wm-swap-${name}`,
      label: `Swap window ${name}`,
      kbd: `alt+shift+${key}`,
      readonlyOk: true,
      onSelect: () => wm().swapFocused(side),
    };
  }

  actions["wm-toggle-tile"] = {
    id: "wm-toggle-tile",
    label: "Tile / float window",
    kbd: "alt+enter",
    readonlyOk: true,
    onSelect: () => {
      const id = wm().getFocusedId();
      if (id) wm().toggleTile(id);
    },
  };

  actions["wm-focus-mode"] = {
    id: "wm-focus-mode",
    label: "Focus mode (zoom to window)",
    kbd: "alt+f",
    readonlyOk: true,
    onSelect: () => wm().focusMode(),
  };

  actions["wm-new-window"] = {
    id: "wm-new-window",
    label: "New window",
    kbd: "alt+n",
    readonlyOk: true,
    onSelect: () => {
      createWindow(editor, { kind: "note" });
    },
  };

  actions["ide-command-palette"] = {
    id: "ide-command-palette",
    label: "Command palette",
    kbd: "$k",
    readonlyOk: true,
    onSelect: () => togglePalette(),
  };

  return actions;
}
