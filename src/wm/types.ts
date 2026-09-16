/**
 * Window manager types (milestone M1).
 *
 * The layout engine is pure TypeScript: it knows nothing about tldraw. Window
 * ids are plain strings here; the desktop passes tldraw shape ids through.
 */

export type WindowId = string;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * `horizontal`: children sit side by side (left to right).
 * `vertical`: children are stacked (top to bottom).
 */
export type SplitDirection = "horizontal" | "vertical";

export type Side = "left" | "right" | "top" | "bottom";

/** Where a dragged window is over a tiled one. */
export type DropZone = Side | "center";

/** A leaf holds exactly one window. */
export interface LayoutLeaf {
  type: "leaf";
  id: string;
  windowId: WindowId;
}

/** An n-ary split. `ratios[i]` is child i's share of the split; they sum to 1. */
export interface LayoutSplit {
  type: "split";
  id: string;
  direction: SplitDirection;
  children: LayoutNode[];
  ratios: number[];
}

/** A rows x cols grid filled in reading order. */
export interface LayoutGrid {
  type: "grid";
  id: string;
  rows: number;
  cols: number;
  children: LayoutNode[];
}

export type LayoutNode = LayoutLeaf | LayoutSplit | LayoutGrid;

export type LayoutPreset =
  | "free"
  | "columns"
  | "grid"
  | "bento-1-2"
  | "bento-2-1"
  | "bento-mosaic"
  | "split-tree";

export interface LayoutOptions {
  /** Space between windows, in page units. */
  gap: number;
  /** Space between the region edge and the outermost windows. */
  padding: number;
  /** Smallest size a window should get. Ratios are adjusted to respect it when the region allows. */
  minSize: Size;
}

/** The gap between two neighbouring children of a split; dragging it changes their ratio. */
export interface Gutter {
  splitId: string;
  /** The gutter sits after child `index`. */
  index: number;
  direction: SplitDirection;
  rect: Rect;
}

/** Everything a layout pass produces. */
export interface LayoutFrames {
  windows: Map<WindowId, Rect>;
  nodes: Map<string, Rect>;
  gutters: Gutter[];
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

/** A named, saved arrangement: layout tree, windows, region and camera. */
export interface Workspace {
  id: string;
  name: string;
  preset: LayoutPreset;
  root: LayoutNode | null;
  windowIds: WindowId[];
  region: Rect | null;
  camera: Camera | null;
  createdAt: number;
  updatedAt: number;
}
