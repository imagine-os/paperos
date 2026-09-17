/**
 * The project map as data: sections, nodes and edges built from what the
 * project really contains (tables, files, components, pages, tokens and
 * their bindings). Pure; `layout.ts` places it and `generate.ts` draws it.
 */
import type { BindingIndex } from "@/data/bindings";
import type { DataSchema } from "@/data/schema";
import type { ComponentDef } from "@/design/components";
import type { PageDef } from "@/design/pages";
import type { DesignTokens } from "@/design/tokens";

/** What a map node (a Card window) points at. */
export type CardTarget =
  | { type: "table"; table: string }
  | { type: "file"; path: string }
  | { type: "component"; name: string }
  | { type: "page"; name: string }
  | { type: "tokens" }
  | { type: "none" };

/** What a Card window keeps in `content`. */
export interface CardContent {
  /** Stable key (`table:users`, `file:app.js`, ...) so map regeneration keeps positions. */
  key?: string;
  subtitle?: string;
  icon?: string;
  /** Section the card belongs to (for styling). */
  section?: string;
  /** Small facts shown under the subtitle. */
  facts?: string[];
  target?: CardTarget;
}

export const MAP_SECTIONS = [
  { id: "data", title: "Data", icon: "\u{1F5C3}" },
  { id: "code", title: "Code", icon: "\u{1F4C1}" },
  { id: "design", title: "Design", icon: "\u{1F3A8}" },
  { id: "components", title: "Components", icon: "\u{1F9E9}" },
  { id: "pages", title: "Pages", icon: "\u{1F4D0}" },
  // Page-to-page links read left to right, so the flow cards sit in a row.
  { id: "flows", title: "UX flows", icon: "\u{27A1}", horizontal: true },
  { id: "growth", title: "Growth", icon: "\u{1F4C8}" },
  { id: "ops", title: "Ops", icon: "\u{2699}" },
] as const;

export type MapSectionId = (typeof MAP_SECTIONS)[number]["id"];

export interface MapNode {
  /** Stable id (`table:users`, `file:app.js`, ...): regeneration keeps a node's position by it. */
  key: string;
  section: MapSectionId;
  title: string;
  subtitle?: string;
  icon?: string;
  facts?: string[];
  target: CardTarget;
  /** Card size hint (page units). */
  size?: { w: number; h: number };
}

export interface MapEdge {
  from: string;
  to: string;
  label?: string;
  kind: "binding" | "usage" | "link" | "tokens";
}

export interface MapSection {
  id: MapSectionId;
  title: string;
  icon: string;
  /** Cards in one row instead of a column grid. */
  horizontal?: boolean;
}

export interface MapGraph {
  sections: MapSection[];
  nodes: MapNode[];
  edges: MapEdge[];
}

export interface MapInput {
  files: string[];
  schema: DataSchema;
  rowCounts: Record<string, number>;
  bindings: Pick<BindingIndex, "bindings" | "sources">;
  components: ComponentDef[];
  pages: PageDef[];
  tokens: DesignTokens | null;
}

/** Above this many code files a folder becomes one node instead of one per file. */
export const FOLDER_COLLAPSE_AT = 30;

const CODE_RE =
  /\.(html?|css|m?js|cjs|jsx|tsx?|json|md|svg|txt|py|rb|go|rs|java|vue|svelte)$/i;
const SKIP_RE = /^(data|design|pages|components)\//;

export const nodeKey = {
  table: (name: string) => `table:${name}`,
  file: (path: string) => `file:${path}`,
  folder: (path: string) => `folder:${path}`,
  component: (name: string) => `component:${name}`,
  page: (name: string) => `page:${name}`,
  flow: (name: string) => `flow:${name}`,
  tokens: () => "design:tokens",
};

