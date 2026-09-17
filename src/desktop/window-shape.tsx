"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BaseBoxShapeUtil,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  HTMLContainer,
  RecordProps,
  resizeBox,
  stopEventPropagation,
  T,
  TLBaseShape,
  TLResizeInfo,
  TLShapePartial,
  useEditor,
  useValue,
} from "tldraw";
import { DETACH_DISTANCE, getWindowManager } from "@/wm/window-manager";
import { useWindowManager } from "./use-window-manager";
import { getWindowKind, windowKindsChanged } from "./window-kinds";
import { useSignal } from "@/ide/use-signal";
import { WindowMenu } from "./window-menu";

export interface WindowShapeProps {
  w: number;
  h: number;
  title: string;
  kind: string;
  content: string;
  /** Managed by the window manager: position and size come from the layout. */
  tiled: boolean;
}

export type WindowShape = TLBaseShape<"window", WindowShapeProps>;

export const WINDOW_MIN = { w: 240, h: 160 } as const;
export const WINDOW_DEFAULT = { w: 480, h: 320 } as const;

const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 8;

const versions = createShapePropsMigrationIds("window", { AddTiled: 1 });

export const windowShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: versions.AddTiled,
      up: (props) => {
        props.tiled = false;
      },
      down: (props) => {
        delete props.tiled;
      },
    },
  ],
});

export class WindowShapeUtil extends BaseBoxShapeUtil<WindowShape> {
  static override type = "window" as const;

  static override props: RecordProps<WindowShape> = {
    w: T.number,
    h: T.number,
    title: T.string,
    kind: T.string,
    content: T.string,
    tiled: T.boolean,
  };

  static override migrations = windowShapeMigrations;

  getDefaultProps(): WindowShapeProps {
    return {
      w: WINDOW_DEFAULT.w,
      h: WINDOW_DEFAULT.h,
      title: "Window",
      kind: "note",
      content: "",
      tiled: false,
    };
  }

  override canEdit() {
    return false;
  }

  override hideRotateHandle() {
    return true;
  }

  override isAspectRatioLocked() {
    return false;
  }

  /** Tiled windows are sized by the layout; drag the gutters instead. */
  override canResize(shape: WindowShape) {
    return !shape.props.tiled;
  }

  override onResize(shape: WindowShape, info: TLResizeInfo<WindowShape>) {
    return resizeBox(shape, info, {
      minWidth: WINDOW_MIN.w,
      minHeight: WINDOW_MIN.h,
    });
  }

  /**
   * tldraw creates a text shape when a non-editable shape is double-clicked
   * unless the util handles it. Handle it (a no-op change) so double-clicking
   * a window never litters the canvas; renaming is in the window menu.
   */
  override onDoubleClick(shape: WindowShape): TLShapePartial<WindowShape> {
    return { id: shape.id, type: "window" };
  }

  override onTranslateStart() {
    getWindowManager(this.editor).dropHint.set(null);
  }

  override onTranslate(
    initial: WindowShape,
    current: WindowShape
  ): TLShapePartial<WindowShape> | void {
    const wm = getWindowManager(this.editor);
    if (current.props.tiled) {
      const moved = Math.hypot(current.x - initial.x, current.y - initial.y);
      if (moved < DETACH_DISTANCE) return;
      wm.detach(current.id);
      return { id: current.id, type: "window", props: { tiled: false } };
    }
    wm.updateDropHint(current.id, this.editor.inputs.currentPagePoint);
  }

  override onTranslateEnd(initial: WindowShape, current: WindowShape) {
    const wm = getWindowManager(this.editor);
    wm.dropWindow(current.id, { x: initial.x, y: initial.y });
  }

  component(shape: WindowShape) {
    return <WindowFrame shape={shape} />;
  }

