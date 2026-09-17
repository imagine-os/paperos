import { describe, expect, it } from "vitest";
import { layoutBoard, overlaps } from "@/boards/layout";
import { validateBoard } from "@/boards/model";
import { scanBindings } from "@/data/bindings";
import { parseSchema } from "@/data/schema";
import { parseComponents } from "@/design/components";
import { parsePage } from "@/design/pages";
import { sampleProjectFiles } from "@/ide/project/sample";
import {
  buildLineage,
  lineageBoard,
  lineageFocus,
  lineageForPage,
  lineageKey,
  lineagePageBoard,
  type LineageInput,
} from "./model";

function inputFromFiles(files: Record<string, string>): LineageInput {
  const schema = parseSchema(files["data/schema.json"]).schema;
  const list = Object.entries(files).map(([path, text]) => ({ path, text }));
  const bindings = scanBindings(list, schema);
  const components = parseComponents(
    list.filter((f) => f.path.startsWith("design/components/"))
  ).components;
  const pages = list
    .filter((f) => /^pages\/.+\.json$/.test(f.path))
    .map((f) => parsePage(f.text, f.path).page!)
    .filter(Boolean);
  return { schema, bindings, components, pages, rowCounts: { roles: 3 } };
}

const small = (): LineageInput =>
  inputFromFiles({
    "data/schema.json": JSON.stringify({
      tables: [
        {
          name: "roles",
          columns: [
            { name: "id", type: "number" },
            { name: "name", type: "string" },
          ],
        },
        {
          name: "users",
          columns: [
            { name: "id", type: "number" },
            { name: "name", type: "string" },
            { name: "role_id", type: "ref", ref: "roles" },
          ],
        },
        { name: "orphan", columns: [{ name: "id", type: "number" }] },
      ],
    }),
    "design/components/Table.json": JSON.stringify({
      name: "Table",
      description: "Rows",
      props: [{ name: "table", type: "table" }],
      template: "<table></table>",
    }),
    "design/components/Stat.json": JSON.stringify({
      name: "Stat",
      props: [{ name: "table", type: "table" }],
      template: "<b></b>",
    }),
    "pages/admin.json": JSON.stringify({
      name: "admin",
      title: "Admin",
      route: "/admin",
      components: [
        {
          id: "users-table",
          name: "Table",
          bindings: [{ table: "users", fields: ["name", "role_id"] }],
        },
        {
          id: "new-user",
          name: "Form",
          bindings: [{ table: "users", fields: ["name"], mode: "write" }],
        },
        {
          id: "grid",
          name: "Grid",
          children: [
            {
              id: "count",
              name: "Stat",
              props: { table: "roles", filter: "level>1" },
            },
          ],
        },
      ],
      bindings: [{ table: "roles", fields: ["name"] }],
    }),
    "pages/home.json": JSON.stringify({
      name: "home",
      title: "Home",
      route: "/",
      components: [
        { id: "hero", name: "Hero" },
        {
          id: "roles-list",
          name: "Table",
          bindings: [{ table: "roles", fields: ["name"], filter: "level>0" }],
        },
      ],
    }),
  });

