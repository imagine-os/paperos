/**
 * Tour mode on the desktop: "Play board" steps the camera section by
 * section (animated zoomToBounds), highlights the active section and its
 * arrows, and listens for the arrow keys. State lives in a tldraw atom so
 * the overlay (`src/desktop/tour-overlay.tsx`) re-renders with it; the rules
 * are in `tour.ts`.
 */
import { atom, type Editor, type TLArrowShape, type TLShapeId } from "tldraw";
import { runCommand } from "@/ide/commands";
import { motionMs } from "@/lib/motion";
import type { Rect } from "@/wm/types";
import {
  BOARD_COLOR_META,
  boardSectionArrows,
  boardSectionBounds,
  boardShapes,
} from "./build";
import type { BoardDef } from "./model";
import {
  describeStep,
  moveTour,
  startTour,
  stepCommand,
  tourKeyAction,
  type TourState,
  type TourStepInfo,
} from "./tour";

export interface TourRuntime extends TourStepInfo {
  /** Page bounds of the active section's frame (null when it is gone). */
  bounds: Rect | null;
}

export const TOUR_ANIMATION_MS = 600;

/** Camera moves are instant when the person asked for reduced motion. */
export function tourAnimationMs(): number {
  return motionMs(TOUR_ANIMATION_MS);
}

export class TourController {
  readonly state = atom<TourRuntime | null>("tour.state", null);
  private board: BoardDef | null = null;
  private tour: TourState | null = null;
  private highlighted: TLShapeId[] = [];
  private offKeys: (() => void) | null = null;

  constructor(readonly editor: Editor) {}

  get current(): TourRuntime | null {
    return this.state.get();
  }

  play(board: BoardDef, step = 0): TourRuntime | null {
    this.stop({ keepCamera: true });
    const tour = startTour(board, step);
    if (!tour) return null;
    this.board = board;
    this.tour = tour;
    this.listen();
    return this.show({ animate: true });
  }

  /** Moves `delta` steps; running off the end stops the tour. */
  step(delta = 1): TourRuntime | null {
    if (!this.board || !this.tour) return null;
    const next = moveTour(this.tour, delta);
    if (!next) {
      this.stop();
      return null;
    }
    this.tour = next;
    return this.show({ animate: true });
  }

  goTo(step: number): TourRuntime | null {
    if (!this.board || !this.tour) return null;
    this.tour = {
      ...this.tour,
      step: Math.min(Math.max(0, step), this.tour.total - 1),
    };
    return this.show({ animate: true });
  }

  /** Runs the step's closing action (a command) and ends the tour. */
  async finish(): Promise<boolean> {
    const action = this.state.get()?.action;
    this.stop();
    if (!action) return false;
    await runCommand(action.command);
    return true;
  }

  stop({ keepCamera = false }: { keepCamera?: boolean } = {}): boolean {
    const was = this.tour !== null;
    this.unhighlight();
    this.offKeys?.();
    this.offKeys = null;
    this.board = null;
    this.tour = null;
    this.state.set(null);
    void keepCamera;
    return was;
  }

  dispose() {
    this.stop({ keepCamera: true });
  }

  /**
   * Shows the current step: runs its command first when it has one (the
   * caption appears at once, the camera follows when the command is done),
   * zooms to the section unless the step frames a chrome element, and
   * highlights the section's arrows.
   */
  private show({ animate }: { animate: boolean }): TourRuntime | null {
    if (!this.board || !this.tour) return null;
    const tour = this.tour;
    const info = describeStep(this.board, tour);
    const command = stepCommand(this.board, tour);
    const place = (): TourRuntime | null => {
      if (this.tour !== tour) return null;
      const bounds = info.target
        ? null
        : boardSectionBounds(this.editor, info.sectionBoard, info.section);
      if (bounds) {
        const ms = tourAnimationMs();
        this.editor.zoomToBounds(bounds, {
          inset: 56,
          animation: animate && ms > 0 ? { duration: ms } : undefined,
        });
      }
      this.highlight(info.sectionBoard, info.section);
      const runtime: TourRuntime = { ...info, bounds };
      this.state.set(runtime);
      return runtime;
    };
    if (!command) return place();
    this.unhighlight();
    const pending: TourRuntime = { ...info, bounds: null };
    this.state.set(pending);
    void runCommand(command).then(place, place);
    return pending;
  }

  /** The active section's arrows turn orange and thicker; the rest go back to their board color. */
  private highlight(boardName: string, sectionId: string) {
    this.unhighlight();
    const ids = boardSectionArrows(this.editor, boardName, sectionId);
    if (!ids.length) return;
    this.editor.run(
      () => {
        this.editor.updateShapes<TLArrowShape>(
          ids.map((id) => ({
            id,
            type: "arrow",
            props: { color: "orange", size: "m" },
          }))
        );
      },
      { history: "ignore" }
    );
    this.highlighted = ids;
  }

  private unhighlight() {
    if (!this.highlighted.length) return;
    const partials: {
      id: TLShapeId;
      type: "arrow";
      props: { color: TLArrowShape["props"]["color"]; size: "s" };
    }[] = [];
    for (const id of this.highlighted) {
      const shape = this.editor.getShape(id);
      if (!shape || shape.type !== "arrow") continue;
      const color = shape.meta[BOARD_COLOR_META];
      partials.push({
        id,
        type: "arrow",
        props: {
          color: (typeof color === "string"
            ? color
            : "black") as TLArrowShape["props"]["color"],
          size: "s",
        },
      });
    }
    if (partials.length)
      this.editor.run(() => this.editor.updateShapes(partials), {
        history: "ignore",
      });
    this.highlighted = [];
  }

  private listen() {
    if (typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (!this.tour) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable ||
          t.closest?.(".cm-editor"))
      )
        return;
      const action = tourKeyAction(e.key);
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (action === "next") this.step(1);
      else if (action === "prev") this.step(-1);
      else this.stop();
    };
    document.addEventListener("keydown", onKey, true);
    this.offKeys = () => document.removeEventListener("keydown", onKey, true);
  }
}

const controllers = new WeakMap<Editor, TourController>();

export function getTourController(editor: Editor): TourController {
  let c = controllers.get(editor);
  if (!c) {
    c = new TourController(editor);
    controllers.set(editor, c);
    editor.disposables.add(() => {
      c?.dispose();
      controllers.delete(editor);
    });
  }
  return c;
}

/** True when the board's frames are on the page (a tour needs them). */
export function boardIsOnCanvas(editor: Editor, name: string): boolean {
  return boardShapes(editor, name).frames.length > 0;
}