  /**
   * Export (and `paperos.canvas.screenshot()`): a frame with the title bar.
   * Bodies are live HTML and are not rendered, except plain-text kinds (note,
   * script) whose first lines are drawn.
   */
  override toSvg(shape: WindowShape) {
    const { w, h, title, kind, tiled, content } = shape.props;
    const r = tiled ? 4 : 10;
    const label = `${getWindowKind(kind)?.icon ?? ""} ${title}`.trim();
    const textual = kind === "note" || kind === "script";
    const lineHeight = 18;
    const lines = textual
      ? content
          .split("\n")
          .slice(0, Math.max(0, Math.floor((h - 52) / lineHeight)))
          .map((l) =>
            l.length > w / 7 ? l.slice(0, Math.max(3, w / 7 - 1)) + "…" : l
          )
      : [];
    return (
      <g>
        <rect
          width={w}
          height={h}
          rx={r}
          ry={r}
          fill="#f7f7fb"
          stroke="#c9c9d6"
        />
        <path
          d={`M0 ${r} A${r} ${r} 0 0 1 ${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V32 H0 Z`}
          fill="#ececf3"
        />
        <line x1="0" y1="32" x2={w} y2="32" stroke="#c9c9d6" />
        <text
          x="12"
          y="21"
          fontFamily="system-ui, sans-serif"
          fontSize="13"
          fontWeight="600"
          fill="#232333"
        >
          {label.length > w / 8
            ? label.slice(0, Math.max(3, w / 8 - 1)) + "…"
            : label}
        </text>
        {textual ? (
          lines.map((line, i) => (
            <text
              key={i}
              x="12"
              y={52 + i * lineHeight}
              fontFamily={
                kind === "script"
                  ? "ui-monospace, monospace"
                  : "system-ui, sans-serif"
              }
              fontSize="12"
              fill="#232333"
              xmlSpace="preserve"
            >
              {line}
            </text>
          ))
        ) : (
          <text
            x={w / 2}
            y={h / 2 + 4}
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="12"
            fill="#8a8a9a"
          >
            {kind}
          </text>
        )}
      </g>
    );
  }

  indicator(shape: WindowShape) {
    const r = shape.props.tiled ? 4 : 10;
    return <rect width={shape.props.w} height={shape.props.h} rx={r} ry={r} />;
  }
}

/**
 * Viewport culling for heavy kinds: far off screen (more than 3/4 of a
 * viewport away) or below 10% zoom the body is a placeholder; it renders
 * again within 1/4 of a viewport and above 14% zoom. The gap between the two
 * thresholds keeps a window from flickering while panning or zooming.
 */
export const CULL_ZOOM_OUT = 0.1;
export const CULL_ZOOM_IN = 0.14;

function useCulled(
  editor: ReturnType<typeof useEditor>,
  shape: WindowShape,
  heavy: boolean
) {
  const [culled, setCulled] = useState(false);
  const zone = useValue(
    "window cull zone",
    (): "far" | "near" | "between" | null => {
      if (!heavy) return null;
      const zoom = editor.getZoomLevel();
      const vb = editor.getViewportPageBounds();
      const b = editor.getShapePageBounds(shape.id);
      if (!b) return null;
      const reach = Math.max(vb.w, vb.h);
      if (
        zoom < CULL_ZOOM_OUT ||
        !vb
          .clone()
          .expandBy(reach * 0.75)
          .collides(b)
      )
        return "far";
      if (
        zoom > CULL_ZOOM_IN &&
        vb
          .clone()
          .expandBy(reach * 0.25)
          .collides(b)
      )
        return "near";
      return "between";
    },
    [editor, shape.id, heavy]
  );
  useEffect(() => {
    if (zone === "far") setCulled(true);
    else if (zone === "near" || zone === null) setCulled(false);
  }, [zone]);
  return heavy && culled;
}

