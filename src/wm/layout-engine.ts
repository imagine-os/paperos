import { gridRows } from "./tree";
import type {
  LayoutFrames,
  LayoutNode,
  LayoutOptions,
  Rect,
  Size,
} from "./types";

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  gap: 12,
  padding: 16,
  minSize: { w: 240, h: 160 },
};

export function insetRect(rect: Rect, by: number): Rect {
  return {
    x: rect.x + by,
    y: rect.y + by,
    w: Math.max(0, rect.w - 2 * by),
    h: Math.max(0, rect.h - 2 * by),
  };
}

/** The smallest rectangle a subtree can be laid out in while every window keeps `minSize`. */
export function minSizeOf(node: LayoutNode, minSize: Size, gap: number): Size {
  if (node.type === "leaf") return { ...minSize };
  const sizes = node.children.map((c) => minSizeOf(c, minSize, gap));
  const n = sizes.length;
  if (node.type === "split") {
    const sum = (k: "w" | "h") =>
      sizes.reduce((a, s) => a + s[k], 0) + gap * (n - 1);
    const max = (k: "w" | "h") => Math.max(0, ...sizes.map((s) => s[k]));
    return node.direction === "horizontal"
      ? { w: sum("w"), h: max("h") }
      : { w: max("w"), h: sum("h") };
  }
  const cols = Math.max(1, node.cols);
  const rows = gridRows(n, cols);
  const cellW = Math.max(0, ...sizes.map((s) => s.w));
  const cellH = Math.max(0, ...sizes.map((s) => s.h));
  return {
    w: cols * cellW + gap * (cols - 1),
    h: rows * cellH + gap * (rows - 1),
  };
}

/**
 * Distributes `total` over children. Each child aims for `targets[i]` but gets
 * at least `mins[i]` when the total allows it; the shortfall is taken from the
 * others proportionally. If the minimums alone exceed the total, everyone is
 * shrunk alike (the desktop then relies on overflow: hidden).
 */
export function fitSizes(
  targets: number[],
  mins: number[],
  total: number
): number[] {
  const n = targets.length;
  if (n === 0) return [];
  const minSum = mins.reduce((a, b) => a + b, 0);
  if (minSum >= total) {
    return minSum > 0
      ? mins.map((m) => (m / minSum) * total)
      : targets.map(() => 0);
  }
  const fixed = new Set<number>();
  const sizes = [...targets];
  for (let iter = 0; iter < n; iter++) {
    let fixedSum = 0;
    let freeTarget = 0;
    for (let i = 0; i < n; i++) {
      if (fixed.has(i)) fixedSum += mins[i];
      else freeTarget += targets[i];
    }
    const free = total - fixedSum;
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (fixed.has(i)) continue;
      sizes[i] = freeTarget > 0 ? (targets[i] / freeTarget) * free : free / n;
      if (sizes[i] < mins[i] - 1e-6) {
        fixed.add(i);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const i of fixed) sizes[i] = mins[i];
  return sizes;
}

/** Computes a rectangle for every node and window of `root` inside `region`. */
export function layout(
  root: LayoutNode | null,
  region: Rect,
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS
): LayoutFrames {
  const frames: LayoutFrames = {
    windows: new Map(),
    nodes: new Map(),
    gutters: [],
  };
  if (!root) return frames;
  const { gap, minSize } = options;

  const place = (node: LayoutNode, rect: Rect) => {
    frames.nodes.set(node.id, rect);
    if (node.type === "leaf") {
      frames.windows.set(node.windowId, rect);
      return;
    }
    const n = node.children.length;
    if (n === 0) return;

    if (node.type === "split") {
      const horizontal = node.direction === "horizontal";
      const along = horizontal ? rect.w : rect.h;
      const total = Math.max(0, along - gap * (n - 1));
      const targets = node.ratios.map((r) => r * total);
      const mins = node.children.map(
        (c) => minSizeOf(c, minSize, gap)[horizontal ? "w" : "h"]
      );
      const sizes = fitSizes(targets, mins, total);
      let cursor = horizontal ? rect.x : rect.y;
      node.children.forEach((child, i) => {
        const childRect: Rect = horizontal
          ? { x: cursor, y: rect.y, w: sizes[i], h: rect.h }
          : { x: rect.x, y: cursor, w: rect.w, h: sizes[i] };
        place(child, childRect);
        cursor += sizes[i];
        if (i < n - 1) {
          frames.gutters.push({
            splitId: node.id,
            index: i,
            direction: node.direction,
            rect: horizontal
              ? { x: cursor, y: rect.y, w: gap, h: rect.h }
              : { x: rect.x, y: cursor, w: rect.w, h: gap },
          });
          cursor += gap;
        }
      });
      return;
    }

    const cols = Math.max(1, node.cols);
    const rows = gridRows(n, cols);
    const cellW = Math.max(0, (rect.w - gap * (cols - 1)) / cols);
    const cellH = Math.max(0, (rect.h - gap * (rows - 1)) / rows);
    node.children.forEach((child, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      place(child, {
        x: rect.x + c * (cellW + gap),
        y: rect.y + r * (cellH + gap),
        w: cellW,
        h: cellH,
      });
    });
  };

  place(root, insetRect(region, options.padding));
  return frames;
}
