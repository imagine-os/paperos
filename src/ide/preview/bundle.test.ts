import { describe, expect, it } from "vitest";
import { bundle, pickEntry } from "./bundle";

const files: Record<string, string> = {
  "index.html": `<!doctype html><html><head><link rel="stylesheet" href="styles.css"><link rel="icon" href="fav.ico"></head><body><img src="logo.svg"><script src="app.js"></script><script src="https://cdn/x.js"></script></body></html>`,
  "styles.css": `@import "base.css";\nbody { background: url(bg.svg); }`,
  "base.css": `h1 { color: red }`,
  "bg.svg": `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
  "logo.svg": `<svg/>`,
  "app.js": `console.log("</script> not closing")`,
  "pages/about.html": `<p>about</p>`,
};
const read = (p: string) => files[p] ?? null;

describe("pickEntry", () => {
  it("prefers index.html at the root, else the shallowest html", () => {
    expect(pickEntry(["a/index.html", "index.html"])).toBe("index.html");
    expect(pickEntry(["z/deep/a.html", "b.html", "c.html"])).toBe("b.html");
    expect(pickEntry(["a.js"])).toBeNull();
  });
});

describe("bundle", () => {
  it("inlines styles, imports, scripts and text assets", async () => {
    const out = await bundle("index.html", read);
    expect(out.html).toContain('<style data-src="styles.css">');
    expect(out.html).toContain("h1 { color: red }");
    expect(out.html).toMatch(/url\("data:image\/svg\+xml;base64,/);
    expect(out.html).toContain('<script data-src="app.js">');
    expect(out.html).toContain("<\\/script> not closing");
    expect(out.html).toContain('<img src="data:image/svg+xml;base64,');
    expect(out.html).toContain('<script src="https://cdn/x.js">');
    expect(out.html).toContain('<link rel="icon" href="fav.ico">');
    expect(out.html.indexOf('data-paperos="bridge"')).toBeLessThan(
      out.html.indexOf("<style")
    );
    expect(out.deps.sort()).toEqual([
      "app.js",
      "base.css",
      "bg.svg",
      "index.html",
      "logo.svg",
      "styles.css",
    ]);
    expect(out.missing).toEqual([]);
  });

  it("reports missing references and handles bare fragments", async () => {
    const out = await bundle("index.html", (p) =>
      p === "index.html"
        ? `<link rel="stylesheet" href="nope.css"><script src="missing.js"></script>`
        : null
    );
    expect(out.missing.sort()).toEqual(["missing.js", "nope.css"]);
    expect(out.html.startsWith('<script data-paperos="bridge">')).toBe(true);
  });

  it("explains a missing entry", async () => {
    const out = await bundle("index.html", () => null);
    expect(out.html).toContain("No such file: index.html");
  });
});
