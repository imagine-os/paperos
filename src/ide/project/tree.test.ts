import { describe, expect, it } from "vitest";
import { buildTree, filterTree, flattenFiles } from "./tree";

const entries = [
  { path: "src/b.ts", type: "file" as const },
  { path: "src/a.ts", type: "file" as const },
  { path: "README.md", type: "file" as const },
  { path: "assets", type: "dir" as const },
  { path: "src/lib/util.ts", type: "file" as const },
];

describe("buildTree", () => {
  it("nests, sorts folders first and keeps empty folders", () => {
    const tree = buildTree(entries);
    expect(tree.map((n) => n.name)).toEqual(["assets", "src", "README.md"]);
    const src = tree[1];
    expect(src.children.map((n) => n.name)).toEqual(["lib", "a.ts", "b.ts"]);
    expect(src.children[0].children[0].path).toBe("src/lib/util.ts");
  });

  it("filters by substring and keeps parent folders", () => {
    const tree = filterTree(buildTree(entries), "util");
    expect(flattenFiles(tree)).toEqual(["src/lib/util.ts"]);
    expect(tree[0].name).toBe("src");
    expect(filterTree(buildTree(entries), "")).toHaveLength(3);
  });

  it("lists files depth first", () => {
    expect(flattenFiles(buildTree(entries))).toEqual([
      "src/lib/util.ts",
      "src/a.ts",
      "src/b.ts",
      "README.md",
    ]);
  });
});
