"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useValue, type Editor } from "tldraw";
import { getTourController } from "@/boards/tour-controller";

interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Screen-space overlay for tour mode: a glowing frame around the active
 * section (follows the camera) or around a chrome element the step names
 * (a top-bar button), and a caption card with the step, its title, text and
 * previous / next / exit controls. Rendered above the whole desktop, not
 * inside the canvas, so it can frame the top bar too.
 */
export function TourOverlay({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return <TourOverlayInner editor={editor} />;
}

function TourOverlayInner({ editor }: { editor: Editor }) {
  const tour = getTourController(editor);
  const state = useValue(tour.state);
  // Re-render on camera moves so the highlight follows the section.
  useValue("camera", () => editor.getCamera(), [editor]);
  const host = useRef<HTMLDivElement>(null);
  const [hostRect, setHostRect] = useState<DOMRect | null>(null);
  const [, bump] = useState(0);
  const active = state !== null;

  useLayoutEffect(() => {
    setHostRect(host.current?.getBoundingClientRect() ?? null);
  }, [active]);

  // Chrome targets move when the window resizes or the top bar wraps.
  useEffect(() => {
    if (!active) return;
    const on = () => {
      setHostRect(host.current?.getBoundingClientRect() ?? null);
      bump((n) => n + 1);
    };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [active]);

  if (!state) return null;

  const dx = hostRect?.left ?? 0;
  const dy = hostRect?.top ?? 0;
  let highlight: ScreenRect | null = null;
  if (state.target) {
    const el = document.querySelector(state.target);
    if (el) {
      const r = el.getBoundingClientRect();
      highlight = {
        left: r.left - dx - 6,
        top: r.top - dy - 6,
        width: r.width + 12,
        height: r.height + 12,
      };
    }
  } else if (state.bounds) {
    const z = editor.getZoomLevel();
    const p = editor.pageToViewport({ x: state.bounds.x, y: state.bounds.y });
    const c = editor.getContainer().getBoundingClientRect();
    highlight = {
      left: p.x + c.left - dx,
      top: p.y + c.top - dy,
      width: state.bounds.w * z,
      height: state.bounds.h * z,
    };
  }

  return (
    <div
      ref={host}
      className="pos-tour"
      data-testid="tour-overlay"
      data-step={state.step}
    >
      {highlight && (
        <div
          className="pos-tour__highlight"
          data-testid="tour-highlight"
          data-target={state.target ? "chrome" : "section"}
          style={highlight}
        />
      )}
      <div
        className="pos-tour__caption"
        data-testid="tour-caption"
        data-placement={state.target ? "top" : "bottom"}
        role="dialog"
        aria-label={`Tour: ${state.title}`}
      >
        <div className="pos-tour__meta">
          <span className="pos-tour__board">{state.title}</span>
          <span className="pos-tour__count">
            {state.step + 1} / {state.total}
          </span>
        </div>
        <div aria-live="polite">
          <div className="pos-tour__title">{state.stepTitle}</div>
          {state.caption && <p className="pos-tour__text">{state.caption}</p>}
        </div>
        <div className="pos-tour__controls">
          <button
            type="button"
            className="pos-button pos-button--small"
            disabled={state.first}
            data-testid="tour-prev"
            onClick={() => tour.step(-1)}
          >
            ← Previous
          </button>
          {(!state.last || !state.action) && (
            <button
              type="button"
              className={`pos-button pos-button--small${state.action ? "" : " pos-button--primary"}`}
              data-testid="tour-next"
              onClick={() => tour.step(1)}
            >
              {state.last ? "Finish" : "Next →"}
            </button>
          )}
          {state.action && (
            <button
              type="button"
              className="pos-button pos-button--small pos-button--primary"
              data-testid="tour-action"
              onClick={() => void tour.finish()}
            >
              {state.action.label}
            </button>
          )}
          <button
            type="button"
            className="pos-button pos-button--small"
            data-testid="tour-stop"
            title="Exit the tour (Esc)"
            onClick={() => tour.stop()}
          >
            {state.last && state.action ? "Finish" : "Exit"}
          </button>
          <span className="pos-tour__hint">← → keys, Esc</span>
        </div>
      </div>
    </div>
  );
}
