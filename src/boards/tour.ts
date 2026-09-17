/**
 * Tour mode as a value: which board, which step, and how to move. The
 * desktop's controller animates the camera and highlights the section; this
 * file only knows the rules, so it is unit tested in Node.
 */
import { tourSteps, type BoardDef, type BoardStepSpec } from "./model";

export interface TourState {
  board: string;
  title: string;
  step: number;
  total: number;
}

export interface TourStepInfo extends TourState {
  section: string;
  sectionTitle: string;
  stepTitle: string;
  caption: string;
  first: boolean;
  last: boolean;
}

export function startTour(board: BoardDef, step = 0): TourState | null {
  const steps = tourSteps(board);
  if (!steps.length) return null;
  return {
    board: board.name,
    title: board.title,
    step: Math.min(Math.max(0, step), steps.length - 1),
    total: steps.length,
  };
}

/** The state after moving `delta` steps, or null when the tour ran off the end (stop). */
export function moveTour(state: TourState, delta: number): TourState | null {
  const next = state.step + Math.trunc(delta);
  if (next >= state.total) return null;
  return { ...state, step: Math.max(0, next) };
}

export function describeStep(board: BoardDef, state: TourState): TourStepInfo {
  const steps = tourSteps(board);
  const s: BoardStepSpec = steps[state.step] ?? steps[0];
  const section = board.sections.find((x) => x.id === s.section);
  return {
    ...state,
    section: s.section,
    sectionTitle: section?.title ?? s.section,
    stepTitle: s.title ?? section?.title ?? s.section,
    caption: s.caption,
    first: state.step === 0,
    last: state.step === state.total - 1,
  };
}

/** Keys that drive a tour: next, previous or stop. */
export function tourKeyAction(key: string): "next" | "prev" | "stop" | null {
  switch (key) {
    case "ArrowRight":
    case "PageDown":
    case " ":
    case "Enter":
      return "next";
    case "ArrowLeft":
    case "PageUp":
      return "prev";
    case "Escape":
      return "stop";
    default:
      return null;
  }
}
