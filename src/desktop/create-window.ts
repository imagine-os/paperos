import { createShapeId, Editor, TLShapeId } from "tldraw";
import { cascadePosition } from "./cascade";
import { getWindowKind } from "./window-kinds";
import { WINDOW_DEFAULT, WindowShape } from "./window-shape";

export interface CreateWindowOptions {
  /** Top-left corner in page space. Defaults to the viewport center. */
  at?: { x: number; y: number };
  kind?: string;
  title?: string;
  content?: string;
}

/** Creates a Window shape, cascading it off any window already at that spot, and selects it. */
export function createWindow(
  editor: Editor,
  options: CreateWindowOptions = {}
): TLShapeId {
  const kindId = options.kind ?? "note";
  const kind = getWindowKind(kindId);
  const { w, h } = kind?.defaultSize ?? WINDOW_DEFAULT;

  const wanted = options.at ?? {
    x: editor.getViewportPageBounds().center.x - w / 2,
    y: editor.getViewportPageBounds().center.y - h / 2,
  };

  const occupied = editor
    .getCurrentPageShapes()
    .filter((s) => s.type === "window")
    .map((s) => ({ x: s.x, y: s.y }));

  const { x, y } = cascadePosition(occupied, wanted);
  const id = createShapeId();

  editor.createShape<WindowShape>({
    id,
    type: "window",
    x,
    y,
    props: {
      w,
      h,
      title: options.title ?? kind?.defaultTitle ?? "Window",
      kind: kindId,
      content: options.content ?? "",
    },
  });
  editor.select(id);
  return id;
}
