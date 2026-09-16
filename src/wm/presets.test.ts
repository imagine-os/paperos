import { describe, expect, it } from "vitest";
import {
  buildPreset,
  buildSplitTree,
  fillTemplate,
  isFlatPreset,
  isPreset,
  PRESETS,
} from "./presets";
import { collectWindowIds, leaf, split } from "./tree";
import { expectInvariants, ids, leafCount } from "./test-helpers";
import type { LayoutPreset } from "./types";

const tiling = PRESETS.map((p) => p.id).filter((p) => p !== "free");

describe("buildPreset", () => {
  it("free and empty give no tree", () => {
    expect(buildPreset("free", ids(3))).toBeNull();
    expect(buildPreset("columns", [])).toBeNull();
  });

  it("a single window is a leaf for every preset", () => {
    for (const p of tiling) {
      expect(buildPreset(p, ["only"])).toMatchObject({
        type: "leaf",
        windowId: "only",
      });
    }
  });

  it.each(tiling)("%s keeps every window and satisfies invariants", (p) => {
    for (const n of [2, 3, 4, 5, 7, 9]) {
      const root = buildPreset(p, ids(n));
      expect(collectWindowIds(root).sort()).toEqual(ids(n).sort());
      expectInvariants(root);
    }
  });

  it("columns are one horizontal split with equal ratios", () => {
    const root = buildPreset("columns", ids(4))!;
    expect(root.type).toBe("split");
    if (root.type !== "split") return;
    expect(root.direction).toBe("horizontal");
    expect(root.children).toHaveLength(4);
    for (const r of root.ratios) expect(r).toBeCloseTo(0.25);
    const frames = expectInvariants(root);
    const widths = [...frames.windows.values()].map((r) => r.w);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1e-6);
  });

  it("columns collapse to one column on narrow viewports", () => {
    const root = buildPreset("columns", ids(3), { narrow: true })!;
    expect(root).toMatchObject({ type: "split", direction: "vertical" });
  });

  it("grid picks square-ish dimensions", () => {
    const root = buildPreset("grid", ids(5))!;
    expect(root).toMatchObject({ type: "grid", cols: 3, rows: 2 });
    expect(buildPreset("grid", ids(9))).toMatchObject({ cols: 3, rows: 3 });
    expect(buildPreset("grid", ids(2))).toMatchObject({ cols: 2, rows: 1 });
  });

  it("bento 1+2 gives the first window the large cell", () => {
    const frames = expectInvariants(buildPreset("bento-1-2", ids(3)));
    const [a, b, c] = ids(3).map((k) => frames.windows.get(k)!);
    expect(a.w).toBeGreaterThan(b.w);
    expect(a.h).toBeGreaterThan(b.h);
    expect(b.x).toBe(c.x);
    expect(c.y).toBeGreaterThan(b.y);
  });

  it("bento 2+1 puts two on top and one wide window below", () => {
    const frames = expectInvariants(buildPreset("bento-2-1", ids(3)));
    const [a, b, c] = ids(3).map((k) => frames.windows.get(k)!);
    expect(a.y).toBe(b.y);
    expect(c.y).toBeGreaterThan(a.y);
    expect(c.w).toBeGreaterThan(a.w);
  });

  it("bento mosaic is four asymmetric cells", () => {
    const frames = expectInvariants(buildPreset("bento-mosaic", ids(4)));
    const [a, b, c, d] = ids(4).map((k) => frames.windows.get(k)!);
    expect(a.h).toBeGreaterThan(b.h);
    expect(d.h).toBeGreaterThan(c.h);
    expect(a.w).toBeGreaterThan(c.w);
  });

  it("bento drops unused slots and overflows into the last cell", () => {
    expect(leafCount(buildPreset("bento-mosaic", ids(2)))).toBe(2);
    const root = buildPreset("bento-1-2", ids(6));
    expect(leafCount(root)).toBe(6);
    const frames = expectInvariants(root);
    // The first window still has the large cell.
    const big = frames.windows.get("w0")!;
    for (const id of ids(6).slice(1)) {
      expect(frames.windows.get(id)!.w).toBeLessThan(big.w);
    }
  });

  it("split tree alternates directions", () => {
    const root = buildSplitTree(ids(3))!;
    expect(root).toMatchObject({ type: "split", direction: "horizontal" });
    if (root.type !== "split") return;
    expect(root.children[0]).toMatchObject({ windowId: "w0" });
    expect(root.children[1]).toMatchObject({
      type: "split",
      direction: "vertical",
    });
    expectInvariants(root);
  });
});

describe("fillTemplate", () => {
  it("fills slots in reading order", () => {
    const template = split("horizontal", [leaf(""), leaf("")]);
    expect(collectWindowIds(fillTemplate(template, ["x", "y"]))).toEqual([
      "x",
      "y",
    ]);
  });
});

describe("preset helpers", () => {
  it("knows its presets", () => {
    expect(isPreset("grid")).toBe(true);
    expect(isPreset("nope")).toBe(false);
    expect(isFlatPreset("grid")).toBe(true);
    expect(isFlatPreset("split-tree")).toBe(false);
    expect(isFlatPreset("free" as LayoutPreset)).toBe(false);
  });
});
