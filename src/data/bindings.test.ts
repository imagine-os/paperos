import { describe, expect, it } from "vitest";
import { scanBindings, scanHtml, scanJs, scanJson } from "./bindings";
import { parseSchema } from "./schema";

const schema = parseSchema(
  JSON.stringify({
    tables: [
      { name: "roles", columns: ["name"] },
      {
        name: "menu_items",
        columns: [
          "label",
          "category",
          "icon",
          { name: "parent_id", type: "ref", ref: "menu_items" },
        ],
      },
      { name: "pages", columns: ["title"] },
      { name: "orphans", columns: [] },
    ],
  })
).schema;

const html = `<!doctype html>
<html><body>
  <ul id="menu" data-source="menu_items" data-filter="parent_id=null" data-order="sort">
    <li data-field="label"><span data-field="icon" data-as="icon"></span>
      <ul data-source="menu_items" data-filter="parent_id={id}">
        <li data-field="label"></li>
      </ul>
    </li>
  </ul>
  <div data-source='pages' data-group="section"><h3 data-field="$group"></h3><a data-field="title"></a><a data-field="nope"></a></div>
  <div data-source="ghosts"><p data-field="x"></p></div>
</body></html>`;

describe("scanHtml", () => {
  it("finds data-source lists with their fields, filters and lines", () => {
    const b = scanHtml("index.html", html);
    expect(
      b.map((x) => [
        x.table,
        x.line,
        x.fields,
        x.filter ?? "",
        x.order ?? "",
        x.group ?? "",
      ])
    ).toEqual([
      ["menu_items", 3, ["label", "icon"], "parent_id=null", "sort", ""],
      ["menu_items", 5, ["label"], "parent_id={id}", "", ""],
      ["pages", 10, ["title", "nope"], "", "", "section"],
      ["ghosts", 11, ["x"], "", "", ""],
    ]);
    expect(b[0]).toMatchObject({
      kind: "html",
      mode: "read",
      path: "index.html",
      source: "index.html",
    });
  });
});

describe("scanJs", () => {
  it("finds paperos.data calls with modes and fields", () => {
    const js = `const roles = paperos.data.roles.list({ orderBy: "level" });
paperos.data.menu_items
  .list({ where: { parent_id: null, category: "x" }, orderBy: "-sort" });
paperos.data.tables();
paperos.data.hydrate(document);
await paperos.data.users.insert({ email });
const t = paperos.data.table("pages");`;
    const b = scanJs("app.js", js);
    expect(b.map((x) => [x.table, x.mode, x.line, x.fields])).toEqual([
      ["roles", "read", 1, ["level"]],
      ["menu_items", "read", 2, ["parent_id", "category", "sort"]],
      ["users", "write", 6, []],
      ["pages", "read", 7, []],
    ]);
  });
});

describe("scanJson", () => {
  it("reads component and page declarations", () => {
    const comp = `{
  "name": "Side menu",
  "bindings": [
    { "table": "menu_items", "fields": ["label", "icon"], "mode": "read" },
    { "table": "roles", "mode": "write" }
  ]
}`;
    const r = scanJson("components/side-menu.json", comp);
    expect(r.name).toBe("Side menu");
    expect(
      r.bindings.map((b) => [b.table, b.mode, b.line, b.kind, b.source])
    ).toEqual([
      ["menu_items", "read", 4, "component", "Side menu"],
      ["roles", "write", 5, "component", "Side menu"],
    ]);
    const page = scanJson(
      "pages/home.json",
      `{"components": ["side-menu", "mega-menu"], "bindings": [{"table": "pages"}]}`
    );
    expect(page.components).toEqual(["side-menu", "mega-menu"]);
    expect(page.bindings[0]).toMatchObject({
      kind: "page",
      source: "home",
      table: "pages",
    });
    expect(scanJson("components/bad.json", "{oops")).toEqual({
      bindings: [],
      components: [],
      name: "bad",
    });
  });
});

describe("scanBindings", () => {
  it("indexes by table and source and reports unused tables and broken bindings", () => {
    const index = scanBindings(
      [
        { path: "index.html", text: html },
        {
          path: "app.js",
          text: "paperos.data.roles.list()\npaperos.data.missing.get(1)",
        },
        {
          path: "components/side-menu.json",
          text: JSON.stringify({
            bindings: [{ table: "menu_items", fields: ["label", "ghost"] }],
          }),
        },
        {
          path: "pages/home.json",
          text: JSON.stringify({
            components: ["side-menu"],
            bindings: [{ table: "pages" }],
          }),
        },
        { path: "data/roles.json", text: "[]" },
        { path: "styles.css", text: "body{}" },
      ],
      schema
    );
    expect(index.tables).toEqual(["roles", "menu_items", "pages", "orphans"]);
    expect(Object.keys(index.byTable).sort()).toEqual([
      "ghosts",
      "menu_items",
      "missing",
      "pages",
      "roles",
    ]);
    expect(index.byTable.menu_items.map((b) => b.path)).toEqual([
      "components/side-menu.json",
      "index.html",
      "index.html",
    ]);
    expect(index.unusedTables).toEqual(["orphans"]);
    expect(
      index.broken.map(
        (p) => `${p.binding.path}:${p.binding.line} ${p.message}`
      )
    ).toEqual([
      'app.js:2 table "missing" does not exist',
      'components/side-menu.json:1 column "ghost" is not in menu_items',
      'index.html:10 column "nope" is not in pages',
      'index.html:11 table "ghosts" does not exist',
    ]);
    const home = index.sources.find((s) => s.path === "pages/home.json")!;
    expect(home.kind).toBe("page");
    expect(home.tables).toEqual(["pages"]);
    expect(home.indirect).toEqual([{ table: "menu_items", via: "side-menu" }]);
    expect(index.sources.map((s) => s.kind)).toEqual([
      "js",
      "component",
      "html",
      "page",
    ]);
    expect(index.bySource["data/roles.json"]).toBeUndefined();
  });
});
