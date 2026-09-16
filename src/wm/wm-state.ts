import { isPreset } from "./presets";
import { createJsonStore, type JsonStore, type StorageLike } from "./storage";
import type { LayoutNode, LayoutPreset, Rect } from "./types";
import { parseWorkspace } from "./workspace-store";

export const WM_STATE_KEY = "paperos-v2:wm";

/** The live arrangement, so a reload comes back tiled the same way. */
export interface WmState {
  version: 1;
  preset: LayoutPreset;
  root: LayoutNode | null;
  region: Rect | null;
  activeWorkspaceId: string | null;
}

export const EMPTY_WM_STATE: WmState = {
  version: 1,
  preset: "free",
  root: null,
  region: null,
  activeWorkspaceId: null,
};

export function parseWmState(raw: unknown): WmState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (s.version !== 1 || typeof s.preset !== "string" || !isPreset(s.preset)) {
    return null;
  }
  // Reuse the workspace validator for the tree and region shapes.
  const probe = parseWorkspace({
    id: "probe",
    name: "probe",
    preset: s.preset,
    root: s.root,
    region: s.region,
  });
  if (!probe) return null;
  return {
    version: 1,
    preset: probe.preset,
    root: probe.root,
    region: probe.region,
    activeWorkspaceId:
      typeof s.activeWorkspaceId === "string" ? s.activeWorkspaceId : null,
  };
}

export function createWmStateStore(
  storage: StorageLike | null,
  key: string = WM_STATE_KEY
): JsonStore<WmState> {
  return createJsonStore(storage, key, () => EMPTY_WM_STATE, parseWmState);
}
