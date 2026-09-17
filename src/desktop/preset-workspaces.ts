import type { Editor } from "tldraw";
import {
  DATA_WORKSPACE_ID,
  DESIGN_WORKSPACE_ID,
  IDE_WORKSPACE_ID,
} from "@/wm/workspace-store";
import { applyDataWorkspace } from "./data-workspace";
import { applyDesignWorkspace } from "./design-workspace";
import { applyIdeWorkspace } from "./ide-workspace";
import { getWorkspaceStore } from "./workspaces";

/** Built-in arrangements that are constructed (windows created) the first time they are selected. */
export const PRESET_WORKSPACES: Record<
  string,
  { name: string; apply: (editor: Editor) => Promise<void> }
> = {
  [IDE_WORKSPACE_ID]: { name: "IDE", apply: applyIdeWorkspace },
  [DATA_WORKSPACE_ID]: { name: "Data", apply: applyDataWorkspace },
  [DESIGN_WORKSPACE_ID]: { name: "Design", apply: applyDesignWorkspace },
};

/**
 * Applies a preset workspace when `id` (or the name of a never-saved default)
 * is one. Returns false when the id is an ordinary saved workspace.
 */
export function applyPresetWorkspace(editor: Editor, id: string): boolean {
  const preset = PRESET_WORKSPACES[id];
  const ws = getWorkspaceStore().get(id);
  if (!preset || (ws && ws.root)) return false;
  void preset.apply(editor);
  return true;
}