describe("buildLineage", () => {
  it("makes tables, data-bound components and pages with labeled edges", () => {
    const g = buildLineage(small());
    expect(g.tables.map((t) => t.name)).toEqual(["roles", "users", "orphan"]);
    expect(g.tables[0].rows).toBe(3);
    expect(g.tables[1].columns[2]).toEqual({
      name: "role_id",
      type: "ref",
      ref: "roles",
    });
    // Hero and Grid bind nothing, so they are not components here; Stat is, through its table prop.
    expect(g.components.map((c) => c.name).sort()).toEqual([
      "Form",
      "Stat",
      "Table",
    ]);
    const table = g.components.find((c) => c.name === "Table")!;
    expect(table.tables.sort()).toEqual(["roles", "users"]);
    expect(table.pages.sort()).toEqual(["admin", "home"]);
    expect(g.pages.map((p) => p.name)).toEqual(["admin", "home"]);
    expect(g.pages[0].components).toEqual(["Table", "Form", "Stat"]);
    expect(g.pages[0].tables.sort()).toEqual(["roles", "users"]);

    const e = (from: string, to: string, mode = "read") =>
      g.edges.find((x) => x.from === from && x.to === to && x.mode === mode)!;
    expect(
      e(lineageKey.table("users"), lineageKey.component("Table"))
    ).toMatchObject({
      kind: "table-component",
      label: "name, role_id",
      pages: ["admin"],
    });
    expect(
      e(lineageKey.table("users"), lineageKey.component("Form"), "write").label
    ).toBe("name (write)");
    expect(
      e(lineageKey.table("roles"), lineageKey.component("Stat")).label
    ).toBe("all columns where level>1");
    // The same component reads roles on home with a filter: one edge, both pages.
    const rolesTable = e(
      lineageKey.table("roles"),
      lineageKey.component("Table")
    );
    expect(rolesTable.pages).toEqual(["home"]);
    expect(rolesTable.label).toBe("name where level>0");
    expect(
      e(lineageKey.component("Table"), lineageKey.page("admin"))
    ).toMatchObject({
      kind: "component-page",
      blocks: ["users-table"],
    });
    expect(
      e(lineageKey.table("roles"), lineageKey.page("admin"))
    ).toMatchObject({
      kind: "table-page",
      label: "name",
    });
  });

  it("focuses one page and reduces the graph to it", () => {
    const g = buildLineage(small());
    const all = lineageFocus(g, null);
    expect(all.nodes.size).toBe(
      g.tables.length + g.components.length + g.pages.length
    );
    const home = lineageFocus(g, "home");
    expect([...home.nodes].sort()).toEqual([
      lineageKey.component("Table"),
      lineageKey.page("home"),
      lineageKey.table("roles"),
    ]);
    expect(lineageFocus(g, "nope").nodes.size).toBe(0);
    const sub = lineageForPage(g, "admin");
    expect(sub.tables.map((t) => t.name).sort()).toEqual(["roles", "users"]);
    expect(sub.components.map((c) => c.name).sort()).toEqual([
      "Form",
      "Stat",
      "Table",
    ]);
    expect(sub.pages).toHaveLength(1);
    expect(sub.edges.every((e) => e.pages.includes("admin"))).toBe(true);
  });

  it("turns the graph into valid, overlap-free boards", () => {
    const g = buildLineage(small());
    const board = lineageBoard(g);
    expect(validateBoard(board)).toEqual([]);
    expect(board.sections.map((s) => s.id)).toEqual([
      "controls",
      "tables",
      "components",
      "pages",
    ]);
    expect(board.arrows.length).toBe(g.edges.length);
    const l = layoutBoard(board);
    for (const a of l.windows)
      for (const b of l.windows)
        if (a !== b) expect(overlaps(a, b), `${a.id} / ${b.id}`).toBe(false);
    const single = lineagePageBoard(g, "home");
    expect(validateBoard(single)).toEqual([]);
    expect(single.sections.map((s) => s.id)).toEqual([
      "tables",
      "components",
      "page",
    ]);
    expect(single.sections[2].windows.map((w) => w.kind)).toEqual([
      "pages",
      "preview",
    ]);
    expect(single.sections[2].windows[1].content).toBe(
      "pages/home.json?sources=1"
    );
    // Arrows into the page land on the Page Builder window.
    expect(single.arrows.some((a) => a.to === "builder:home")).toBe(true);
    expect(() => lineagePageBoard(g, "nope")).toThrow(/No page/);
  });

  it("covers the sample project: every page has bound components", () => {
    const g = buildLineage(inputFromFiles(sampleProjectFiles()));
    expect(g.tables.map((t) => t.name)).toEqual([
      "roles",
      "users",
      "menu_items",
      "pages",
    ]);
    expect(g.pages.map((p) => p.name).sort()).toEqual([
      "admin",
      "home",
      "products",
    ]);
    for (const p of g.pages)
      expect(p.components.length, p.name).toBeGreaterThan(0);
    // The M4 declarations (side-menu, mega-menu) bind menu_items and roles.
    expect(g.components.some((c) => c.kind === "declared")).toBe(true);
    const board = lineageBoard(g);
    expect(validateBoard(board)).toEqual([]);
    expect(layoutBoard(board).windows.length).toBe(
      1 + g.tables.length + g.components.length + g.pages.length
    );
  });
});
