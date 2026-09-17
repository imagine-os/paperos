/**
 * Data lineage: where every component on every page gets its data. Built
 * from the schema, the bindings index and the pages, as three columns,
 * Tables → Components → Pages, with edges labeled by the bound fields (and
 * filter). Pure; `open.ts` turns the graph into a board (frames of Card
 * windows with arrows) and draws it with the boards machinery.
 *
 *   tables      one node per table of data/schema.json, with its columns
 *   components  one node per component that binds data: a design component
 *               used by a page block with a binding, or an M4 component
 *               declaration (components/*.json)
 *   pages       one node per page (pages/*.json)
 *   edges       table → component (fields, filter, mode, the pages it happens on),
 *               component → page (the block ids), table → page (page-level bindings)
 */
import type { Binding, BindingIndex } from "@/data/bindings";
import type { DataSchema } from "@/data/schema";
import type { ComponentDef } from "@/design/components";
import type { PageBlock, PageDef } from "@/design/pages";
import type { BoardDef, BoardWindowSpec } from "@/boards/model";
import type { CardContent } from "@/map/model";

export interface LineageInput {
  schema: DataSchema;
  rowCounts?: Record<string, number>;
  bindings: Pick<BindingIndex, "bindings" | "sources">;
  components: ComponentDef[];
  pages: PageDef[];
}

export interface LineageTable {
  key: string;
  name: string;
  columns: { name: string; type: string; ref?: string }[];
  rows: number;
}

export interface LineageComponent {
  key: string;
  name: string;
  /** Design component (pages use it as blocks) or an M4 declaration file. */
  kind: "design" | "declared";
  path?: string;
  description?: string;
  tables: string[];
  pages: string[];
}

export interface LineagePage {
  key: string;
  name: string;
  title: string;
  route: string;
  /** Components with bindings on this page, in block order. */
  components: string[];
  tables: string[];
}

export interface LineageEdge {
  from: string;
  to: string;
  kind: "table-component" | "component-page" | "table-page";
  label: string;
  fields: string[];
  filter?: string;
  mode: "read" | "write";
  /** Pages this edge belongs to (component-page edges: the one page). */
  pages: string[];
  /** Block ids on those pages (component-page edges). */
  blocks?: string[];
}

export interface LineageGraph {
  tables: LineageTable[];
  components: LineageComponent[];
  pages: LineagePage[];
  edges: LineageEdge[];
}

export const lineageKey = {
  table: (name: string) => `table:${name}`,
  component: (name: string) => `component:${name}`,
  page: (name: string) => `page:${name}`,
};

function pageNameOf(path: string, source: string): string {
  const m = /^pages\/(.+)\.json$/.exec(path);
  return m ? m[1] : source;
}

function walkBlocks(blocks: PageBlock[], visit: (b: PageBlock) => void): void {
  for (const b of blocks) {
    visit(b);
    if (b.children) walkBlocks(b.children, visit);
  }
}

function labelFor(fields: string[], filter?: string, mode?: string): string {
  const shown = fields.length
    ? fields.length > 4
      ? `${fields.slice(0, 4).join(", ")} +${fields.length - 4}`
      : fields.join(", ")
    : "all columns";
  const parts = [shown];
  if (filter) parts.push(`where ${filter}`);
  if (mode === "write") parts.push("(write)");
  return parts.join(" ");
}

