/**
 * Pages: `pages/<name>.json` composed from design components.
 *
 *   {
 *     "name": "home", "title": "Home", "route": "/", "device": "desktop",
 *     "layout": { "columns": 12, "gap": "4", "maxWidth": "1200px" },
 *     "components": [
 *       { "id": "hero", "name": "Hero", "span": 12, "props": { "title": "..." },
 *         "bindings": [{ "table": "products", "fields": ["name"] }],
 *         "children": [ ...blocks... ] }
 *     ],
 *     "links": [{ "to": "products", "label": "Browse", "from": "hero" }],
 *     "bindings": [{ "table": "roles", "fields": ["name"] }]
 *   }
 *
 * M4's page files (`components: ["side-menu"]`, `file: "index.html"`) still
 * parse: a page with a `file` and no blocks is rendered by that HTML file.
 * The preview renders a composed page when its entry is `pages/<name>.json`.
 */
import type { DesignCore } from "./render";

export const PAGES_DIR = "pages/";

export const DEVICES = {
  mobile: { label: "Mobile", width: 390, height: 844 },
  tablet: { label: "Tablet", width: 820, height: 1180 },
  desktop: { label: "Desktop", width: 1280, height: 800 },
} as const;

export type Device = keyof typeof DEVICES;

export interface PageBinding {
  table: string;
  fields?: string[];
  mode?: "read" | "write";
  filter?: string;
  order?: string;
}

export interface PageBlock {
  id: string;
  /** Component name (design/components/<name>.json). */
  name: string;
  /** Grid columns the block spans (1..layout.columns, default all). */
  span: number;
  variant?: string;
  props: Record<string, unknown>;
  bindings?: PageBinding[];
  children?: PageBlock[];
}

export interface PageLink {
  to: string;
  label?: string;
  /** Block id the link starts from (optional). */
  from?: string;
}

export interface PageDef {
  name: string;
  title: string;
  route: string;
  device?: Device;
  layout: { columns: number; gap: string; maxWidth?: string };
  components: PageBlock[];
  links: PageLink[];
  bindings: PageBinding[];
  /** M4: an HTML file renders this page instead of blocks. */
  file?: string;
  description?: string;
  /** Force a color scheme for this page (default: follow the system). */
  theme?: "light" | "dark";
  /** Background texture: the dot grid, or none. */
  texture?: "dots" | "none";
  /** Extra room at the bottom (a fixed TabBar). */
  padBottom?: boolean;
}

export function pagePath(name: string): string {
  return `${PAGES_DIR}${name}.json`;
}

/** `pages/home.json` -> `home`, `pages/apps/customer/home.json` -> `apps/customer/home`; null otherwise. */
export function pageFromPath(path: string): string | null {
  const m =
    /^pages\/((?:[A-Za-z0-9][A-Za-z0-9_-]*\/)*[A-Za-z0-9][A-Za-z0-9_-]*)\.json$/.exec(
      path
    );
  return m ? m[1] : null;
}

export function isPagePath(path: string): boolean {
  return pageFromPath(path) !== null;
}

let counter = 0;

