import { describe, expect, it } from "vitest";
import {
  ancestors,
  basename,
  dirname,
  extname,
  isInside,
  joinPath,
  normalizePath,
  resolveRelative,
} from "./paths";

describe("paths", () => {
  it("normalizes", () => {
    expect(normalizePath("/a//b/./c/")).toBe("a/b/c");
    expect(normalizePath("a/../b")).toBe("b");
    expect(normalizePath("../../x")).toBe("x");
    expect(normalizePath("a\\b")).toBe("a/b");
    expect(normalizePath("")).toBe("");
  });

  it("joins, splits", () => {
    expect(joinPath("src", "lib", "a.ts")).toBe("src/lib/a.ts");
    expect(dirname("src/lib/a.ts")).toBe("src/lib");
    expect(dirname("a.ts")).toBe("");
    expect(basename("src/lib/a.ts")).toBe("a.ts");
    expect(extname("A.JS")).toBe("js");
    expect(extname(".gitignore")).toBe("");
    expect(extname("README")).toBe("");
    expect(ancestors("a/b/c.txt")).toEqual(["a", "a/b"]);
    expect(isInside("a/b", "a")).toBe(true);
    expect(isInside("ab", "a")).toBe(false);
    expect(isInside("x", "")).toBe(true);
  });

  it("resolves relative references from a file", () => {
    expect(resolveRelative("index.html", "styles.css")).toBe("styles.css");
    expect(resolveRelative("pages/a.html", "../app.js?v=2")).toBe("app.js");
    expect(resolveRelative("pages/a.html", "./x/y.css#frag")).toBe(
      "pages/x/y.css"
    );
    expect(resolveRelative("pages/a.html", "/root.css")).toBe("root.css");
  });

  it("leaves external and special URLs alone", () => {
    expect(resolveRelative("index.html", "https://x.y/z.css")).toBeNull();
    expect(resolveRelative("index.html", "//cdn/z.js")).toBeNull();
    expect(resolveRelative("index.html", "data:text/plain,hi")).toBeNull();
    expect(resolveRelative("index.html", "#top")).toBeNull();
    expect(resolveRelative("index.html", "")).toBeNull();
  });
});
