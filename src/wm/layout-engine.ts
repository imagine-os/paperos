import type { Rect, Workspace } from "./types";
import type { TLShapeId } from "tldraw";

/** The result of laying out a workspace: where each window should go. */
export type LayoutResult = Map<TLShapeId, Rect>;

export interface LayoutEngine {
  layout(workspace: Workspace): LayoutResult;
}

/**
 * Placeholder until M1. Windows are free-floating for now, so the engine
 * proposes no positions.
 */
export function createLayoutEngine(): LayoutEngine {
  return {
    layout() {
      return new Map();
    },
  };
}
