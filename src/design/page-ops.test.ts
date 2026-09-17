import { describe, expect, it } from "vitest";
import {
  findBlock,
  insertBlock,
  moveBlock,
  parentOf,
  removeBlock,
  shiftBlock,
  updateBlock,
} from "./page-ops";
import type { PageBlock } from "./pages";

const b = (id: string, children?: PageBlock[]): PageBlock => ({
  id,
  name: "X",
  span: 12,
  props: {},
  ...(children ? { children } : {}),
});
const tree = () => [b("a"), b("g", [b("c1"), b("c2")]), b("z")];
const ids = (blocks: PageBlock[]): unknown[] =>
  blocks.map((x) => (x.children ? [x.id, ids(x.children)] : x.id));

describe("page block operations", () => {
  it("finds blocks and parents", () => {
    expect(findBlock(tree(), "c2")?.id).toBe("c2");
    expect(findBlock(tree(), "nope")).toBeNull();
    expect(parentOf(tree(), "c1")).toBe("g");
    expect(parentOf(tree(), "a")).toBeNull();
    expect(parentOf(tree(), "nope")).toBeUndefined();
  });

  it("updates, removes and inserts without mutating", () => {
    const t = tree();
    const updated = updateBlock(t, "c1", { span: 4 });
    expect(findBlock(updated, "c1")?.span).toBe(4);
    expect(findBlock(t, "c1")?.span).toBe(12);
    expect(ids(removeBlock(t, "c1"))).toEqual(["a", ["g", ["c2"]], "z"]);
    expect(ids(insertBlock(t, b("n"), null, 1))).toEqual([
      "a",
      "n",
      ["g", ["c1", "c2"]],
      "z",
    ]);
    expect(ids(insertBlock(t, b("n"), "g"))).toEqual([
      "a",
      ["g", ["c1", "c2", "n"]],
      "z",
    ]);
    expect(ids(insertBlock(t, b("n"), "a"))).toEqual([
      ["a", ["n"]],
      ["g", ["c1", "c2"]],
      "z",
    ]);
  });

  it("moves blocks between parents and refuses cycles", () => {
    const t = tree();
    expect(ids(moveBlock(t, "z", { parentId: null, beforeId: "a" }))).toEqual([
      "z",
      "a",
      ["g", ["c1", "c2"]],
    ]);
    expect(ids(moveBlock(t, "a", { parentId: "g", beforeId: "c2" }))).toEqual([
      ["g", ["c1", "a", "c2"]],
      "z",
    ]);
    expect(ids(moveBlock(t, "c1", { parentId: null, beforeId: null }))).toEqual(
      ["a", ["g", ["c2"]], "z", "c1"]
    );
    expect(moveBlock(t, "g", { parentId: "c1", beforeId: null })).toBe(t);
    expect(moveBlock(t, "g", { parentId: "g", beforeId: null })).toBe(t);
  });

  it("shifts a block among its siblings", () => {
    expect(ids(shiftBlock(tree(), "c2", -1))).toEqual([
      "a",
      ["g", ["c2", "c1"]],
      "z",
    ]);
    expect(ids(shiftBlock(tree(), "a", 1))).toEqual([
      ["g", ["c1", "c2"]],
      "a",
      "z",
    ]);
    const t = tree();
    expect(shiftBlock(t, "a", -1)).toBe(t);
    expect(shiftBlock(t, "z", 1)).toBe(t);
  });
});