function WindowFrame({ shape }: { shape: WindowShape }) {
  const editor = useEditor();
  const wm = useWindowManager();
  useSignal(windowKindsChanged);
  const kind = getWindowKind(shape.props.kind);
  const culled = useCulled(editor, shape, kind?.heavy === true);
  const focused = useValue(
    "window focused",
    () => wm.focusedId.get() === shape.id,
    [wm, shape.id]
  );
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const editingTitle = useValue(
    "editing title",
    () => wm.titleEditId.get() === shape.id,
    [wm, shape.id]
  );
  const stopEditingTitle = () => {
    if (wm.titleEditId.get() === shape.id) wm.titleEditId.set(null);
  };

  const update = (patch: Partial<WindowShapeProps>) => {
    editor.updateShape<WindowShape>({
      id: shape.id,
      type: "window",
      props: patch,
    });
  };

  const focus = () => wm.focusWindow(shape.id, { select: false });
  const close = () => editor.deleteShape(shape.id);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openMenu = (at: { x: number; y: number } | null) => {
    setMenuAt(at);
    setMenuOpen(true);
  };

  const longPress = useLongPress((point) => {
    const el = frameRef.current;
    if (!el) return openMenu(null);
    const box = el.getBoundingClientRect();
    const zoom = editor.getZoomLevel();
    openMenu({ x: (point.x - box.left) / zoom, y: (point.y - box.top) / zoom });
  });
  const frameRef = useRef<HTMLDivElement>(null);

  return (
    <HTMLContainer
      className="pos-window"
      data-testid="window"
      data-kind={shape.props.kind}
      data-tiled={shape.props.tiled}
      data-focused={focused}
      style={{ pointerEvents: "all" }}
      onPointerDownCapture={focus}
    >
      <div ref={frameRef} className="pos-window__frame">
        <div className="pos-window__titlebar" {...longPress}>
          {editingTitle ? (
            <TitleEditor
              value={shape.props.title}
              onCommit={(title) => {
                stopEditingTitle();
                if (title.trim()) update({ title: title.trim() });
              }}
              onCancel={stopEditingTitle}
            />
          ) : (
            <span className="pos-window__title" title={shape.props.title}>
              {kind?.icon && (
                <span className="pos-window__icon" aria-hidden="true">
                  {kind.icon}
                </span>
              )}
              {shape.props.title}
            </span>
          )}
          <div className="pos-window__controls">
            <button
              type="button"
              className="pos-window__button pos-window__connect"
              aria-label="Connect: drag an arrow to another window"
              title="Connect: drag to another window"
              data-testid="window-connect"
              // Switch to the arrow tool and let the pointer event reach the
              // canvas, so the drag that follows draws an arrow bound to this window.
              onPointerDown={() => editor.setCurrentTool("arrow")}
            >
              <svg
                viewBox="0 0 12 12"
                width="12"
                height="12"
                aria-hidden="true"
              >
                <path
                  d="M2 10 10 2M5 2h5v5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="pos-window__button"
              aria-label="Window menu"
              title="Window menu"
              data-testid="window-menu-button"
              onPointerDown={stopEventPropagation}
              onClick={() => (menuOpen ? closeMenu() : openMenu(null))}
            >
              <svg
                viewBox="0 0 12 12"
                width="12"
                height="12"
                aria-hidden="true"
              >
                <circle cx="2" cy="6" r="1.2" fill="currentColor" />
                <circle cx="6" cy="6" r="1.2" fill="currentColor" />
                <circle cx="10" cy="6" r="1.2" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="pos-window__button pos-window__close"
              aria-label="Close window"
              title="Close"
              onPointerDown={stopEventPropagation}
              onClick={close}
            >
              <svg
                viewBox="0 0 12 12"
                width="10"
                height="10"
                aria-hidden="true"
              >
                <path
                  d="M2 2l8 8M10 2l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="pos-window__body">
          {culled ? (
            <div
              className="pos-window__placeholder"
              data-testid="window-placeholder"
            >
              <span className="pos-window__placeholder-icon" aria-hidden="true">
                {kind?.icon}
              </span>
              <strong>{shape.props.title}</strong>
              <small>Zoom in to render</small>
            </div>
          ) : kind ? (
            <kind.Component shape={shape} editor={editor} update={update} />
          ) : (
            <div className="pos-about pos-about__muted">
              Unknown window kind: {shape.props.kind}
            </div>
          )}
        </div>
        {menuOpen && (
          <WindowMenu shape={shape} wm={wm} at={menuAt} onClose={closeMenu} />
        )}
      </div>
    </HTMLContainer>
  );
}

function TitleEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      className="pos-window__title-input"
      value={draft}
      autoFocus
      aria-label="Window title"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onPointerDown={stopEventPropagation}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onCommit(draft);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onCommit(draft)}
    />
  );
}

/** Pointer handlers that fire `onLongPress` after a still press (touch context menu). */
function useLongPress(onLongPress: (point: { x: number; y: number }) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    cancel();
    const point = { x: e.clientX, y: e.clientY };
    start.current = point;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (start.current) onLongPress(start.current);
      start.current = null;
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (
      Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) >
      LONG_PRESS_SLOP
    ) {
      cancel();
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  };
}
