import { describe, expect, it } from "vitest";
import {
  dropZone,
  findNeighbor,
  readingOrder,
  rectContains,
  rectsOverlap,
  rectWithin,
  unionRect,
  zoneRect,
} from "./geometry";
import { layout } from "./layout-engine";
import { buildPreset } from "./presets";
import { ids, OPTS, REGION } from "./test-helpers";
import type { Rect } from "./types";

const R: Rect = { x: 100, y: 100, w: 200, h: 100 };

describe("rect helpers", () => {
  it("contains and overlaps", () => {
    expect(rectContains(R, { x: 100, y: 100 })).toBe(true);
    expect(rectContains(R, { x: 301, y: 150 })).toBe(false);
    expect(rectsOverlap(R, { x: 250, y: 150, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(R, { x: 300, y: 100, w: 10, h: 10 })).toBe(false);
    expect(rectWithin({ x: 100, y: 100, w: 50, h: 50 }, R)).toBe(true);
    expect(rectWithin({ x: 100, y: 100, w: 250, h: 50 }, R)).toBe(false);
  });

  it("unions", () => {
    expect(unionRect([])).toBeNull();
    expect(unionRect([R, { x: 0, y: 0, w: 10, h: 10 }])).toEqual({
      x: 0,
      y: 0,
      w: 300,
      h: 200,
    });
  });
});

describe("dropZone", () => {
  it("returns null outside", () => {
    expect(dropZone(R, { x: 0, y: 0 })).toBeNull();
  });

  it("finds the center and the four edges", () => {
    expect(dropZone(R, { x: 200, y: 150 })).toBe("center");
    expect(dropZone(R, { x: 105, y: 150 })).toBe("left");
    expect(dropZone(R, { x: 295, y: 150 })).toBe("right");
    expect(dropZone(R, { x: 200, y: 102 })).toBe("top");
    expect(dropZone(R, { x: 200, y: 198 })).toBe("bottom");
  });

  it("zone rectangles are halves and an inset center", () => {
    expect(zoneRect(R, "left")).toEqual({ x: 100, y: 100, w: 100, h: 100 });
    expect(zoneRect(R, "right")).toEqual({ x: 200, y: 100, w: 100, h: 100 });
    expect(zoneRect(R, "top")).toEqual({ x: 100, y: 100, w: 200, h: 50 });
    expect(zoneRect(R, "bottom")).toEqual({ x: 100, y: 150, w: 200, h: 50 });
    expect(zoneRect(R, "center")).toEqual({ x: 140, y: 120, w: 120, h: 60 });
  });
});

describe("findNeighbor", () => {
  const frames = layout(buildPreset("grid", ids(4)), REGION, OPTS);
  const rects = frames.windows;
  // w0 w1
  // w2 w3
  it("walks a grid", () => {
    expect(findNeighbor(rects, "w0", "right")).toBe("w1");
    expect(findNeighbor(rects, "w0", "bottom")).toBe("w2");
    expect(findNeighbor(rects, "w3", "left")).toBe("w2");
    expect(findNeighbor(rects, "w3", "top")).toBe("w1");
    expect(findNeighbor(rects, "w0", "left")).toBeNull();
    expect(findNeighbor(rects, "w1", "top")).toBeNull();
  });

  it("prefers the aligned neighbour over a nearer diagonal one", () => {
    const wide = new Map<string, Rect>([
      ["a", { x: 0, y: 0, w: 100, h: 100 }],
      ["b", { x: 120, y: 300, w: 100, h: 100 }],
      ["c", { x: 400, y: 0, w: 100, h: 100 }],
    ]);
    expect(findNeighbor(wide, "a", "right")).toBe("c");
  });

  it("returns null for unknown ids", () => {
    expect(findNeighbor(rects, "nope", "left")).toBeNull();
  });
});

describe("readingOrder", () => {
  it("sorts by row band then x", () => {
    const items = [
      { id: "c", rect: { x: 0, y: 500, w: 1, h: 1 } },
      { id: "b", rect: { x: 300, y: 10, w: 1, h: 1 } },
      { id: "a", rect: { x: 0, y: 40, w: 1, h: 1 } },
    ];
    expect(readingOrder(items).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});