export function buildLineage(input: LineageInput): LineageGraph {
  const tables: LineageTable[] = input.schema.tables.map((t) => ({
    key: lineageKey.table(t.name),
    name: t.name,
    columns: t.columns.map((c) => ({
      name: c.name,
      type: c.type,
      ...(c.ref ? { ref: c.ref } : {}),
    })),
    rows: input.rowCounts?.[t.name] ?? 0,
  }));
  const tableNames = new Set(tables.map((t) => t.name));

  const components = new Map<string, LineageComponent>();
  const pages: LineagePage[] = [];
  const edges = new Map<string, LineageEdge>();
  const edge = (e: LineageEdge) => {
    const k = `${e.from}>${e.to}>${e.mode}`;
    const existing = edges.get(k);
    if (!existing) {
      edges.set(k, { ...e, fields: [...e.fields], pages: [...e.pages] });
      return;
    }
    for (const f of e.fields)
      if (!existing.fields.includes(f)) existing.fields.push(f);
    for (const p of e.pages)
      if (!existing.pages.includes(p)) existing.pages.push(p);
    if (e.blocks) existing.blocks = [...(existing.blocks ?? []), ...e.blocks];
    if (e.filter && existing.filter && e.filter !== existing.filter)
      existing.filter = `${existing.filter} | ${e.filter}`;
    else if (e.filter && !existing.filter) existing.filter = e.filter;
    existing.label = labelFor(existing.fields, existing.filter, existing.mode);
  };
  const component = (
    name: string,
    kind: LineageComponent["kind"],
    extra: Partial<LineageComponent> = {}
  ): LineageComponent => {
    let c = components.get(name);
    if (!c) {
      c = {
        key: lineageKey.component(name),
        name,
        kind,
        tables: [],
        pages: [],
        ...extra,
      };
      components.set(name, c);
    }
    return c;
  };
  const defs = new Map(input.components.map((c) => [c.name, c]));

  // ----- Pages: blocks with bindings, and page-level bindings.
  for (const p of input.pages) {
    const page: LineagePage = {
      key: lineageKey.page(p.name),
      name: p.name,
      title: p.title,
      route: p.route,
      components: [],
      tables: [],
    };
    pages.push(page);
    const touch = (table: string) => {
      if (!page.tables.includes(table)) page.tables.push(table);
    };
    walkBlocks(p.components, (b) => {
      // Bindings declared on the block, plus a `table` prop (Stat, Chart, Sidebar...).
      const bound: {
        table: string;
        fields: string[];
        filter?: string;
        mode: "read" | "write";
      }[] = [];
      for (const bind of b.bindings ?? [])
        if (bind.table)
          bound.push({
            table: bind.table,
            fields: bind.fields ?? [],
            filter: bind.filter,
            mode: bind.mode === "write" ? "write" : "read",
          });
      const propTable = b.props.table;
      if (
        typeof propTable === "string" &&
        propTable &&
        tableNames.has(propTable) &&
        !bound.some((x) => x.table === propTable)
      )
        bound.push({
          table: propTable,
          fields: Array.isArray(b.props.fields)
            ? (b.props.fields as unknown[]).map(String)
            : [],
          filter:
            typeof b.props.filter === "string" && b.props.filter
              ? b.props.filter
              : undefined,
          mode: "read",
        });
      if (!bound.length) return;
      const def = defs.get(b.name);
      const c = component(b.name, "design", {
        description: def?.description,
      });
      if (!c.pages.includes(p.name)) c.pages.push(p.name);
      if (!page.components.includes(b.name)) page.components.push(b.name);
      for (const x of bound) {
        if (!c.tables.includes(x.table)) c.tables.push(x.table);
        touch(x.table);
        edge({
          from: lineageKey.table(x.table),
          to: c.key,
          kind: "table-component",
          label: labelFor(x.fields, x.filter, x.mode),
          fields: x.fields,
          ...(x.filter ? { filter: x.filter } : {}),
          mode: x.mode,
          pages: [p.name],
        });
      }
      edge({
        from: c.key,
        to: page.key,
        kind: "component-page",
        label: b.id,
        fields: [],
        mode: "read",
        pages: [p.name],
        blocks: [b.id],
      });
    });
    for (const bind of p.bindings) {
      if (!bind.table) continue;
      touch(bind.table);
      edge({
        from: lineageKey.table(bind.table),
        to: page.key,
        kind: "table-page",
        label: labelFor(bind.fields ?? [], bind.filter, bind.mode),
        fields: bind.fields ?? [],
        ...(bind.filter ? { filter: bind.filter } : {}),
        mode: bind.mode === "write" ? "write" : "read",
        pages: [p.name],
      });
    }
    // M4 pages list component names; those declarations bind tables of their own.
    for (const name of p.components
      .map((b) => b.name)
      .filter((n) => !defs.has(n))) {
      const decl = input.bindings.sources.find(
        (s) => s.kind === "component" && s.name === name
      );
      if (!decl) continue;
      const c = component(name, "declared", { path: decl.path });
      if (!c.pages.includes(p.name)) c.pages.push(p.name);
      if (!page.components.includes(name)) page.components.push(name);
      edge({
        from: c.key,
        to: page.key,
        kind: "component-page",
        label: name,
        fields: [],
        mode: "read",
        pages: [p.name],
      });
    }
  }

  // ----- Declared components (components/*.json) and their table bindings.
  const declared: Binding[] = input.bindings.bindings.filter(
    (b) => b.kind === "component" && !defs.has(b.source)
  );
  for (const b of declared) {
    const c = component(b.source, "declared", { path: b.path });
    if (!c.tables.includes(b.table)) c.tables.push(b.table);
    edge({
      from: lineageKey.table(b.table),
      to: c.key,
      kind: "table-component",
      label: labelFor(b.fields, b.filter, b.mode),
      fields: b.fields,
      ...(b.filter ? { filter: b.filter } : {}),
      mode: b.mode,
      pages: [...c.pages],
    });
    for (const p of c.pages) {
      const page = pages.find((x) => x.name === p);
      if (page && !page.tables.includes(b.table)) page.tables.push(b.table);
    }
  }
  // Page bindings recorded by the scanner (composed pages) point at pages too;
  // they are already covered above through the parsed page files.
  void pageNameOf;

  // Component-level "used by these pages" completes edges added before the page loop saw them.
  for (const e of edges.values())
    if (e.kind === "table-component" && !e.pages.length) {
      const c = [...components.values()].find((x) => x.key === e.to);
      if (c) e.pages = [...c.pages];
    }

  return {
    tables,
    components: [...components.values()],
    pages,
    edges: [...edges.values()],
  };
}