const baseName = (p: string) => p.replace(/^.*\//, "");
const dirName = (p: string) =>
  p.includes("/") ? p.replace(/\/[^/]*$/, "") : "";

function fileIcon(path: string): string {
  const ext = path.replace(/^.*\./, "").toLowerCase();
  if (/^html?$/.test(ext)) return "\u{1F310}";
  if (ext === "css") return "\u{1F3AD}";
  if (/^(m?js|cjs|jsx|tsx?)$/.test(ext)) return "\u{26A1}";
  if (ext === "md") return "\u{1F4C4}";
  if (ext === "json") return "\u{2699}";
  return "\u{1F4C1}";
}

export function buildProjectMap(input: MapInput): MapGraph {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const has = new Set<string>();
  const add = (n: MapNode) => {
    if (has.has(n.key)) return;
    has.add(n.key);
    nodes.push(n);
  };
  const edgeKeys = new Map<string, MapEdge>();
  const link = (e: MapEdge) => {
    if (!has.has(e.from) || !has.has(e.to) || e.from === e.to) return;
    const k = `${e.from}>${e.to}`;
    const existing = edgeKeys.get(k);
    if (existing) {
      // One arrow per pair; a labeled duplicate (a write next to a read) lends its label.
      if (e.label && !existing.label) existing.label = e.label;
      return;
    }
    edgeKeys.set(k, e);
    edges.push(e);
  };

  // ----- Data: one node per table.
  for (const t of input.schema.tables) {
    const refs = t.columns.filter((c) => c.type === "ref" && c.ref);
    add({
      key: nodeKey.table(t.name),
      section: "data",
      title: t.name,
      icon: "\u{1F5C3}",
      subtitle: `${input.rowCounts[t.name] ?? 0} rows · ${t.columns.length} columns`,
      facts: refs.map((c) => `${c.name} → ${c.ref}`),
      target: { type: "table", table: t.name },
    });
  }

  // ----- Code: files by folder (collapsed to folders in big projects), plus growth/ops.
  const codeFiles = input.files
    .filter((p) => CODE_RE.test(p) && !SKIP_RE.test(p))
    .sort((a, b) => dirName(a).localeCompare(dirName(b)) || a.localeCompare(b));
  const special = (p: string): MapSectionId | null =>
    /^growth\//.test(p) ? "growth" : /^ops\//.test(p) ? "ops" : null;
  const plain = codeFiles.filter((p) => !special(p));
  const collapse = plain.length > FOLDER_COLLAPSE_AT;
  const fileNode = (path: string, section: MapSectionId) =>
    add({
      key: nodeKey.file(path),
      section,
      title: baseName(path),
      icon: fileIcon(path),
      subtitle: dirName(path) ? `${dirName(path)}/` : "project root",
      target: { type: "file", path },
    });
  if (collapse) {
    const byDir = new Map<string, string[]>();
    for (const p of plain)
      (
        byDir.get(dirName(p)) ?? byDir.set(dirName(p), []).get(dirName(p))!
      ).push(p);
    for (const [dir, list] of byDir) {
      if (dir === "") for (const p of list) fileNode(p, "code");
      else
        add({
          key: nodeKey.folder(dir),
          section: "code",
          title: `${dir}/`,
          icon: "\u{1F4C1}",
          subtitle: `${list.length} files`,
          facts: list.slice(0, 5).map(baseName),
          target: { type: "file", path: list[0] },
        });
    }
  } else for (const p of plain) fileNode(p, "code");
  for (const p of codeFiles.filter(special)) fileNode(p, special(p)!);

  // ----- Design: tokens.
  if (input.tokens) {
    const t = input.tokens;
    add({
      key: nodeKey.tokens(),
      section: "design",
      title: "Tokens",
      icon: "\u{1F3A8}",
      subtitle: `${Object.keys(t.color).length} colors · ${Object.keys(t.typography.fontSize).length} sizes · ${Object.keys(t.spacing).length} spaces`,
      facts: ["bg", "primary", "accent"]
        .filter((c) => t.color[c])
        .map((c) => `${c} ${t.color[c].light}`),
      target: { type: "tokens" },
    });
  }

  // ----- Components: the design library, plus M4 component declarations.
  for (const c of input.components) {
    add({
      key: nodeKey.component(c.name),
      section: "components",
      title: c.name,
      icon: c.icon ?? "\u{1F9E9}",
      subtitle: c.description ?? c.category,
      facts: [
        `${c.props.length} props`,
        ...(c.variants.length ? [`${c.variants.length} variants`] : []),
        ...(c.slots.length ? [`slots: ${c.slots.join(", ")}`] : []),
      ],
      target: { type: "component", name: c.name },
    });
  }
  for (const s of input.bindings.sources) {
    if (s.kind !== "component" || has.has(nodeKey.component(s.name))) continue;
    add({
      key: nodeKey.component(s.name),
      section: "components",
      title: s.name,
      icon: "\u{1F9E9}",
      subtitle: s.path,
      facts: s.tables.map((t) => `reads ${t}`),
      target: { type: "file", path: s.path },
    });
  }

  // ----- Pages and UX flows.
  for (const p of input.pages) {
    const blocks = countBlocks(p);
    add({
      key: nodeKey.page(p.name),
      section: "pages",
      title: p.title,
      icon: "\u{1F4D0}",
      subtitle:
        p.file && !p.components.length ? `${p.route} · ${p.file}` : p.route,
      facts: [
        `${blocks} block${blocks === 1 ? "" : "s"}`,
        ...(p.links.length
          ? [`${p.links.length} link${p.links.length === 1 ? "" : "s"}`]
          : []),
        ...(p.device ? [p.device] : []),
      ],
      target: { type: "page", name: p.name },
    });
  }
  if (input.pages.some((p) => p.links.length))
    for (const p of input.pages)
      add({
        key: nodeKey.flow(p.name),
        section: "flows",
        title: p.title,
        icon: "\u{27A1}",
        subtitle: p.route,
        target: { type: "page", name: p.name },
        size: { w: 200, h: 88 },
      });

  // ----- Edges.
  for (const b of input.bindings.bindings) {
    const from = nodeKey.table(b.table);
    let to: string | null = null;
    if (b.kind === "component") to = nodeKey.component(b.source);
    else if (b.kind === "page") to = nodeKey.page(pageNameOf(b.path, b.source));
    else {
      to = nodeKey.file(b.path);
      if (!has.has(to)) to = nodeKey.folder(dirName(b.path));
    }
    if (to)
      link({
        from,
        to,
        kind: "binding",
        ...(b.mode === "write" ? { label: "write" } : {}),
      });
  }
  for (const p of input.pages) {
    for (const name of blockNames(p))
      link({
        from: nodeKey.component(name),
        to: nodeKey.page(p.name),
        kind: "usage",
      });
    for (const l of p.links) {
      const target = input.pages.find(
        (q) => q.name === l.to || q.route === l.to
      );
      if (target)
        link({
          from: nodeKey.flow(p.name),
          to: nodeKey.flow(target.name),
          kind: "link",
          ...(l.label ? { label: l.label } : {}),
        });
    }
  }
  if (input.tokens)
    for (const c of input.components)
      link({
        from: nodeKey.tokens(),
        to: nodeKey.component(c.name),
        kind: "tokens",
      });

  const used = new Set(nodes.map((n) => n.section));
  return {
    sections: MAP_SECTIONS.filter((s) => used.has(s.id)).map((s) => ({
      id: s.id,
      title: s.title,
      icon: s.icon,
      ...("horizontal" in s && s.horizontal ? { horizontal: true } : {}),
    })),
    nodes,
    edges,
  };
}

function pageNameOf(path: string, source: string): string {
  const m = /^pages\/(.+)\.json$/.exec(path);
  return m ? m[1] : source;
}

function countBlocks(p: PageDef): number {
  let n = 0;
  const walk = (list: PageDef["components"]) => {
    for (const b of list) {
      n++;
      if (b.children) walk(b.children);
    }
  };
  walk(p.components);
  return n;
}

function blockNames(p: PageDef): string[] {
  const out = new Set<string>();
  const walk = (list: PageDef["components"]) => {
    for (const b of list) {
      out.add(b.name);
      if (b.children) walk(b.children);
    }
  };
  walk(p.components);
  return [...out];
}
