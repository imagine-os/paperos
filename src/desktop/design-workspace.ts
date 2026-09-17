import type { Editor } from "tldraw";
import { leaf, nodeId } from "@/wm/tree";
import type { LayoutNode } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { DESIGN_WORKSPACE_ID } from "@/wm/workspace-store";
import { ensureWindow } from "./ide-workspace";
import { getWorkspaceStore } from "./workspaces";

/**
 * The "Design" workspace: Design system on the left, Page Builder over the
 * Preview on the right. Creates the windows that are missing, applies the
 * split tree and saves it as the "Design" workspace.
 */
export async function applyDesignWorkspace(editor: Editor): Promise<void> {
  const wm = getWindowManager(editor);
  const design = ensureWindow(editor, "design");
  const pages = ensureWindow(editor, "pages");
  const preview = ensureWindow(editor, "preview", "pages/home.json");

  const root: LayoutNode = {
    type: "split",
    id: nodeId("s"),
    direction: "horizontal",
    ratios: [0.42, 0.58],
    children: [
      leaf(design),
      {
        type: "split",
        id: nodeId("s"),
        direction: "vertical",
        ratios: [0.6, 0.4],
        children: [leaf(pages), leaf(preview)],
      },
    ],
  };
  wm.applyTree(root, "split-tree");
  wm.focusWindow(pages, { select: false });

  const workspaces = getWorkspaceStore();
  const existing =
    workspaces.get(DESIGN_WORKSPACE_ID) ??
    workspaces.list().find((w) => w.name === "Design");
  const ws = existing
    ? workspaces.save(existing.id, wm.snapshot())
    : workspaces.create("Design", wm.snapshot());
  if (ws) {
    workspaces.setActive(ws.id);
    wm.activeWorkspaceId.set(ws.id);
  }
}
