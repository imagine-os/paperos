import { describe, expect, it } from "vitest";
import { scanBindings } from "@/data/bindings";
import { parseSchema } from "@/data/schema";
import { parsePage } from "@/design/pages";
import { STARTER_COMPONENTS } from "@/design/starter";
import { defaultTokens } from "@/design/tokens";
import { sampleProjectFiles } from "@/ide/project/sample";
import { DEFAULT_MAP_LAYOUT, layoutMap } from "./layout";
import { buildProjectMap, nodeKey, type MapInput } from "./model";

/** The sample project as map input (what generate.ts gathers in the browser). */
function sampleInput(): MapInput {
  const files = sampleProjectFiles();
  const schema = parseSchema(files["data/schema.json"]).schema;
  const paths = Object.keys(files);
  const bindings = scanBindings(
    paths
      .filter((p) => !p.startsWith("data/"))
      .map((p) => ({ path: p, text: files[p] })),
    schema
  );
  const pages = paths
    .filter((p) => /^pages\/.*\.json$/.test(p))
    .map((p) => parsePage(files[p], p).page!)
    .filter(Boolean);
  const rowCounts: Record<string, number> = {};
  for (const t of schema.tables)
    rowCounts[t.name] = JSON.parse(files[`data/${t.name}.json`]).length;
  return {
    files: paths,
    schema,
    rowCounts,
    bindings,
    components: STARTER_COMPONENTS,
    pages,
    tokens: defaultTokens(),
  };
}

describe("buildProjectMap", () => {
  const graph = buildProjectMap(sampleInput());
  const keys = new Set(graph.nodes.map((n) => n.key));
  const edge = (from: string, to: string) =>
    graph.edges.find((e) => e.from === from && e.to === to);

  it("makes one node per table, code file, component, page and the tokens", () => {
    expect(graph.sections.map((s) => s.id)).toEqual([
      "data",
      "code",
      "design",
      "components",
      "pages",
      "flows",
    ]);
    for (const t of ["roles", "users", "menu_items", "pages"])
      expect(keys.has(nodeKey.table(t)), t).toBe(true);
    expect(graph.nodes.find((n) => n.key === "table:menu_items")).toMatchObject(
      {
        section: "data",
        subtitle: "11 rows · 10 columns",
        facts: ["parent_id → menu_items", "required_role → roles"],
        target: { type: "table", table: "menu_items" },
      }
    );
    for (const f of [
      "index.html",
      "app.js",
      "styles.css",
      "README.md",
      "plugins/hello.js",
    ])
      expect(keys.has(nodeKey.file(f)), f).toBe(true);
    // Data, design and page files are not code nodes.
    expect(keys.has(nodeKey.file("data/roles.json"))).toBe(false);
    expect(keys.has(nodeKey.file("design/components/Card.json"))).toBe(false);
    expect(keys.has(nodeKey.component("Card"))).toBe(true);
    // M4 component declarations join the Components section.
    expect(
      graph.nodes.find((n) => n.key === "component:side-menu")
    ).toMatchObject({
      section: "components",
      target: { type: "file", path: "components/side-menu.json" },
    });
    expect(graph.nodes.find((n) => n.key === "page:home")).toMatchObject({
      section: "pages",
      subtitle: "/",
      target: { type: "page", name: "home" },
    });
    expect(keys.has(nodeKey.flow("products"))).toBe(true);
    expect(graph.nodes.find((n) => n.key === "design:tokens")?.subtitle).toBe(
      "8 colors · 7 sizes · 8 spaces"
    );
    expect(new Set(graph.nodes.map((n) => n.key)).size).toBe(
      graph.nodes.length
    );
  });

  it("draws edges from the bindings, page usage, page links and tokens", () => {
    expect(edge("table:menu_items", "component:side-menu")?.kind).toBe(
      "binding"
    );
    expect(edge("table:menu_items", "file:index.html")?.kind).toBe("binding");
    expect(edge("table:menu_items", "file:app.js")?.kind).toBe("binding");
    expect(edge("table:users", "page:admin")).toMatchObject({
      kind: "binding",
      label: "write",
    });
    expect(edge("table:roles", "page:home")?.kind).toBe("binding");
    expect(edge("component:Hero", "page:home")?.kind).toBe("usage");
    expect(edge("component:Table", "page:admin")?.kind).toBe("usage");
    expect(edge("flow:home", "flow:products")).toMatchObject({
      kind: "link",
      label: "Browse products",
    });
    expect(edge("flow:products", "flow:home")?.kind).toBe("link");
    expect(edge("design:tokens", "component:Badge")?.kind).toBe("tokens");
    // Every edge joins two existing nodes, once.
    for (const e of graph.edges) {
      expect(keys.has(e.from), e.from).toBe(true);
      expect(keys.has(e.to), e.to).toBe(true);
    }
    expect(new Set(graph.edges.map((e) => `${e.from}>${e.to}`)).size).toBe(
      graph.edges.length
    );
  });

  it("collapses big folders, adds growth/ops sections only when the folders exist", () => {
    const input = sampleInput();
    const many = Array.from({ length: 40 }, (_, i) => `src/lib/mod${i}.js`);
    const g = buildProjectMap({
      ...input,
      files: [...input.files, ...many, "growth/plan.md", "ops/deploy.md"],
    });
    expect(g.nodes.find((n) => n.key === "folder:src/lib")).toMatchObject({
      section: "code",
      subtitle: "40 files",
    });
    expect(g.nodes.some((n) => n.key === "file:src/lib/mod1.js")).toBe(false);
    expect(g.nodes.find((n) => n.key === "file:index.html")?.section).toBe(
      "code"
    );
    expect(g.sections.map((s) => s.id)).toContain("growth");
    expect(g.nodes.find((n) => n.key === "file:ops/deploy.md")?.section).toBe(
      "ops"
    );
    expect(buildProjectMap(input).sections.map((s) => s.id)).not.toContain(
      "growth"
    );
  });

  it("copes with an empty project", () => {
    const g = buildProjectMap({
      files: [],
      schema: { tables: [] },
      rowCounts: {},
      bindings: { bindings: [], sources: [] },
      components: [],
      pages: [],
      tokens: null,
    });
    expect(g).toEqual({ sections: [], nodes: [], edges: [] });
  });
});

