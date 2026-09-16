import type { Editor, TLShapeId } from "tldraw";
import { createWindow } from "@/desktop/create-window";
import type { WindowShape } from "@/desktop/window-shape";
import { getWindowManager } from "@/wm/window-manager";
import { encodeFileRef, parseFileRef, sameRef, type FileRef } from "./file-ref";
import { basename } from "./project/paths";

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
 * file, then an empty window of that kind; otherwise creates one. New
 * windows go next to the Files window when a layout is active (or next to
 * `nearId`), else they cascade at the viewport center.
 */
export function openFile(
  editor: Editor,
  ref: FileRef,
  {
    kind = "editor",
    nearId,
  }: { kind?: FileWindowKind; nearId?: TLShapeId } = {}
): TLShapeId {
  const wm = getWindowManager(editor);
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
  const id = createWindow(editor, { kind, content, title });
  if (wm.root.get()) {
    const anchor =
      nearId ?? windows(editor).find((w) => w.props.kind === "files")?.id;
    wm.tileWindow(
      id,
      "right",
      anchor && wm.isTiled(anchor) ? anchor : undefined
    );
  }
  wm.focusWindow(id);
  return id;
}
