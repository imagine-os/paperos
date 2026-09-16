import { describe, expect, it } from "vitest";
import {
  insertWindow,
  MIN_RATIO,
  removeWindow,
  resizeRatio,
  splitLeaf,
  swapWindows,
  tile,
} from "./operations";
import { buildPreset } from "./presets";
import {
  collectWindowIds,
  findLeaf,
  findNode,
  leaf,
  pruneTree,
  split,
} from "./tree";
import { expectInvariants, ids, OPTS, REGION } from "./test-helpers";
import type { LayoutNode } from "./types";

describe("removeWindow", () => {
  it("collapses a two-way split into the remaining leaf", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")]);
    expect(removeWindow(root, "a")).toMatchObject({
      type: "leaf",
      windowId: "b",
    });
  });

  it("renormalizes ratios of the remaining children", () => {
    const root = split("horizontal", ids(3).map(leaf), [0.5, 0.25, 0.25]);
    const next = removeWindow(root, "w0")!;
    expect(next.type).toBe("split");
    if (next.type !== "split") return;
    expect(next.ratios).toEqual([0.5, 0.5]);
    expectInvariants(next);
  });

  it("returns null for the last window and ignores unknown ids", () => {
    expect(removeWindow(leaf("a"), "a")).toBeNull();
    const root = leaf("a");
    expect(removeWindow(root, "zzz")).toBe(root);
    expect(removeWindow(null, "a")).toBeNull();
  });

  it("removes from grids and unwraps single children", () => {
    const root = buildPreset("grid", ids(3))!;
    const next = removeWindow(root, "w1")!;
    expect(collectWindowIds(next)).toEqual(["w0", "w2"]);
    expect(next).toMatchObject({ type: "grid", rows: 1 });
    expect(removeWindow(next, "w0")).toMatchObject({ windowId: "w2" });
  });
});

describe("insertWindow", () => {
  it("becomes the root when the tree is empty", () => {
    expect(insertWindow(null, "a", null, "right")).toMatchObject({
      type: "leaf",
      windowId: "a",
    });
  });

  it("wraps the target in a new split when directions differ", () => {
    const root = insertWindow(leaf("a"), "b", null, "bottom");
    expect(root).toMatchObject({ type: "split", direction: "vertical" });
    expect(collectWindowIds(root)).toEqual(["a", "b"]);
    const left = insertWindow(root, "c", null, "left");
    expect(left).toMatchObject({ type: "split", direction: "horizontal" });
    expect(collectWindowIds(left)).toEqual(["c", "a", "b"]);
    expectInvariants(left);
  });

  it("joins the parent split as a sibling when directions match", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")]);
    const next = insertWindow(root, "c", findLeaf(root, "a")!.id, "right");
    expect(next).toMatchObject({ type: "split", direction: "horizontal" });
    if (next.type !== "split") return;
    expect(collectWindowIds(next)).toEqual(["a", "c", "b"]);
    for (const r of next.ratios) expect(r).toBeCloseTo(1 / 3);
    expectInvariants(next);
  });

  it("puts left/top before and right/bottom after the target", () => {
    const root = split("vertical", [leaf("a"), leaf("b")]);
    const top = insertWindow(root, "c", findLeaf(root, "b")!.id, "top");
    expect(collectWindowIds(top)).toEqual(["a", "c", "b"]);
    const bottom = insertWindow(root, "c", findLeaf(root, "b")!.id, "bottom");
    expect(collectWindowIds(bottom)).toEqual(["a", "b", "c"]);
  });

  it("moves a window that is already in the tree", () => {
    const root = split("horizontal", ids(3).map(leaf));
    const next = insertWindow(root, "w2", findLeaf(root, "w0")!.id, "left");
    expect(collectWindowIds(next)).toEqual(["w2", "w0", "w1"]);
    expectInvariants(next);
  });

  it("falls back to the root when the target is unknown", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")]);
    const next = insertWindow(root, "c", "missing", "bottom");
    expect(next).toMatchObject({ type: "split", direction: "vertical" });
    expect(collectWindowIds(next)).toEqual(["a", "b", "c"]);
  });

  it("wraps a grid cell in a split", () => {
    const root = buildPreset("grid", ids(4))!;
    const next = insertWindow(root, "x", findLeaf(root, "w1")!.id, "bottom");
    const cell = findNode(next, findLeaf(next, "w1")!.id);
    expect(cell).toBeTruthy();
    expect(collectWindowIds(next)).toEqual(["w0", "w1", "x", "w2", "w3"]);
    expectInvariants(next);
  });
});

describe("splitLeaf", () => {
  it("puts the new window right (horizontal) or below (vertical)", () => {
    const root = leaf("a");
    const h = splitLeaf(root, root.id, "horizontal", "b");
    expect(h).toMatchObject({ type: "split", direction: "horizontal" });
    expect(collectWindowIds(h)).toEqual(["a", "b"]);
    const v = splitLeaf(h, findLeaf(h, "b")!.id, "vertical", "c");
    expect(collectWindowIds(v)).toEqual(["a", "b", "c"]);
    const frames = expectInvariants(v);
    expect(frames.windows.get("c")!.y).toBeGreaterThan(
      frames.windows.get("b")!.y
    );
    expect(frames.windows.get("c")!.x).toBe(frames.windows.get("b")!.x);
  });
});