export function newBlockId(name: string): string {
  counter += 1;
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36).slice(-4)}${counter}`;
}

function parseBindings(raw: unknown): PageBinding[] {
  if (!Array.isArray(raw)) return [];
  const out: PageBinding[] = [];
  for (const b of raw) {
    if (typeof b !== "object" || b === null) continue;
    const q = b as Record<string, unknown>;
    if (typeof q.table !== "string" || !q.table) continue;
    const binding: PageBinding = { table: q.table };
    if (Array.isArray(q.fields))
      binding.fields = q.fields.filter(
        (f): f is string => typeof f === "string"
      );
    if (q.mode === "write") binding.mode = "write";
    if (typeof q.filter === "string") binding.filter = q.filter;
    if (typeof q.order === "string") binding.order = q.order;
    out.push(binding);
  }
  return out;
}

function parseBlock(
  raw: unknown,
  index: number,
  columns: number,
  errors: string[],
  where: string
): PageBlock | null {
  if (typeof raw === "string") {
    // M4 shorthand: a component name.
    return { id: `${raw}-${index}`, name: raw, span: columns, props: {} };
  }
  if (typeof raw !== "object" || raw === null) {
    errors.push(`${where}[${index}]: must be an object or a component name`);
    return null;
  }
  const q = raw as Record<string, unknown>;
  const name =
    typeof q.name === "string"
      ? q.name
      : typeof q.component === "string"
        ? q.component
        : "";
  if (!name) {
    errors.push(`${where}[${index}]: missing component "name"`);
    return null;
  }
  const id = typeof q.id === "string" && q.id ? q.id : `${name}-${index}`;
  let span = typeof q.span === "number" ? Math.round(q.span) : columns;
  if (span < 1 || span > columns) {
    errors.push(
      `${where}[${index}] (${id}): span ${span} is not between 1 and ${columns}`
    );
    span = Math.min(columns, Math.max(1, span));
  }
  const block: PageBlock = {
    id,
    name,
    span,
    props:
      typeof q.props === "object" && q.props !== null && !Array.isArray(q.props)
        ? { ...(q.props as Record<string, unknown>) }
        : {},
  };
  if (typeof q.variant === "string" && q.variant) block.variant = q.variant;
  const bindings = parseBindings(q.bindings);
  if (bindings.length) block.bindings = bindings;
  if (Array.isArray(q.children)) {
    block.children = q.children
      .map((c, i) =>
        parseBlock(c, i, columns, errors, `${where}[${index}].children`)
      )
      .filter((c): c is PageBlock => c !== null);
  }
  return block;
}

/** Parses a page file. Tolerant; problems are reported and the rest loads. */
export function parsePage(
  text: string,
  path?: string
): { page: PageDef | null; errors: string[] } {
  const errors: string[] = [];
  const where = path ?? "page";
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      page: null,
      errors: [
        `${where}: not valid JSON (${e instanceof Error ? e.message : String(e)})`,
      ],
    };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { page: null, errors: [`${where}: must be an object`] };
  const r = raw as Record<string, unknown>;
  const fromPath = path ? pageFromPath(path) : null;
  const name = typeof r.name === "string" && r.name ? r.name : fromPath;
  if (!name) return { page: null, errors: [`${where}: missing "name"`] };
  const title = typeof r.title === "string" && r.title ? r.title : name;
  const route =
    typeof r.route === "string" && r.route
      ? r.route
      : typeof r.path === "string" && r.path
        ? r.path
        : name === "home" || name === "index"
          ? "/"
          : `/${name}`;
  const rawLayout =
    typeof r.layout === "object" && r.layout !== null
      ? (r.layout as Record<string, unknown>)
      : {};
  const columns =
    typeof rawLayout.columns === "number" &&
    rawLayout.columns >= 1 &&
    rawLayout.columns <= 24
      ? Math.round(rawLayout.columns)
      : 12;
  const layout: PageDef["layout"] = {
    columns,
    gap:
      typeof rawLayout.gap === "string" || typeof rawLayout.gap === "number"
        ? String(rawLayout.gap)
        : "4",
  };
  if (typeof rawLayout.maxWidth === "string")
    layout.maxWidth = rawLayout.maxWidth;
  const components = Array.isArray(r.components)
    ? r.components
        .map((c, i) => parseBlock(c, i, columns, errors, `${where}.components`))
        .filter((c): c is PageBlock => c !== null)
    : [];
  const ids = new Set<string>();
  const checkIds = (blocks: PageBlock[]) => {
    for (const b of blocks) {
      if (ids.has(b.id)) errors.push(`${where}: duplicate block id "${b.id}"`);
      ids.add(b.id);
      if (b.children) checkIds(b.children);
    }
  };
  checkIds(components);
  const links: PageLink[] = [];
  if (Array.isArray(r.links)) {
    for (const l of r.links) {
      if (typeof l === "string") links.push({ to: l });
      else if (
        typeof l === "object" &&
        l !== null &&
        typeof (l as PageLink).to === "string"
      ) {
        const q = l as Record<string, unknown>;
        const link: PageLink = { to: q.to as string };
        if (typeof q.label === "string") link.label = q.label;
        if (typeof q.from === "string") link.from = q.from;
        links.push(link);
      }
    }
  }
  const page: PageDef = {
    name,
    title,
    route,
    layout,
    components,
    links,
    bindings: parseBindings(r.bindings),
  };
  if (typeof r.device === "string" && r.device in DEVICES)
    page.device = r.device as Device;
  if (typeof r.file === "string" && r.file) page.file = r.file;
  if (typeof r.description === "string") page.description = r.description;
  if (r.theme === "light" || r.theme === "dark") page.theme = r.theme;
  if (r.texture === "dots" || r.texture === "none") page.texture = r.texture;
  if (r.padBottom === true) page.padBottom = true;
  return { page, errors };
}

export function serializePage(page: PageDef): string {
  const out: Record<string, unknown> = {
    name: page.name,
    title: page.title,
    route: page.route,
  };
  if (page.description) out.description = page.description;
  if (page.device) out.device = page.device;
  if (page.theme) out.theme = page.theme;
  if (page.texture) out.texture = page.texture;
  if (page.padBottom) out.padBottom = true;
  if (page.file) out.file = page.file;
  out.layout = page.layout;
  out.components = page.components.map(serializeBlock);
  if (page.links.length) out.links = page.links;
  if (page.bindings.length) out.bindings = page.bindings;
  return JSON.stringify(out, null, 2) + "\n";
}

function serializeBlock(b: PageBlock): Record<string, unknown> {
  const out: Record<string, unknown> = { id: b.id, name: b.name, span: b.span };
  if (b.variant) out.variant = b.variant;
  if (Object.keys(b.props).length) out.props = b.props;
  if (b.bindings?.length) out.bindings = b.bindings;
  if (b.children?.length) out.children = b.children.map(serializeBlock);
  return out;
}

/** True when the page is drawn from blocks (not by an HTML file). */
export function isComposedPage(page: PageDef): boolean {
  return page.components.length > 0 || !page.file;
}

/** Every block of a page, depth first. */
export function flattenBlocks(blocks: PageBlock[]): PageBlock[] {
  const out: PageBlock[] = [];
  const walk = (list: PageBlock[]) => {
    for (const b of list) {
      out.push(b);
      if (b.children) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

/** Problems a page has against the component library and the other pages. */
export function validatePage(
  page: PageDef,
  components: { name: string }[] | null,
  pages: { name: string; route: string }[] | null = null
): string[] {
  const errors: string[] = [];
  if (!/^\//.test(page.route))
    errors.push(`route "${page.route}" must start with /`);
  if (components) {
    const names = new Set(components.map((c) => c.name));
    for (const b of flattenBlocks(page.components))
      if (!names.has(b.name))
        errors.push(`block "${b.id}": unknown component "${b.name}"`);
  }
  for (const b of flattenBlocks(page.components))
    if (b.span < 1 || b.span > page.layout.columns)
      errors.push(`block "${b.id}": span ${b.span} out of range`);
  if (pages) {
    const known = new Set(pages.flatMap((p) => [p.name, p.route]));
    for (const l of page.links)
      if (!known.has(l.to)) errors.push(`link to unknown page "${l.to}"`);
    const ids = new Set(flattenBlocks(page.components).map((b) => b.id));
    for (const l of page.links)
      if (l.from && !ids.has(l.from))
        errors.push(`link from unknown block "${l.from}"`);
  }
  return errors;
}

/** The props a block renders with: its bindings feed `table` / `fields` when not set. */
export function blockProps(block: PageBlock): Record<string, unknown> {
  const props = { ...block.props };
  const b = block.bindings?.[0];
  if (b) {
    if (props.table === undefined || props.table === "") props.table = b.table;
    if (
      (props.fields === undefined ||
        (Array.isArray(props.fields) && props.fields.length === 0)) &&
      b.fields?.length
    )
      props.fields = b.fields;
    if (props.filter === undefined && b.filter) props.filter = b.filter;
    if (props.order === undefined && b.order) props.order = b.order;
  }
  return props;
}

export interface RenderPageOptions {
  /** CSS put in the head (tokens + base styles). */
  css?: string;
  /** Extra head HTML (scripts the bundler injects). */
  head?: string;
  /** Mark blocks with `data-block="<id>"` (the Page Builder highlights them). */
  markBlocks?: boolean;
  /** Force the color scheme (`<html data-theme>`); the page's own `theme` wins. */
  theme?: "light" | "dark";
}

export function renderBlocks(
  blocks: PageBlock[],
  core: DesignCore,
  columns: number,
  mark: boolean
): string {
  return blocks
    .map((b) => {
      const children = b.children?.length
        ? renderBlocks(b.children, core, columns, mark)
        : undefined;
      const html = core.render(b.name, blockProps(b), children, b.variant);
      const span = Math.min(columns, Math.max(1, b.span));
      return `<div class="ds-col" style="grid-column: span ${span}"${mark ? ` data-block="${core.escape(b.id)}" data-block-name="${core.escape(b.name)}"` : ""}>${html}</div>`;
    })
    .join("\n");
}

/** A full HTML document for a composed page. */
export function renderPage(
  page: PageDef,
  core: DesignCore,
  options: RenderPageOptions = {}
): string {
  const { columns, gap, maxWidth } = page.layout;
  const body = renderBlocks(
    page.components,
    core,
    columns,
    options.markBlocks === true
  );
  const gapValue = /^\d+$/.test(gap)
    ? `var(--ds-space-${gap}, ${Number(gap) * 4}px)`
    : gap;
  const style = [
    `--ds-page-columns: ${columns}`,
    `--ds-page-gap: ${gapValue}`,
    maxWidth ? `--ds-page-max-width: ${maxWidth}` : null,
  ]
    .filter(Boolean)
    .join("; ");
  const theme = page.theme ?? options.theme;
  const bodyClass = [
    "ds-page",
    page.texture === "dots" ? "ds-page--dots" : null,
    page.padBottom ? "ds-page--tabbar" : null,
  ]
    .filter(Boolean)
    .join(" ");
  return `<!doctype html>
<html lang="en"${theme ? ` data-theme="${theme}"` : ""}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${core.escape(page.title)}</title>
${options.head ?? ""}
    <style data-paperos="page">${options.css ?? ""}</style>
  </head>
  <body class="${bodyClass}" data-page="${core.escape(page.name)}" data-route="${core.escape(page.route)}" style="${style}">
    <div class="ds-grid">
${body}
    </div>
  </body>
</html>
`;
}
