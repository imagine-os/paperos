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

  it("injects the data runtime with the tables when the project has a schema", async () => {
    const withData: Record<string, string> = {
      "index.html": `<html><head></head><body><ul data-source="roles"><li data-field="name"></li></ul></body></html>`,
      "data/schema.json": `{"tables":[{"name":"roles","columns":[{"name":"id","type":"number"},"name"]}]}`,
      "data/roles.json": `[{"id":1,"name":"Admin"}]`,
    };
    const out = await bundle("index.html", (p) => withData[p] ?? null);
    expect(out.html).toContain('<script data-paperos="data">');
    expect(out.html).toContain('"roles":[{"id":1,"name":"Admin"}]');
    expect(out.html.indexOf('data-paperos="bridge"')).toBeLessThan(
      out.html.indexOf('data-paperos="data"')
    );
    expect(out.deps).toEqual(
      expect.arrayContaining(["data/schema.json", "data/roles.json"])
    );
    const without = await bundle("index.html", read);
    expect(without.html).not.toContain('data-paperos="data"');
  });

  it("explains a missing entry", async () => {
    const out = await bundle("index.html", () => null);
    expect(out.html).toContain("No such file: index.html");
  });

  const designFiles: Record<string, string> = {
    "index.html": `<html><head></head><body><ds-component name="Badge"></ds-component></body></html>`,
    "design/tokens.json": `{"color":{"primary":"#ff0000"}}`,
    "design/components/Badge.json": `{"name":"Badge","props":[{"name":"text","default":"New"}],"template":"<span class=\\"ds-badge\\">{text}</span>"}`,
    "pages/home.json": `{"title":"Home","route":"/","components":[{"id":"b","name":"Badge","span":6,"props":{"text":"Hi"}}]}`,
    "pages/about.json": `{"title":"About","route":"/about"}`,
  };
  const designRead = (p: string) => designFiles[p] ?? null;
  const list = () => Object.keys(designFiles);

  it("injects the token CSS and the design runtime when the project has a design system", async () => {
    const out = await bundle("index.html", designRead, { list });
    expect(out.html).toContain('<style data-paperos="tokens">');
    expect(out.html).toContain("--ds-color-primary: #ff0000;");
    expect(out.html).toContain(".ds-button {");
    expect(out.html).toContain('<script data-paperos="design">');
    expect(out.html).toContain('"routes":{"/":"home","/about":"about"}');
    expect(out.deps).toEqual(
      expect.arrayContaining([
        "design/tokens.json",
        "design/components/Badge.json",
      ])
    );
    // Without a file list the components cannot be found, but tokens still apply.
    const noList = await bundle("index.html", designRead);
    expect(noList.html).toContain('data-paperos="tokens"');
    expect(noList.html).not.toContain('data-paperos="design"');
  });

  it("renders a pages/*.json entry from its blocks", async () => {
    const out = await bundle("pages/home.json", designRead, {
      list,
      markBlocks: true,
    });
    expect(out.html).toContain("<title>Home</title>");
    expect(out.html).toContain('data-block="b"');
    expect(out.html).toContain('<span class="ds-badge">Hi</span>');
    expect(out.html).toContain("--ds-color-primary: #ff0000;");
    // The bridge and runtimes are injected into the generated head, the token style only once.
    expect(out.html).toContain('data-paperos="bridge"');
    expect(out.html).toContain('data-paperos="design"');
    expect(out.html.match(/--ds-color-primary: #ff0000;/g)).toHaveLength(1);
    expect(out.deps).toContain("pages/home.json");
    const missing = await bundle("pages/nope.json", designRead, { list });
    expect(missing.html).toContain("No such page: pages/nope.json");
  });
});