/** Node and edge keys that feed one page (or everything when page is null). */
export function lineageFocus(
  graph: LineageGraph,
  page: string | null
): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  const edgeKey = (e: LineageEdge) => `${e.from}>${e.to}>${e.mode}`;
  if (page === null) {
    for (const t of graph.tables) nodes.add(t.key);
    for (const c of graph.components) nodes.add(c.key);
    for (const p of graph.pages) nodes.add(p.key);
    for (const e of graph.edges) edges.add(edgeKey(e));
    return { nodes, edges };
  }
  const target = graph.pages.find((p) => p.name === page || p.key === page);
  if (!target) return { nodes, edges };
  nodes.add(target.key);
  for (const e of graph.edges) {
    if (!e.pages.includes(target.name)) continue;
    edges.add(edgeKey(e));
    nodes.add(e.from);
    nodes.add(e.to);
  }
  return { nodes, edges };
}

/** The lineage graph reduced to what one page uses. */
export function lineageForPage(
  graph: LineageGraph,
  page: string
): LineageGraph {
  const { nodes } = lineageFocus(graph, page);
  const edges = graph.edges.filter((e) => e.pages.includes(page));
  return {
    tables: graph.tables.filter((t) => nodes.has(t.key)),
    components: graph.components.filter((c) => nodes.has(c.key)),
    pages: graph.pages.filter((p) => p.name === page),
    edges,
  };
}

export const LINEAGE_BOARD = "data-lineage";

const CARD = { w: 260, h: 150 };

function tableCard(t: LineageTable): BoardWindowSpec {
  const content = {
    key: t.key,
    subtitle: `${t.rows} rows · ${t.columns.length} columns`,
    icon: "\u{1F5C3}",
    section: "data",
    facts: t.columns.map(
      (c) => `${c.name}: ${c.type}${c.ref ? ` → ${c.ref}` : ""}`
    ),
    target: { type: "table", table: t.name },
    lineage: "table",
  } satisfies CardContent & Record<string, unknown>;
  return {
    id: t.key,
    kind: "card",
    title: t.name,
    content,
    size: {
      w: CARD.w,
      h: Math.min(320, 92 + Math.min(t.columns.length, 10) * 16),
    },
  };
}

function componentCard(c: LineageComponent): BoardWindowSpec {
  const content = {
    key: c.key,
    subtitle:
      c.kind === "design"
        ? (c.description ?? "design component")
        : (c.path ?? "component declaration"),
    icon: "\u{1F9E9}",
    section: "components",
    facts: [
      ...c.tables.map((t) => `reads ${t}`),
      ...(c.pages.length ? [`on ${c.pages.join(", ")}`] : []),
    ],
    target:
      c.kind === "design"
        ? { type: "component", name: c.name }
        : c.path
          ? { type: "file", path: c.path }
          : { type: "none" },
    lineage: "component",
  } satisfies CardContent & Record<string, unknown>;
  return {
    id: c.key,
    kind: "card",
    title: c.name,
    content,
    size: { w: CARD.w, h: CARD.h },
  };
}

function pageCard(p: LineagePage): BoardWindowSpec {
  const content = {
    key: p.key,
    subtitle: p.route,
    icon: "\u{1F4D0}",
    section: "pages",
    facts: [
      `${p.components.length} bound block${p.components.length === 1 ? "" : "s"}`,
      ...(p.tables.length ? [`tables: ${p.tables.join(", ")}`] : []),
    ],
    target: { type: "page", name: p.name },
    lineage: "page",
    focusPage: p.name,
  } satisfies CardContent & Record<string, unknown>;
  return {
    id: p.key,
    kind: "card",
    title: p.title,
    content,
    size: { w: CARD.w, h: CARD.h },
  };
}

