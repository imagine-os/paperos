import type { Editor } from "tldraw";
import { leaf, nodeId } from "@/wm/tree";
import type { LayoutNode } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { DATA_WORKSPACE_ID } from "@/wm/workspace-store";
import { ensureWindow } from "./ide-workspace";
import { getWorkspaceStore } from "./workspaces";

/**
 * The "Data" workspace: Files on the left, Data over Schema in the center,
 * Connections over Preview on the right. Creates the windows that are
 * missing, applies the split tree and saves it as the "Data" workspace.
 */
export async function applyDataWorkspace(editor: Editor): Promise<void> {
  const wm = getWindowManager(editor);
  const files = ensureWindow(editor, "files");
  const data = ensureWindow(editor, "data");
  const schema = ensureWindow(editor, "schema");
  const connections = ensureWindow(editor, "connections");
  const preview = ensureWindow(editor, "preview");

  const root: LayoutNode = {
    type: "split",
    id: nodeId("s"),
    direction: "horizontal",
    ratios: [0.17, 0.46, 0.37],
    children: [
      leaf(files),
      {
        type: "split",
        id: nodeId("s"),
        direction: "vertical",
        ratios: [0.55, 0.45],
        children: [leaf(data), leaf(schema)],
      },
      {
        type: "split",
        id: nodeId("s"),
        direction: "vertical",
        ratios: [0.5, 0.5],
        children: [leaf(connections), leaf(preview)],
      },
    ],
  };
  wm.applyTree(root, "split-tree");
  wm.focusWindow(data, { select: false });

  const workspaces = getWorkspaceStore();
  const existing =
    workspaces.get(DATA_WORKSPACE_ID) ??
    workspaces.list().find((w) => w.name === "Data");
  const ws = existing
    ? workspaces.save(existing.id, wm.snapshot())
    : workspaces.create("Data", wm.snapshot());
  if (ws) {
    workspaces.setActive(ws.id);
    wm.activeWorkspaceId.set(ws.id);
  }
}
