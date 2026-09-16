"use client";

import { useRef } from "react";
import { useEditor, useValue } from "tldraw";
import { findNode } from "@/wm/tree";
import type { Gutter, LayoutFrames, LayoutNode, Rect } from "@/wm/types";
import type { WindowManager } from "@/wm/window-manager";
import { useWindowManager } from "./use-window-manager";

const GUTTER_MIN_PX = 8;

/**
 * Screen-space overlay in front of the canvas: resize gutters between tiled
 * windows and the drop-zone hint while a window is dragged.
 */
export function WmOverlay() {
  const editor = useEditor();
  const wm = useWindowManager();
  const frames = useValue(wm.frames);
  const hint = useValue(wm.dropHint);
  const translating = useValue(
    "translating",
    () => editor.isIn("select.translating"),
    [editor]
  );
  // Re-render on camera moves so the page->screen mapping stays fresh.
  useValue("camera", () => editor.getCamera(), [editor]);

  const toScreen = (rect: Rect) => {
    const z = editor.getZoomLevel();
    const p = editor.pageToViewport({ x: rect.x, y: rect.y });
    return { x: p.x, y: p.y, w: rect.w * z, h: rect.h * z };
  };

  return (
    <div className="pos-wm-overlay" data-testid="wm-overlay">
      {frames.gutters.map((g) => (
        <GutterHandle
          key={`${g.splitId}:${g.index}`}
          gutter={g}
          frames={frames}
          wm={wm}
          screen={toScreen(g.rect)}
        />
      ))}
      {hint && translating && (
        <div
          className="pos-drop-hint"
          data-testid="drop-hint"
          data-zone={hint.zone}
          style={rectStyle(toScreen(hint.rect))}
        />
      )}
    </div>
  );
}

function rectStyle(r: Rect) {
  return { left: r.x, top: r.y, width: r.w, height: r.h };
}

function GutterHandle({
  gutter,
  frames,
  wm,
  screen,
}: {
  gutter: Gutter;
  frames: LayoutFrames;
  wm: WindowManager;
  screen: Rect;
}) {
  const drag = useRef<{
    start: number;
    along: number;
    base: LayoutNode | null;
  } | null>(null);
  const horizontal = gutter.direction === "horizontal";

  // Make thin gaps grabbable without changing the layout.
  const rect: Rect = horizontal
    ? screen.w >= GUTTER_MIN_PX
      ? screen
      : {
          ...screen,
          x: screen.x - (GUTTER_MIN_PX - screen.w) / 2,
          w: GUTTER_MIN_PX,
        }
    : screen.h >= GUTTER_MIN_PX
      ? screen
      : {
          ...screen,
          y: screen.y - (GUTTER_MIN_PX - screen.h) / 2,
          h: GUTTER_MIN_PX,
        };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const splitRect = frames.nodes.get(gutter.splitId);
    const split = findNode(wm.root.get(), gutter.splitId);
    if (!splitRect || !split || split.type !== "split") return;
    const n = split.children.length;
    const along =
      (horizontal ? splitRect.w : splitRect.h) - wm.options.gap * (n - 1);
    if (along <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    wm.editor.markHistoryStoppingPoint("wm resize");
    drag.current = {
      start: horizontal ? e.clientX : e.clientY,
      along,
      base: wm.root.get(),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const screenDelta = (horizontal ? e.clientX : e.clientY) - d.start;
    const pageDelta = screenDelta / wm.editor.getZoomLevel();
    wm.resizeSplit(gutter.splitId, gutter.index, pageDelta / d.along, d.base);
  };

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
  };

  return (
    <div
      className="pos-gutter"
      data-testid="gutter"
      data-direction={gutter.direction}
      style={rectStyle(rect)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}
