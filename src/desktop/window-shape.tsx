"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  resizeBox,
  stopEventPropagation,
  T,
  TLBaseShape,
  TLResizeInfo,
  useEditor,
} from "tldraw";
import { getWindowKind } from "./window-kinds";

export interface WindowShapeProps {
  w: number;
  h: number;
  title: string;
  kind: string;
  content: string;
}

export type WindowShape = TLBaseShape<"window", WindowShapeProps>;

export const WINDOW_MIN = { w: 240, h: 160 } as const;
export const WINDOW_DEFAULT = { w: 480, h: 320 } as const;

export class WindowShapeUtil extends BaseBoxShapeUtil<WindowShape> {
  static override type = "window" as const;

  static override props: RecordProps<WindowShape> = {
    w: T.number,
    h: T.number,
    title: T.string,
    kind: T.string,
    content: T.string,
  };

  getDefaultProps(): WindowShapeProps {
    return {
      w: WINDOW_DEFAULT.w,
      h: WINDOW_DEFAULT.h,
      title: "Window",
      kind: "note",
      content: "",
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

  override onResize(shape: WindowShape, info: TLResizeInfo<WindowShape>) {
    return resizeBox(shape, info, {
      minWidth: WINDOW_MIN.w,
      minHeight: WINDOW_MIN.h,
    });
  }

  component(shape: WindowShape) {
    return <WindowFrame shape={shape} />;
  }

  indicator(shape: WindowShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={10} ry={10} />
    );
  }
}

function WindowFrame({ shape }: { shape: WindowShape }) {
  const editor = useEditor();
  const kind = getWindowKind(shape.props.kind);

  const update = (patch: Partial<WindowShapeProps>) => {
    editor.updateShape<WindowShape>({
      id: shape.id,
      type: "window",
      props: patch,
    });
  };

  const focus = () => {
    const top = editor.getCurrentPageShapesSorted().at(-1);
    if (top?.id !== shape.id) editor.bringToFront([shape.id]);
  };

  const close = () => editor.deleteShape(shape.id);

  return (
    <HTMLContainer
      className="pos-window"
      data-testid="window"
      data-kind={shape.props.kind}
      style={{ pointerEvents: "all" }}
      onPointerDownCapture={focus}
    >
      <div className="pos-window__titlebar">
        <span className="pos-window__title" title={shape.props.title}>
          {shape.props.title}
        </span>
        <button
          type="button"
          className="pos-window__close"
          aria-label="Close window"
          title="Close"
          onPointerDown={stopEventPropagation}
          onClick={close}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="pos-window__body">
        {kind ? (
          <kind.Component shape={shape} editor={editor} update={update} />
        ) : (
          <div className="pos-about pos-about__muted">
            Unknown window kind: {shape.props.kind}
          </div>
        )}
      </div>
    </HTMLContainer>
  );
}
