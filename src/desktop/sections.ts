/**
 * Sections: tldraw frames used as titled groups of windows. Windows parented
 * into a frame move with it; the window manager tiles inside the focused
 * window's section. Frames are tldraw's own shape, so no new shape type is
 * needed (PLAN decision: windows are the one primitive; sections are chrome).
 */
import {
  Box,
  createShapeId,
  type Editor,
  type TLFrameShape,
  type TLShapeId,
} from "tldraw";
import type { Rect } from "@/wm/types";

/** Room around the windows inside a new section (page units). */
export const SECTION_PADDING = 24;
/** Extra room at the top for the frame's title. */
export const SECTION_HEADER = 16;

export interface SectionInfo {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Window ids inside the section. */
  windowIds: string[];
}

export function isFrame(editor: Editor, id: TLShapeId): boolean {
  return editor.getShape(id)?.type === "frame";
}

/** The frame a shape sits in (walking up through nested frames), or null. */
export function sectionOf(editor: Editor, id: TLShapeId): TLFrameShape | null {
  const shape = editor.getShape(id);
  if (!shape) return null;
  const frame = editor
    .getShapeAncestors(shape)
    .reverse()
    .find((s) => s.type === "frame");
  return frame ? (frame as TLFrameShape) : null;
}

export function sectionBounds(editor: Editor, frame: TLFrameShape): Rect {
  const b =
    editor.getShapePageBounds(frame.id) ??
    new Box(frame.x, frame.y, frame.props.w, frame.props.h);
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}

function frameInfo(editor: Editor, frame: TLFrameShape): SectionInfo {
  const b = sectionBounds(editor, frame);
  const windowIds = editor
    .getSortedChildIdsForParent(frame.id)
    .filter((id) => editor.getShape(id)?.type === "window");
  return {
    id: frame.id,
    title: frame.props.name,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    windowIds,
  };
}

export function listSections(editor: Editor): SectionInfo[] {
  return editor
    .getCurrentPageShapesSorted()
    .filter((s): s is TLFrameShape => s.type === "frame")
    .map((f) => frameInfo(editor, f));
}

export function getSection(editor: Editor, id: TLShapeId): SectionInfo | null {
  const s = editor.getShape(id);
  return s?.type === "frame" ? frameInfo(editor, s as TLFrameShape) : null;
}

/** The union of the shapes' page bounds. */
export function unionBounds(editor: Editor, ids: TLShapeId[]): Box | null {
  const boxes = ids
    .map((id) => editor.getShapePageBounds(id))
    .filter((b): b is Box => b !== undefined);
  if (!boxes.length) return null;
  return boxes.reduce((a, b) => a.clone().union(b));
}

/**
 * Creates a frame titled `title` around `windowIds` (or at `rect`) and
 * reparents the windows into it. Windows keep their page positions.
 */
export function createSection(
  editor: Editor,
  title: string,
  windowIds: TLShapeId[],
  rect?: Rect
): TLShapeId {
  const shapes = windowIds.filter((id) => editor.getShape(id));
  const union = rect
    ? new Box(rect.x, rect.y, rect.w, rect.h)
    : (unionBounds(editor, shapes) ?? editor.getViewportPageBounds().clone());
  const box = rect ? union : union.clone().expandBy(SECTION_PADDING);
  if (!rect) {
    box.y -= SECTION_HEADER;
    box.h += SECTION_HEADER;
  }
  const id = createShapeId();
  editor.run(() => {
    editor.markHistoryStoppingPoint("create section");
    editor.createShape<TLFrameShape>({
      id,
      type: "frame",
      x: box.x,
      y: box.y,
      props: { w: box.w, h: box.h, name: title, color: "black" },
    });
    if (shapes.length) editor.reparentShapes(shapes, id);
    // Frames sit behind their children; keep the frame at the back of the page.
    editor.sendToBack([id]);
  });
  return id;
}

/** Moves windows into a section (or out to the page when `sectionId` is null). */
export function moveToSection(
  editor: Editor,
  windowIds: TLShapeId[],
  sectionId: TLShapeId | null
): void {
  const ids = windowIds.filter((id) => editor.getShape(id));
  if (!ids.length) return;
  editor.reparentShapes(ids, sectionId ?? editor.getCurrentPageId());
}

/** Deletes a section frame; its windows stay on the page (default) or go with it. */
export function removeSection(
  editor: Editor,
  sectionId: TLShapeId,
  { keepWindows = true } = {}
): boolean {
  const frame = editor.getShape(sectionId);
  if (frame?.type !== "frame") return false;
  editor.run(() => {
    if (keepWindows) {
      const children = editor.getSortedChildIdsForParent(sectionId);
      if (children.length)
        editor.reparentShapes(children, editor.getCurrentPageId());
    }
    editor.deleteShape(sectionId);
  });
  return true;
}
