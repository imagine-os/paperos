/**
 * Flows: tldraw arrows bound to Window shapes, so the canvas can show how
 * tables, files, components and pages connect. Arrows are tldraw's own
 * shape with its own bindings: they follow the windows they connect, can
 * be drawn by hand with the arrow tool (windows bind natively) and carry a
 * text label.
 */
import {
  createBindingId,
  createShapeId,
  getArrowBindings,
  type Editor,
  type TLArrowBinding,
  type TLArrowShape,
  type TLShapeId,
} from "tldraw";

export interface FlowInfo {
  id: string;
  from: string | null;
  to: string | null;
  label: string;
}

export interface ConnectOptions {
  label?: string;
  /** `arc` (default) or `elbow`. */
  kind?: "arc" | "elbow";
  color?: TLArrowShape["props"]["color"];
  /** Curvature of an arc arrow (0 = straight); two-way links use it to stay apart. */
  bend?: number;
  /** Extra data kept on the arrow (map edges record their key here). */
  meta?: Record<string, string | number | boolean | null>;
}

function center(editor: Editor, id: TLShapeId) {
  const b = editor.getShapePageBounds(id);
  return b ? { x: b.midX, y: b.midY } : { x: 0, y: 0 };
}

/** Creates an arrow from one window to another and binds both ends. */
export function connectWindows(
  editor: Editor,
  from: TLShapeId,
  to: TLShapeId,
  options: ConnectOptions = {}
): TLShapeId {
  const a = center(editor, from);
  const b = center(editor, to);
  const id = createShapeId();
  editor.run(() => {
    editor.markHistoryStoppingPoint("connect windows");
    editor.createShape<TLArrowShape>({
      id,
      type: "arrow",
      x: a.x,
      y: a.y,
      ...(options.meta ? { meta: options.meta } : {}),
      props: {
        start: { x: 0, y: 0 },
        end: { x: b.x - a.x, y: b.y - a.y },
        text: options.label ?? "",
        bend: options.bend ?? 0,
        kind: options.kind ?? "arc",
        color: options.color ?? "black",
        size: "s",
        arrowheadStart: "none",
        arrowheadEnd: "arrow",
      },
    });
    const bind = (terminal: "start" | "end", toId: TLShapeId) =>
      editor.createBinding<TLArrowBinding>({
        id: createBindingId(),
        type: "arrow",
        fromId: id,
        toId,
        props: {
          terminal,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
          isPrecise: false,
          snap: "none",
        },
      });
    bind("start", from);
    bind("end", to);
    editor.sendToBack([id]);
  });
  return id;
}

function flowInfo(editor: Editor, arrow: TLArrowShape): FlowInfo {
  const b = getArrowBindings(editor, arrow);
  return {
    id: arrow.id,
    from: b.start?.toId ?? null,
    to: b.end?.toId ?? null,
    label: arrow.props.text,
  };
}

/** Every arrow on the page that touches a window (hand-drawn or created by the API). */
export function listFlows(editor: Editor): FlowInfo[] {
  return editor
    .getCurrentPageShapesSorted()
    .filter((s): s is TLArrowShape => s.type === "arrow")
    .map((a) => flowInfo(editor, a))
    .filter(
      (f) =>
        (f.from && editor.getShape(f.from as TLShapeId)?.type === "window") ||
        (f.to && editor.getShape(f.to as TLShapeId)?.type === "window")
    );
}

/** Arrows between two windows, in either direction. */
export function findFlows(
  editor: Editor,
  from: TLShapeId,
  to: TLShapeId
): FlowInfo[] {
  return listFlows(editor).filter(
    (f) => (f.from === from && f.to === to) || (f.from === to && f.to === from)
  );
}

/** Deletes an arrow by id, or every arrow between two windows. */
export function disconnectWindows(
  editor: Editor,
  a: TLShapeId,
  b?: TLShapeId
): number {
  const ids = b
    ? findFlows(editor, a, b).map((f) => f.id as TLShapeId)
    : editor.getShape(a)?.type === "arrow"
      ? [a]
      : [];
  if (ids.length) editor.deleteShapes(ids);
  return ids.length;
}

export function relabelFlow(editor: Editor, id: TLShapeId, label: string) {
  if (editor.getShape(id)?.type !== "arrow") return;
  editor.updateShape<TLArrowShape>({
    id,
    type: "arrow",
    props: { text: label },
  });
}
