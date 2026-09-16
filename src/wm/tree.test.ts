import { describe, expect, it } from "vitest";
import {
  collectLeaves,
  collectWindowIds,
  equalRatios,
  findLeaf,
  findNode,
  findParent,
  leaf,
  nodeId,
  normalize,
  normalizeRatios,
  replaceNode,
  split,
} from "./tree";

describe("tree helpers", () => {
  const b = leaf("b");
  const inner = split("vertical", [b, leaf("c")]);
  const root = split("horizontal", [leaf("a"), inner]);

  it("generates unique ids", () => {
    expect(nodeId()).not.toBe(nodeId());
  });

  it("finds nodes, parents and leaves", () => {
    expect(findNode(root, inner.id)).toBe(inner);
    expect(findNode(root, "nope")).toBeNull();
    expect(findParent(root, b.id)).toBe(inner);
    expect(findParent(root, root.id)).toBeNull();
    expect(findLeaf(root, "c")?.windowId).toBe("c");
    expect(findLeaf(null, "c")).toBeNull();
    expect(collectWindowIds(root)).toEqual(["a", "b", "c"]);
    expect(collectLeaves(root)).toHaveLength(3);
  });

  it("replaces and removes nodes immutably", () => {
    const next = replaceNode(root, b.id, () => leaf("z"));
    expect(collectWindowIds(next)).toEqual(["a", "z", "c"]);
    expect(collectWindowIds(root)).toEqual(["a", "b", "c"]);
    const removed = replaceNode(root, b.id, () => null);
    expect(collectWindowIds(removed)).toEqual(["a", "c"]);
  });

  it("normalizes ratios and trees", () => {
    expect(normalizeRatios([1, 1])).toEqual([0.5, 0.5]);
    expect(normalizeRatios([0, 0])).toEqual(equalRatios(2));
    const single = split("horizontal", [leaf("x")]);
    expect(normalize(single)).toMatchObject({ type: "leaf", windowId: "x" });
    expect(normalize(split("horizontal", []))).toBeNull();
  });
});