describe("layoutMap", () => {
  const graph = buildProjectMap(sampleInput());
  const overlaps = (
    a: { x: number; y: number; w: number; h: number },
    b: typeof a
  ) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  it("orders sections left to right without overlaps and keeps nodes inside their section", () => {
    const l = layoutMap(graph);
    expect(l.sections.map((s) => s.id)).toEqual(
      graph.sections.map((s) => s.id)
    );
    for (let i = 1; i < l.sections.length; i++) {
      const prev = l.sections[i - 1];
      expect(l.sections[i].x).toBeGreaterThanOrEqual(
        prev.x + prev.w + DEFAULT_MAP_LAYOUT.sectionGap - 1
      );
    }
    for (const n of l.nodes) {
      const s = l.sections.find((x) => x.id === n.section)!;
      expect(n.x).toBeGreaterThanOrEqual(s.x);
      expect(n.y).toBeGreaterThanOrEqual(s.y);
      expect(n.x + n.w).toBeLessThanOrEqual(s.x + s.w);
      expect(n.y + n.h).toBeLessThanOrEqual(s.y + s.h);
    }
    for (const a of l.nodes)
      for (const b of l.nodes)
        if (a !== b) expect(overlaps(a, b), `${a.key} / ${b.key}`).toBe(false);
    expect(l.nodes).toHaveLength(graph.nodes.length);
    expect(l.bounds.w).toBeGreaterThan(0);
    // The component section has more than 8 nodes, so it uses two columns.
    const comps = l.nodes.filter((n) => n.section === "components");
    expect(new Set(comps.map((n) => n.x)).size).toBe(2);
    // UX flows read left to right: one row.
    const flows = l.nodes.filter((n) => n.section === "flows");
    expect(flows.length).toBe(3);
    expect(new Set(flows.map((n) => n.y)).size).toBe(1);
  });

  it("keeps the positions it is given and places new nodes in free slots", () => {
    const first = layoutMap(graph);
    const moved = { ...first.nodes.find((n) => n.key === "table:users")! };
    const keep = { "table:users": { x: moved.x + 500, y: moved.y + 900 } };
    const l = layoutMap(graph, keep);
    const users = l.nodes.find((n) => n.key === "table:users")!;
    expect(users.x).toBe(moved.x + 500);
    expect(users.y).toBe(moved.y + 900);
    for (const a of l.nodes)
      for (const b of l.nodes)
        if (a !== b) expect(overlaps(a, b), `${a.key} / ${b.key}`).toBe(false);
    const data = l.sections.find((s) => s.id === "data")!;
    expect(data.x + data.w).toBeGreaterThanOrEqual(users.x + users.w);
    expect(data.y + data.h).toBeGreaterThanOrEqual(users.y + users.h);
  });
});
