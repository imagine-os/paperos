"use client";

import { useEffect, useRef } from "react";
import { stopEventPropagation } from "tldraw";
import type { Side } from "@/wm/types";
import type { WindowManager } from "@/wm/window-manager";
import { createWindow } from "./create-window";
import type { WindowShape } from "./window-shape";

export interface WindowMenuProps {
  shape: WindowShape;
  wm: WindowManager;
  /** Position inside the window frame, in shape pixels. */
  at: { x: number; y: number } | null;
  onClose: () => void;
}

const SIDES: { side: Side; label: string }[] = [
  { side: "left", label: "Tile left" },
  { side: "right", label: "Tile right" },
  { side: "top", label: "Tile top" },
  { side: "bottom", label: "Tile bottom" },
];

/** The per-window menu, opened from the "..." button or by long-pressing the title bar. */
export function WindowMenu({ shape, wm, at, onClose }: WindowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tiled = shape.props.tiled;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const duplicate = () => {
    const { editor } = wm;
    createWindow(editor, {
      kind: shape.props.kind,
      title: shape.props.title,
      content: shape.props.content,
      at: { x: shape.x + 28, y: shape.y + 28 },
    });
  };

  const style = at
    ? { left: Math.max(0, Math.min(at.x, shape.props.w - 190)), top: at.y }
    : { right: 6, top: 36 };

  return (
    <div
      ref={ref}
      className="pos-menu pos-window__menu"
      role="menu"
      data-testid="window-menu"
      style={style}
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <button
        type="button"
        role="menuitem"
        className="pos-menu__item"
        onClick={run(() => wm.toggleTile(shape.id))}
      >
        {tiled ? "Float" : "Tile"}
      </button>
      {SIDES.map(({ side, label }) => (
        <button
          key={side}
          type="button"
          role="menuitem"
          className="pos-menu__item"
          onClick={run(() => wm.tileWindow(shape.id, side))}
        >
          {label}
        </button>
      ))}
      <div className="pos-menu__separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="pos-menu__item"
        data-testid="window-rename"
        onClick={run(() => wm.titleEditId.set(shape.id))}
      >
        Rename...
      </button>
      <button
        type="button"
        role="menuitem"
        className="pos-menu__item"
        onClick={run(() => wm.focusMode(shape.id))}
      >
        Focus mode
      </button>
      <button
        type="button"
        role="menuitem"
        className="pos-menu__item"
        onClick={run(duplicate)}
      >
        Duplicate
      </button>
      <div className="pos-menu__separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="pos-menu__item pos-menu__item--danger"
        onClick={run(() => wm.editor.deleteShape(shape.id))}
      >
        Close
      </button>
    </div>
  );
}
