import { layout } from "./layout-engine";
import { buildPreset, type PresetOptions } from "./presets";
import {
  findLeaf,
  findNode,
  findParent,
  leaf,
  normalize,
  replaceNode,
  split,
} from "./tree";
import type {
  LayoutFrames,
  LayoutNode,
  LayoutOptions,
  LayoutPreset,
  Rect,
  Side,
  SplitDirection,
  WindowId,
} from "./types";

/** No child of a split may shrink below this share by dragging. */
export const MIN_RATIO = 0.08;

export function sideDirection(side: Side): SplitDirection {
  return side === "left" || side === "right" ? "horizontal" : "vertical";
}

/** Removes a window from the tree. Empty containers collapse; an empty tree is null. */
export function removeWindow(
  root: LayoutNode | null,
  windowId: WindowId
): LayoutNode | null {
  const hit = findLeaf(root, windowId);
  if (!hit) return root;
  return normalize(replaceNode(root, hit.id, () => null));
}

/**
 * Puts `windowId` next to the node `targetNodeId`, on `side`. If the target's
 * parent already splits in that direction the window becomes a sibling
 * (i3 style); otherwise the target is wrapped in a new 50/50 split. A window
 * already in the tree is moved. With no tree, the window becomes the root.
 */
export function insertWindow(
  root: LayoutNode | null,
  windowId: WindowId,
  targetNodeId: string | null,
  side: Side
): LayoutNode {
  const base = removeWindow(root, windowId);
  if (!base) return leaf(windowId);
  const target = (targetNodeId ? findNode(base, targetNodeId) : null) ?? base;
  const direction = sideDirection(side);
  const before = side === "left" || side === "top";
  const parent = findParent(base, target.id);
  const fresh = leaf(windowId);

  if (parent && parent.type === "split" && parent.direction === direction) {
    const idx = parent.children.indexOf(target);
    const at = before ? idx : idx + 1;
    const n = parent.children.length;
    const children = [...parent.children];
    children.splice(at, 0, fresh);
    const ratios = parent.ratios.map((r) => (r * n) / (n + 1));
    ratios.splice(at, 0, 1 / (n + 1));
    return replaceNode(base, parent.id, (p) => ({
      ...(p as typeof parent),
      children,
      ratios,
    }))!;
  }

  return replaceNode(base, target.id, (t) =>
    split(direction, before ? [fresh, t] : [t, fresh])
  )!;
}

/** Splits the leaf `nodeId` and puts `newWindowId` in the new half (right or bottom). */
export function splitLeaf(
  root: LayoutNode | null,
  nodeId: string,
  direction: SplitDirection,
  newWindowId: WindowId
): LayoutNode {
  return insertWindow(
    root,
    newWindowId,
    nodeId,
    direction === "horizontal" ? "right" : "bottom"
  );
}

/** Exchanges the positions of two windows. Unknown ids leave the tree unchanged. */
export function swapWindows(
  root: LayoutNode | null,
  a: WindowId,
  b: WindowId
): LayoutNode | null {
  if (!root || a === b || !findLeaf(root, a) || !findLeaf(root, b)) {
    return root;
  }
  const swap = (node: LayoutNode): LayoutNode => {
    if (node.type === "leaf") {
      if (node.windowId === a) return { ...node, windowId: b };
      if (node.windowId === b) return { ...node, windowId: a };
      return node;
    }
    return { ...node, children: node.children.map(swap) } as LayoutNode;
  };
  return swap(root);
}

/**
 * Moves the boundary after child `index` of split `splitId` by `delta`
 * (a fraction of the split; positive grows child `index`). Clamped so both
 * neighbours keep MIN_RATIO.
 */
export function resizeRatio(
  root: LayoutNode | null,
  splitId: string,
  index: number,
  delta: number
): LayoutNode | null {
  const node = findNode(root, splitId);
  if (!node || node.type !== "split") return root;
  if (index < 0 || index >= node.ratios.length - 1) return root;
  const a = node.ratios[index];
  const b = node.ratios[index + 1];
  const clamped = Math.max(MIN_RATIO - a, Math.min(b - MIN_RATIO, delta));
  const ratios = [...node.ratios];
  ratios[index] = a + clamped;
  ratios[index + 1] = b - clamped;
  return replaceNode(root, splitId, (n) => ({
    ...(n as typeof node),
    ratios,
  }));
}

/** Builds `preset` over `windowIds` and lays it out in `region`, in one call. */
export function tile(
  windowIds: WindowId[],
  preset: LayoutPreset,
  region: Rect,
  options?: LayoutOptions,
  presetOptions?: PresetOptions
): { root: LayoutNode | null; frames: LayoutFrames } {
  const root = buildPreset(preset, windowIds, presetOptions);
  return { root, frames: layout(root, region, options) };
}