describe("swapWindows", () => {
  it("exchanges two leaves and nothing else", () => {
    const root = buildPreset("bento-1-2", ids(3))!;
    const next = swapWindows(root, "w0", "w2")!;
    expect(collectWindowIds(next)).toEqual(["w2", "w1", "w0"]);
    const before = expectInvariants(root);
    const after = expectInvariants(next);
    expect(after.windows.get("w2")).toEqual(before.windows.get("w0"));
    expect(after.windows.get("w0")).toEqual(before.windows.get("w2"));
    expect(after.windows.get("w1")).toEqual(before.windows.get("w1"));
  });

  it("is a no-op for unknown or identical ids", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")]);
    expect(swapWindows(root, "a", "zzz")).toBe(root);
    expect(swapWindows(root, "a", "a")).toBe(root);
    expect(swapWindows(null, "a", "b")).toBeNull();
  });
});

describe("resizeRatio", () => {
  it("moves the boundary between two neighbours", () => {
    const root = split("horizontal", ids(3).map(leaf));
    const next = resizeRatio(root, root.id, 0, 0.1)!;
    if (next.type !== "split") throw new Error("expected split");
    expect(next.ratios[0]).toBeCloseTo(1 / 3 + 0.1);
    expect(next.ratios[1]).toBeCloseTo(1 / 3 - 0.1);
    expect(next.ratios[2]).toBeCloseTo(1 / 3);
    expectInvariants(next);
  });

  it("clamps so no neighbour drops below MIN_RATIO", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")]);
    const grow = resizeRatio(root, root.id, 0, 5)!;
    if (grow.type !== "split") throw new Error("expected split");
    expect(grow.ratios[1]).toBeCloseTo(MIN_RATIO);
    expect(grow.ratios[0]).toBeCloseTo(1 - MIN_RATIO);
    const shrink = resizeRatio(root, root.id, 0, -5)!;
    if (shrink.type !== "split") throw new Error("expected split");
    expect(shrink.ratios[0]).toBeCloseTo(MIN_RATIO);
  });

  it("ignores bad indices and non-splits", () => {
    const root = split("horizontal", [leaf("a"), leaf("b")]);
    expect(resizeRatio(root, root.id, 1, 0.1)).toBe(root);
    expect(resizeRatio(root, root.id, -1, 0.1)).toBe(root);
    expect(resizeRatio(root, "nope", 0, 0.1)).toBe(root);
    const l = leaf("a");
    expect(resizeRatio(l, l.id, 0, 0.1)).toBe(l);
  });

  it("works on nested splits", () => {
    const inner = split("vertical", [leaf("b"), leaf("c")]);
    const root = split("horizontal", [leaf("a"), inner]);
    const next = resizeRatio(root, inner.id, 0, 0.2)!;
    const got = findNode(next, inner.id)!;
    if (got.type !== "split") throw new Error("expected split");
    expect(got.ratios[0]).toBeCloseTo(0.7);
    expectInvariants(next);
  });
});

describe("pruneTree", () => {
  it("drops windows that no longer exist", () => {
    const root = buildPreset("columns", ids(4))!;
    const next = pruneTree(root, new Set(["w1", "w3"]));
    expect(collectWindowIds(next)).toEqual(["w1", "w3"]);
    expectInvariants(next);
    expect(pruneTree(root, new Set())).toBeNull();
  });
});

describe("tile", () => {
  it("builds and lays out in one call", () => {
    const { root, frames } = tile(ids(3), "columns", REGION, OPTS);
    expect(collectWindowIds(root)).toEqual(ids(3));
    expect(frames.windows.size).toBe(3);
    const xs = ids(3).map((k) => frames.windows.get(k)!.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it("uses the narrow option", () => {
    const { root } = tile(ids(3), "columns", REGION, OPTS, { narrow: true });
    expect(root).toMatchObject({ direction: "vertical" });
  });

  it("free yields no rectangles", () => {
    const { root, frames } = tile(ids(3), "free", REGION, OPTS);
    expect(root).toBeNull();
    expect(frames.windows.size).toBe(0);
  });
});

describe("randomized operations keep invariants", () => {
  it("survives a scripted sequence of inserts, removes, swaps and resizes", () => {
    let root: LayoutNode | null = null;
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const sides = ["left", "right", "top", "bottom"] as const;
    const present = new Set<string>();
    for (let step = 0; step < 200; step++) {
      const r = rand();
      const live = [...present];
      if (r < 0.4 || live.length < 2) {
        const id = `n${step}`;
        const target = live.length
          ? findLeaf(root, live[Math.floor(rand() * live.length)])!.id
          : null;
        root = insertWindow(
          root,
          id,
          target,
          sides[Math.floor(rand() * sides.length)]
        );
        present.add(id);
      } else if (r < 0.6) {
        const id = live[Math.floor(rand() * live.length)];
        root = removeWindow(root, id);
        present.delete(id);
      } else if (r < 0.8) {
        const a = live[Math.floor(rand() * live.length)];
        const b = live[Math.floor(rand() * live.length)];
        root = swapWindows(root, a, b);
      } else if (root && root.type === "split") {
        root = resizeRatio(root, root.id, 0, rand() - 0.5);
      }
      expect(collectWindowIds(root).sort()).toEqual([...present].sort());
      expectInvariants(root);
    }
  });
});
