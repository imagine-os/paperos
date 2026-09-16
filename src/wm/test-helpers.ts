import { expect } from "vitest";
import { rectsOverlap, rectWithin } from "./geometry";
import { layout } from "./layout-engine";
import { collectWindowIds } from "./tree";
import type { LayoutNode, LayoutOptions, Rect } from "./types";

export const REGION: Rect = { x: 100, y: 200, w: 1200, h: 800 };

export const OPTS: LayoutOptions = {
  gap: 10,
  padding: 20,
  minSize: { w: 100, h: 80 },
};

export const ids = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`);

/** Every window placed once, no two overlap, all inside the region, ratios sum to 1. */
export function expectInvariants(
  root: LayoutNode | null,
  region: Rect = REGION,
  options: LayoutOptions = OPTS
) {
  const frames = layout(root, region, options);
  const windows = collectWindowIds(root);
  expect([...frames.windows.keys()].sort()).toEqual([...windows].sort());
  const rects = [...frames.windows.values()];
  for (let i = 0; i < rects.length; i++) {
    expect(rectWithin(rects[i], region, 1e-6)).toBe(true);
    for (let j = i + 1; j < rects.length; j++) {
      expect(rectsOverlap(rects[i], rects[j])).toBe(false);
    }
  }
  expectRatiosSumToOne(root);
  return frames;
}

export function expectRatiosSumToOne(root: LayoutNode | null) {
  if (!root || root.type === "leaf") return;
  if (root.type === "split") {
    expect(root.ratios.length).toBe(root.children.length);
    const sum = root.ratios.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    for (const r of root.ratios) expect(r).toBeGreaterThan(0);
  }
  for (const child of root.children) expectRatiosSumToOne(child);
}

export function leafCount(root: LayoutNode | null): number {
  return collectWindowIds(root).length;
}