function columnsFor(n: number): number {
  return n <= 6 ? 1 : n <= 14 ? 2 : 3;
}

/**
 * The lineage graph as a board: Tables → Components → Pages, one card per
 * node, one labeled arrow per edge, plus a controls window at the left.
 */
export function lineageBoard(graph: LineageGraph): BoardDef {
  return {
    name: LINEAGE_BOARD,
    title: "Data lineage",
    description:
      "Where every component on every page gets its data: tables, the components that bind them, the pages that render them.",
    gap: 220,
    sections: [
      {
        id: "controls",
        title: "Data lineage",
        grid: "single" as const,
        windows: [
          {
            id: "lineage-controls",
            kind: "lineage",
            title: "Data lineage",
            content: { page: null },
            size: { w: 300, h: 260 },
          },
        ],
      },
      {
        id: "tables",
        title: "Tables (data/schema.json)",
        grid: "grid" as const,
        columns: columnsFor(graph.tables.length),
        windows: graph.tables.map(tableCard),
      },
      {
        id: "components",
        title: "Components that bind data",
        grid: "grid" as const,
        columns: columnsFor(graph.components.length),
        windows: graph.components.map(componentCard),
      },
      {
        id: "pages",
        title: "Pages",
        grid: "grid" as const,
        columns: columnsFor(graph.pages.length),
        windows: graph.pages.map(pageCard),
      },
    ].filter((s) => s.windows.length > 0),
    arrows: graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      label: e.kind === "component-page" ? "" : e.label,
      color:
        e.kind === "component-page"
          ? "violet"
          : e.mode === "write"
            ? "red"
            : "orange",
    })),
    steps: [
      {
        section: "tables",
        title: "Tables",
        caption: "Every table of data/schema.json with its columns.",
      },
      {
        section: "components",
        title: "Components",
        caption:
          "Each component that binds a table; the arrow says which fields (and filter) it reads or writes.",
      },
      {
        section: "pages",
        title: "Pages",
        caption:
          "The pages those components render on. Focus a page to see exactly what feeds it.",
      },
    ],
  };
}

/**
 * One page's lineage as a board: the tables and components feeding it on the
 * left, the real Page Builder and Preview windows for the page on the right.
 */
export function lineagePageBoard(
  graph: LineageGraph,
  pageName: string
): BoardDef {
  const sub = lineageForPage(graph, pageName);
  const page = sub.pages[0];
  if (!page) throw new Error(`No page "${pageName}"`);
  const builderId = `builder:${page.name}`;
  const previewId = `preview:${page.name}`;
  return {
    name: `${LINEAGE_BOARD}-${page.name.replace(/[^A-Za-z0-9_-]+/g, "-")}`,
    title: `Data lineage for ${page.title}`,
    gap: 220,
    sections: [
      {
        id: "tables",
        title: `Tables feeding ${page.title}`,
        grid: "grid" as const,
        columns: columnsFor(sub.tables.length),
        windows: sub.tables.map(tableCard),
      },
      {
        id: "components",
        title: "Components on the page",
        grid: "grid" as const,
        columns: columnsFor(sub.components.length),
        windows: sub.components.map(componentCard),
      },
      {
        id: "page",
        title: `${page.title} (${page.route})`,
        grid: "stack" as const,
        windows: [
          {
            id: builderId,
            kind: "pages",
            title: `Page: ${page.name}`,
            content: { page: page.name, device: "desktop", sources: true },
            size: { w: 1120, h: 640 },
          },
          {
            id: previewId,
            kind: "preview",
            title: `Preview: ${page.title}`,
            content: `pages/${page.name}.json?sources=1`,
            size: { w: 1120, h: 560 },
          },
        ],
      },
    ].filter((s) => s.windows.length > 0),
    arrows: sub.edges.map((e) => ({
      from: e.from,
      to: e.to === page.key ? builderId : e.to,
      label: e.kind === "component-page" ? e.label : e.label,
      color:
        e.kind === "component-page"
          ? "violet"
          : e.mode === "write"
            ? "red"
            : "orange",
    })),
    steps: [
      {
        section: "tables",
        title: "Tables",
        caption: `What ${page.title} reads.`,
      },
      {
        section: "components",
        title: "Components",
        caption: "The blocks that bind those tables.",
      },
      {
        section: "page",
        title: page.title,
        caption: "The page itself, with the Data sources overlay on.",
      },
    ],
  };
}
