import { describe, expect, it } from "vitest";
import {
  blockProps,
  flattenBlocks,
  isComposedPage,
  pageFromPath,
  parsePage,
  renderPage,
  serializePage,
  validatePage,
} from "./pages";
import { designCore } from "./render";
import { STARTER_COMPONENTS } from "./starter";

const core = () => designCore({ components: STARTER_COMPONENTS });

describe("page files", () => {
  it("parses a composed page with nested blocks, links and bindings", () => {
    const { page, errors } = parsePage(
      JSON.stringify({
        title: "Home",
        route: "/",
        layout: { columns: 12, gap: "5" },
        components: [
          { id: "hero", name: "Hero", span: 12, props: { title: "Hi" } },
          {
            id: "grid",
            name: "Grid",
            span: 8,
            children: [
              { id: "a", name: "Stat", span: 4 },
              { id: "b", name: "Badge", span: 4, variant: "primary" },
            ],
          },
          {
            id: "tbl",
            name: "Table",
            span: 20,
            bindings: [{ table: "users", fields: ["name"] }],
          },
        ],
        links: [{ to: "products", label: "Shop", from: "hero" }, "admin"],
        bindings: [{ table: "roles" }],
      }),
      "pages/home.json"
    );
    expect(page?.name).toBe("home");
    expect(page?.route).toBe("/");
    expect(page?.layout).toEqual({ columns: 12, gap: "5" });
    expect(flattenBlocks(page!.components).map((b) => b.id)).toEqual([
      "hero",
      "grid",
      "a",
      "b",
      "tbl",
    ]);
    expect(page?.components[2].span).toBe(12);
    expect(errors).toEqual([
      "pages/home.json.components[2] (tbl): span 20 is not between 1 and 12",
    ]);
    expect(page?.links).toEqual([
      { to: "products", label: "Shop", from: "hero" },
      { to: "admin" },
    ]);
    expect(page?.bindings).toEqual([{ table: "roles" }]);
    expect(isComposedPage(page!)).toBe(true);
  });

  it("still reads M4 page files", () => {
    const { page } = parsePage(
      JSON.stringify({
        name: "home",
        title: "Home",
        path: "/",
        file: "index.html",
        components: ["side-menu", "mega-menu"],
        bindings: [{ table: "roles", fields: ["name", "level"], mode: "read" }],
      })
    );
    expect(page?.file).toBe("index.html");
    expect(page?.components.map((b) => b.name)).toEqual([
      "side-menu",
      "mega-menu",
    ]);
    expect(page?.route).toBe("/");
    expect(pageFromPath("pages/home.json")).toBe("home");
    expect(pageFromPath("pages/x/home.json")).toBeNull();
  });

  it("validates against the library and the other pages", () => {
    const { page } = parsePage(
      JSON.stringify({
        name: "p",
        route: "nope",
        components: [{ id: "x", name: "Missing" }],
        links: [{ to: "ghost", from: "y" }],
      })
    );
    expect(
      validatePage(page!, STARTER_COMPONENTS, [{ name: "p", route: "/p" }])
    ).toEqual([
      'route "nope" must start with /',
      'block "x": unknown component "Missing"',
      'link to unknown page "ghost"',
      'link from unknown block "y"',
    ]);
  });

  it("round-trips through serialize", () => {
    const text = JSON.stringify({
      name: "a",
      title: "A",
      route: "/a",
      device: "mobile",
      components: [
        {
          id: "h",
          name: "Hero",
          span: 6,
          props: { title: "x" },
          bindings: [{ table: "t" }],
        },
      ],
      links: [{ to: "b" }],
    });
    const { page } = parsePage(text);
    const again = parsePage(serializePage(page!)).page;
    expect(again).toEqual(page);
    expect(JSON.parse(serializePage(page!)).device).toBe("mobile");
  });

  it("feeds a block's binding into its props", () => {
    expect(
      blockProps({
        id: "t",
        name: "Table",
        span: 12,
        props: { caption: "Users" },
        bindings: [{ table: "users", fields: ["name"], order: "-id" }],
      })
    ).toEqual({
      caption: "Users",
      table: "users",
      fields: ["name"],
      order: "-id",
    });
    expect(
      blockProps({
        id: "t",
        name: "Table",
        span: 12,
        props: { table: "roles" },
        bindings: [{ table: "users" }],
      }).table
    ).toBe("roles");
  });

  it("renders a document with the grid, spans and nested children", () => {
    const { page } = parsePage(
      JSON.stringify({
        name: "home",
        title: "Home <1>",
        route: "/",
        components: [
          { id: "hero", name: "Hero", span: 12, props: { title: "Welcome" } },
          {
            id: "row",
            name: "Grid",
            span: 12,
            props: { columns: 2 },
            children: [{ id: "b1", name: "Badge", props: { text: "inner" } }],
          },
        ],
      })
    );
    const html = renderPage(page!, core(), {
      css: ":root{--x:1}",
      markBlocks: true,
    });
    expect(html).toContain("<title>Home &lt;1&gt;</title>");
    expect(html).toContain(
      '<body class="ds-page" data-page="home" data-route="/"'
    );
    expect(html).toContain("--ds-page-columns: 12");
    expect(html).toContain(
      '<div class="ds-col" style="grid-column: span 12" data-block="hero" data-block-name="Hero">'
    );
    expect(html).toContain('<h1 class="ds-hero__title">Welcome</h1>');
    expect(html).toContain("--ds-block-columns: 2");
    expect(html).toContain('data-block="b1"');
    expect(html).toContain("inner");
    expect(html).toContain(":root{--x:1}");
  });
});
