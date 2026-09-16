import type { DropZone, Point, Rect, Side, WindowId } from "./types";

export function rectContains(rect: Rect, p: Point): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.w &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.h
  );
}

/** True when the rectangles share a positive area. */
export function rectsOverlap(a: Rect, b: Rect, eps = 1e-6): boolean {
  return (
    a.x + a.w > b.x + eps &&
    b.x + b.w > a.x + eps &&
    a.y + a.h > b.y + eps &&
    b.y + b.h > a.y + eps
  );
}

export function rectWithin(inner: Rect, outer: Rect, eps = 1e-6): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.w <= outer.x + outer.w + eps &&
    inner.y + inner.h <= outer.y + outer.h + eps
  );
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function unionRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const r = Math.max(...rects.map((r) => r.x + r.w));
  const b = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: r - x, h: b - y };
}

/** The inner 40% of the window is "center"; otherwise the nearest edge wins. */
export const CENTER_ZONE = 0.3;

/** Which drop zone of `rect` the point is in, or null when outside. */
export function dropZone(rect: Rect, p: Point): DropZone | null {
  if (!rectContains(rect, p) || rect.w <= 0 || rect.h <= 0) return null;
  const u = (p.x - rect.x) / rect.w;
  const v = (p.y - rect.y) / rect.h;
  if (
    u > CENTER_ZONE &&
    u < 1 - CENTER_ZONE &&
    v > CENTER_ZONE &&
    v < 1 - CENTER_ZONE
  ) {
    return "center";
  }
  const edges: [Side, number][] = [
    ["left", u],
    ["right", 1 - u],
    ["top", v],
    ["bottom", 1 - v],
  ];
  edges.sort((a, b) => a[1] - b[1]);
  return edges[0][0];
}

/** The area to highlight for a drop zone. */
export function zoneRect(rect: Rect, zone: DropZone): Rect {
  switch (zone) {
    case "left":
      return { ...rect, w: rect.w / 2 };
    case "right":
      return { ...rect, x: rect.x + rect.w / 2, w: rect.w / 2 };
    case "top":
      return { ...rect, h: rect.h / 2 };
    case "bottom":
      return { ...rect, y: rect.y + rect.h / 2, h: rect.h / 2 };
    case "center": {
      const ix = rect.w * 0.2;
      const iy = rect.h * 0.2;
      return {
        x: rect.x + ix,
        y: rect.y + iy,
        w: rect.w - 2 * ix,
        h: rect.h - 2 * iy,
      };
    }
  }
}

/**
 * The window next to `fromId` in `side`'s direction: closest along that axis,
 * with a penalty for being off-axis. Null when nothing lies that way.
 */
export function findNeighbor(
  rects: ReadonlyMap<WindowId, Rect>,
  fromId: WindowId,
  side: Side
): WindowId | null {
  const from = rects.get(fromId);
  if (!from) return null;
  const c = rectCenter(from);
  let best: WindowId | null = null;
  let bestScore = Infinity;
  for (const [id, rect] of rects) {
    if (id === fromId) continue;
    const o = rectCenter(rect);
    let along: number;
    let across: number;
    switch (side) {
      case "left":
        along = c.x - o.x;
        across = Math.abs(o.y - c.y);
        break;
      case "right":
        along = o.x - c.x;
        across = Math.abs(o.y - c.y);
        break;
      case "top":
        along = c.y - o.y;
        across = Math.abs(o.x - c.x);
        break;
      case "bottom":
        along = o.y - c.y;
        across = Math.abs(o.x - c.x);
        break;
    }
    if (along <= 1e-6) continue;
    const score = along + 2 * across;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/** Sorts rectangles into reading order: rows of similar y, then left to right. */
export function readingOrder<T extends { id: WindowId; rect: Rect }>(
  items: T[],
  rowTolerance = 80
): T[] {
  return [...items].sort((a, b) => {
    const dy = a.rect.y - b.rect.y;
    if (Math.abs(dy) > rowTolerance) return dy;
    return a.rect.x - b.rect.x;
  });
}
