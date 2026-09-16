/**
 * Window manager types (milestone M1). The layout engine that consumes these
 * does not exist yet; the types are here so the desktop can be written
 * against them.
 */

import type { TLShapeId } from "tldraw";

/** How a container arranges its children. */
export type LayoutKind = "free" | "columns" | "grid" | "bento" | "split";

export type SplitDirection = "row" | "column";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A leaf holds exactly one Window shape. */
export interface LayoutLeaf {
  type: "leaf";
  id: string;
  windowId: TLShapeId;
}

/** A binary split, as in i3 / bspwm. `ratio` is the share of the first child. */
export interface LayoutSplit {
  type: "split";
  id: string;
  direction: SplitDirection;
  ratio: number;
  children: [LayoutNode, LayoutNode];
}

/** A flat container arranged by a non-tree layout (columns, grid, bento, free). */
export interface LayoutContainer {
  type: "container";
  id: string;
  layout: Exclude<LayoutKind, "split">;
  children: LayoutNode[];
}

export type LayoutNode = LayoutLeaf | LayoutSplit | LayoutContainer;

/** A named region of the canvas with its own layout tree. */
export interface Workspace {
  id: string;
  name: string;
  bounds: Rect;
  root: LayoutNode | null;
  createdAt: number;
}
