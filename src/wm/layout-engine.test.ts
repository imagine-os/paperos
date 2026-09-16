import { describe, expect, it } from "vitest";
import { fitSizes, insetRect, layout, minSizeOf } from "./layout-engine";
import { leaf, split } from "./tree";
import { expectInvariants, ids, OPTS, REGION } from "./test-helpers";
import type { LayoutNode } from "./types";

describe("layout", () => {
  it("returns nothing for an empty tree", () => {
    const frames = layout(null, REGION, OPTS);
    expect(frames.windows.size).toBe(0);
    expect(frames.gutters).toEqual([]);
  });

  it("gives a single leaf the padded region", () => {
    const frames = layout(leaf("a"), REGION, OPTS);
    expect(frames.windows.get("a")).toEqual(insetRect(REGION, OPTS.padding));
  });

  it("splits horizontally by ratio with one gap between children", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")], [0.25, 0.75]);
    const frames = expectInvariants(root);
    const a = frames.windows.get("a")!;
    const b = frames.windows.get("b")!;
    const inner = insetRect(REGION, OPTS.padding);
    const total = inner.w - OPTS.gap;
    expect(a.w).toBeCloseTo(total * 0.25);
    expect(b.w).toBeCloseTo(total * 0.75);
    expect(a.h).toBe(inner.h);
    expect(b.x).toBeCloseTo(a.x + a.w + OPTS.gap);
    expect(frames.gutters).toHaveLength(1);
    expect(frames.gutters[0]).toMatchObject({
      splitId: root.id,
      index: 0,
      direction: "horizontal",
    });
    expect(frames.gutters[0].rect.x).toBeCloseTo(a.x + a.w);
    expect(frames.gutters[0].rect.w).toBe(OPTS.gap);
  });

  it("splits vertically", () => {
    const root = split("vertical", [leaf("a"), leaf("b"), leaf("c")]);
    const frames = expectInvariants(root);
    const [a, b, c] = ["a", "b", "c"].map((k) => frames.windows.get(k)!);
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
    expect(b.y).toBeCloseTo(a.y + a.h + OPTS.gap);
    expect(c.y).toBeCloseTo(b.y + b.h + OPTS.gap);
    expect(frames.gutters.map((g) => g.index)).toEqual([0, 1]);
  });

  it("fills a grid in reading order and pads incomplete rows", () => {
    const root: LayoutNode = {
      type: "grid",
      id: "g",
      rows: 2,
      cols: 2,
      children: ids(3).map(leaf),
    };
    const frames = expectInvariants(root);
    const [w0, w1, w2] = ids(3).map((k) => frames.windows.get(k)!);
    expect(w0.y).toBe(w1.y);
    expect(w1.x).toBeGreaterThan(w0.x);
    expect(w2.x).toBe(w0.x);
    expect(w2.y).toBeCloseTo(w0.y + w0.h + OPTS.gap);
    expect(w0.w).toBeCloseTo(w1.w);
    expect(frames.gutters).toEqual([]);
  });

  it("records a rectangle for every node", () => {
    const inner = split("vertical", [leaf("b"), leaf("c")]);
    const root = split("horizontal", [leaf("a"), inner]);
    const frames = layout(root, REGION, OPTS);
    expect(frames.nodes.get(root.id)).toEqual(insetRect(REGION, OPTS.padding));
    expect(frames.nodes.get(inner.id)!.h).toBe(
      insetRect(REGION, OPTS.padding).h
    );
    expect(frames.nodes.has("b")).toBe(false);
    expect(frames.nodes.size).toBe(5);
  });

  it("respects minimum sizes by taking space from larger children", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")], [0.02, 0.98]);
    const frames = expectInvariants(root);
    expect(frames.windows.get("a")!.w).toBeCloseTo(OPTS.minSize.w);
  });

  it("shrinks everyone alike when the region is too small", () => {
    const root = split("horizontal", ids(5).map(leaf));
    const tiny = { x: 0, y: 0, w: 300, h: 100 };
    const frames = expectInvariants(root, tiny);
    const widths = [...frames.windows.values()].map((r) => r.w);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1e-6);
    expect(widths[0]).toBeLessThan(OPTS.minSize.w);
  });

  it("accounts for nested minimums", () => {
    const inner = split("horizontal", [leaf("b"), leaf("c")]);
    expect(minSizeOf(inner, OPTS.minSize, OPTS.gap)).toEqual({
      w: 2 * OPTS.minSize.w + OPTS.gap,
      h: OPTS.minSize.h,
    });
    const grid: LayoutNode = {
      type: "grid",
      id: "g",
      rows: 2,
      cols: 2,
      children: ids(3).map(leaf),
    };
    expect(minSizeOf(grid, OPTS.minSize, OPTS.gap)).toEqual({
      w: 2 * OPTS.minSize.w + OPTS.gap,
      h: 2 * OPTS.minSize.h + OPTS.gap,
    });
  });
});

describe("fitSizes", () => {
  it("keeps targets when all fit", () => {
    expect(fitSizes([30, 70], [10, 10], 100)).toEqual([30, 70]);
  });

  it("raises undersized children and rebalances the rest", () => {
    const sizes = fitSizes([5, 45, 50], [20, 20, 20], 100);
    expect(sizes[0]).toBe(20);
    expect(sizes[1]).toBeCloseTo((45 / 95) * 80);
    expect(sizes[2]).toBeCloseTo((50 / 95) * 80);
    expect(sizes.reduce((a, b) => a + b)).toBeCloseTo(100);
  });

  it("scales minimums when they do not fit", () => {
    expect(fitSizes([50, 50], [80, 80], 100)).toEqual([50, 50]);
  });

  it("handles empty input", () => {
    expect(fitSizes([], [], 100)).toEqual([]);
  });
});

describe("insetRect", () => {
  it("never goes negative", () => {
    expect(insetRect({ x: 0, y: 0, w: 10, h: 10 }, 20)).toEqual({
      x: 20,
      y: 20,
      w: 0,
      h: 0,
    });
  });
});
