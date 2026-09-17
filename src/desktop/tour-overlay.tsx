"use client";

import { useEditor, useValue } from "tldraw";
import { getTourController } from "@/boards/tour-controller";
import type { Rect } from "@/wm/types";

/**
 * Screen-space overlay for tour mode: a glowing frame around the active
 * section (follows the camera) and a caption card with the step, its title,
 * text and previous / next / exit controls.
 */
export function TourOverlay() {
  const editor = useEditor();
  const tour = getTourController(editor);
  const state = useValue(tour.state);
  // Re-render on camera moves so the highlight follows the section.
  useValue("camera", () => editor.getCamera(), [editor]);
  if (!state) return null;

  const toScreen = (rect: Rect) => {
    const z = editor.getZoomLevel();
    const p = editor.pageToViewport({ x: rect.x, y: rect.y });
    return { left: p.x, top: p.y, width: rect.w * z, height: rect.h * z };
  };

  return (
    <div className="pos-tour" data-testid="tour-overlay" data-step={state.step}>
      {state.bounds && (
        <div
          className="pos-tour__highlight"
          data-testid="tour-highlight"
          style={toScreen(state.bounds)}
        />
      )}
      <div className="pos-tour__caption" data-testid="tour-caption">
        <div className="pos-tour__meta">
          <span className="pos-tour__board">{state.title}</span>
          <span className="pos-tour__count">
            {state.step + 1} / {state.total}
          </span>
        </div>
        <div className="pos-tour__title">{state.stepTitle}</div>
        {state.caption && <p className="pos-tour__text">{state.caption}</p>}
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
          <button
            type="button"
            className="pos-button pos-button--small pos-button--primary"
            data-testid="tour-next"
            onClick={() => tour.step(1)}
          >
            {state.last ? "Finish" : "Next →"}
          </button>
          <button
            type="button"
            className="pos-button pos-button--small"
            data-testid="tour-stop"
            title="Exit the tour (Esc)"
            onClick={() => tour.stop()}
          >
            Exit
          </button>
          <span className="pos-tour__hint">← → keys, Esc</span>
        </div>
      </div>
    </div>
  );
}
