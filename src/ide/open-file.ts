import type { Editor, TLShapeId } from "tldraw";
import { createWindow } from "@/desktop/create-window";
import type { WindowShape } from "@/desktop/window-shape";
import { getWindowManager } from "@/wm/window-manager";
import { placeFileWindow } from "./editor-placement";
import { encodeFileRef, parseFileRef, sameRef, type FileRef } from "./file-ref";
import { basename } from "./project/paths";
import { revealLine } from "./reveal";

export type FileWindowKind = "editor" | "markdown";

function windows(editor: Editor): WindowShape[] {
  return editor
    .getCurrentPageShapes()
    .filter((s): s is WindowShape => s.type === "window");
}

/** The window showing `ref` in `kind`, if any. */
export function findFileWindow(
  editor: Editor,
  ref: FileRef,
  kind: FileWindowKind
): WindowShape | undefined {
  return windows(editor).find(
    (w) => w.props.kind === kind && sameRef(parseFileRef(w.props.content), ref)
  );
}

/** Title for a file window: the path, with a dot while unsaved. */
export function fileWindowTitle(path: string, dirty = false): string {
  return `${dirty ? "● " : ""}${path}`;
}

/**
 * Opens a file in a window of `kind`. Reuses a window already showing that
 * file, then an empty window of that kind; otherwise creates one. When a
 * layout is active the new window stacks under the focused editor (see
 * `placeFileWindow`), falling back to the right of Files or `nearId`; else
 * it cascades at the viewport center.
 */
export function openFile(
  editor: Editor,
  ref: FileRef,
  {
    kind = "editor",
    nearId,
    line,
  }: { kind?: FileWindowKind; nearId?: TLShapeId; line?: number } = {}
): TLShapeId {
  const wm = getWindowManager(editor);
  if (line !== undefined && kind === "editor")
    revealLine(ref.project, ref.path, line);
  const existing = findFileWindow(editor, ref, kind);
  if (existing) {
    wm.focusWindow(existing.id);
    return existing.id;
  }
  const content = encodeFileRef(ref);
  const title = fileWindowTitle(
    kind === "markdown" ? basename(ref.path) : ref.path
  );
  const empty = windows(editor).find(
    (w) => w.props.kind === kind && !parseFileRef(w.props.content)
  );
  if (empty) {
    editor.updateShape<WindowShape>({
      id: empty.id,
      type: "window",
      props: { content, title },
    });
    wm.focusWindow(empty.id);
    return empty.id;
  }
  const focusedId = wm.getFocusedId();
  const id = createWindow(editor, { kind, content, title });
  const root = wm.root.get();
  if (root) {
    const anchor =
      nearId ?? windows(editor).find((w) => w.props.kind === "files")?.id;
    wm.setTree(
      placeFileWindow(root, id, {
        focusedId,
        editorIds: windows(editor)
          .filter((w) => w.props.kind === kind)
          .map((w) => w.id),
        anchorId: anchor ?? null,
      })
    );
  }
  wm.focusWindow(id);
  return id;
}
