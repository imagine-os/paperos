import {
  collectLeaves,
  gridRows,
  leaf,
  nodeId,
  pruneTree,
  replaceNode,
  split,
} from "./tree";
import type {
  LayoutGrid,
  LayoutNode,
  LayoutPreset,
  SplitDirection,
  WindowId,
} from "./types";

export interface PresetOptions {
  /** Narrow viewports: columns collapse to one column, split trees stack. */
  narrow?: boolean;
}

export interface PresetInfo {
  id: LayoutPreset;
  label: string;
  group: "basic" | "bento" | "tree";
}

export const PRESETS: readonly PresetInfo[] = [
  { id: "free", label: "Free", group: "basic" },
  { id: "columns", label: "Columns", group: "basic" },
  { id: "grid", label: "Grid", group: "basic" },
  { id: "bento-1-2", label: "Bento: 1 + 2", group: "bento" },
  { id: "bento-2-1", label: "Bento: 2 + 1", group: "bento" },
  { id: "bento-mosaic", label: "Bento: mosaic", group: "bento" },
  { id: "split-tree", label: "Split tree", group: "tree" },
];

export function isPreset(value: string): value is LayoutPreset {
  return PRESETS.some((p) => p.id === value);
}

/** Presets that are a fixed shape for a set of windows (rebuilt when windows come and go). */
export function isFlatPreset(preset: LayoutPreset): boolean {
  return preset !== "free" && preset !== "split-tree";
}

export function gridNode(children: LayoutNode[]): LayoutGrid {
  const cols = Math.max(1, Math.ceil(Math.sqrt(children.length)));
  return {
    type: "grid",
    id: nodeId("g"),
    cols,
    rows: gridRows(children.length, cols),
    children,
  };
}

/** i3-style default: each new window splits the previous one, alternating direction. */
export function buildSplitTree(
  ids: WindowId[],
  direction: SplitDirection = "horizontal"
): LayoutNode | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return leaf(ids[0]);
  const other: SplitDirection =
    direction === "horizontal" ? "vertical" : "horizontal";
  return split(direction, [leaf(ids[0]), buildSplitTree(ids.slice(1), other)!]);
}

/** Templates use empty window ids as slots. */
const SLOT = "";

function bentoTemplate(preset: LayoutPreset): LayoutNode {
  switch (preset) {
    case "bento-1-2":
      return split(
        "horizontal",
        [leaf(SLOT), split("vertical", [leaf(SLOT), leaf(SLOT)])],
        [0.62, 0.38]
      );
    case "bento-2-1":
      return split(
        "vertical",
        [split("horizontal", [leaf(SLOT), leaf(SLOT)]), leaf(SLOT)],
        [0.55, 0.45]
      );
    default:
      return split(
        "horizontal",
        [
          split("vertical", [leaf(SLOT), leaf(SLOT)], [0.6, 0.4]),
          split("vertical", [leaf(SLOT), leaf(SLOT)], [0.4, 0.6]),
        ],
        [0.55, 0.45]
      );
  }
}

/**
 * Fills a template's slots in reading order. Windows beyond the template's
 * slots share the last slot as a grid; unused slots disappear.
 */
export function fillTemplate(
  template: LayoutNode,
  ids: WindowId[]
): LayoutNode | null {
  const slots = collectLeaves(template);
  let root: LayoutNode | null = template;
  slots.forEach((slot, i) => {
    const id = ids[i];
    if (id === undefined) return;
    const isLast = i === slots.length - 1;
    const extras = isLast ? ids.slice(i + 1) : [];
    root = replaceNode(root, slot.id, () =>
      extras.length ? gridNode([id, ...extras].map(leaf)) : leaf(id)
    );
  });
  return pruneTree(root, new Set(ids));
}

/** Builds the layout tree for `preset` over `ids`. `free` (and no windows) gives null. */
export function buildPreset(
  preset: LayoutPreset,
  ids: WindowId[],
  options: PresetOptions = {}
): LayoutNode | null {
  if (ids.length === 0 || preset === "free") return null;
  if (ids.length === 1) return leaf(ids[0]);
  const direction: SplitDirection = options.narrow ? "vertical" : "horizontal";
  switch (preset) {
    case "columns":
      return split(direction, ids.map(leaf));
    case "grid":
      return options.narrow
        ? split("vertical", ids.map(leaf))
        : gridNode(ids.map(leaf));
    case "bento-1-2":
    case "bento-2-1":
    case "bento-mosaic":
      return options.narrow
        ? split("vertical", ids.map(leaf))
        : fillTemplate(bentoTemplate(preset), ids);
    case "split-tree":
      return buildSplitTree(ids, direction);
  }
}
