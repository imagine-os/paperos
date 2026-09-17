import type { Editor, TLShapeId } from "tldraw";
import { getProjectStore } from "@/ide/project";
import { encodeFileRef } from "@/ide/file-ref";
import { fileWindowTitle } from "@/ide/open-file";
import { leaf, nodeId } from "@/wm/tree";
import type { LayoutNode } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { IDE_WORKSPACE_ID } from "@/wm/workspace-store";
import { createWindow } from "./create-window";
import type { WindowShape } from "./window-shape";
import { getWorkspaceStore } from "./workspaces";

export const IDE_INIT_KEY = "paperos-v2:ide-initialized";

/** One window per kind: the first existing one, else a new one. */
export function ensureWindow(
  editor: Editor,
  kind: string,
  content = "",
  title?: string
): TLShapeId {
  const found = editor
    .getCurrentPageShapes()
    .find(
      (s): s is WindowShape =>
        s.type === "window" && (s as WindowShape).props.kind === kind
    );
  if (found) return found.id;
  return createWindow(editor, { kind, content, title });
}

/**
 * The "IDE" workspace: Files in a left column, Editor in the center, Preview
 * over Console on the right. Creates the windows that are missing, applies
 * the split tree and saves it as the "IDE" workspace.
 */
export async function applyIdeWorkspace(editor: Editor): Promise<void> {
  const wm = getWindowManager(editor);
  const store = getProjectStore();
  await store.init();
  const project = store.getActiveId();

  // The editor opens the entry file so the workspace is not empty.
  let editorContent = "";
  let editorTitle: string | undefined;
  if (project) {
    const session = await store.session(project);
    const files = session?.files.get().map((f) => f.path) ?? [];
    const entry = files.includes("index.html")
      ? "index.html"
      : files.find((f) => /\.html?$/.test(f));
    if (entry) {
      editorContent = encodeFileRef({ project, path: entry });
      editorTitle = fileWindowTitle(entry);
    }
  }

  const files = ensureWindow(editor, "files");
  const code = ensureWindow(editor, "editor", editorContent, editorTitle);
  const preview = ensureWindow(editor, "preview");
  const console = ensureWindow(editor, "console");

  const root: LayoutNode = {
    type: "split",
    id: nodeId("s"),
    direction: "horizontal",
    ratios: [0.2, 0.45, 0.35],
    children: [
      leaf(files),
      leaf(code),
      {
        type: "split",
        id: nodeId("s"),
        direction: "vertical",
        ratios: [0.62, 0.38],
        children: [leaf(preview), leaf(console)],
      },
    ],
  };
  wm.applyTree(root, "split-tree");
  wm.focusWindow(code, { select: false });

  const workspaces = getWorkspaceStore();
  const existing =
    workspaces.get(IDE_WORKSPACE_ID) ??
    workspaces.list().find((w) => w.name === "IDE");
  const ws = existing
    ? workspaces.save(existing.id, wm.snapshot())
    : workspaces.create("IDE", wm.snapshot());
  if (ws) {
    workspaces.setActive(ws.id);
    wm.activeWorkspaceId.set(ws.id);
  }
}

/** True when this browser has never had the IDE workspace applied. */
export function isFirstRun(): boolean {
  try {
    return window.localStorage.getItem(IDE_INIT_KEY) === null;
  } catch {
    return false;
  }
}

export function markInitialized(): void {
  try {
    window.localStorage.setItem(IDE_INIT_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the workspace would come back next time, which is fine.
  }
}
