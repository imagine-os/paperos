/**
 * How components, pages and files connect to tables.
 *
 * Three conventions are indexed:
 *  1. HTML: `data-source="table"` on a list element, `data-field="col"` on
 *     the parts of its first child (the row template); optional
 *     `data-filter`, `data-order`, `data-group` (see runtime.ts).
 *  2. `components/*.json`, `design/components/*.json` and `pages/*.json`:
 *     `{"name": ..., "bindings": [{"table", "fields", "mode": "read" | "write"}]}`;
 *     pages also list `"components"`: names (M4) or blocks
 *     `{"name", "props", "bindings", "children"}` (M5) whose bindings count
 *     as the page's.
 *  3. JavaScript: `paperos.data.<table>.list()` and friends in the preview.
 *
 * The scanner is pure text processing (regular expressions + JSON.parse),
 * so it runs the same in the browser and in tests.
 */
import { getColumn, getTable, type DataSchema } from "./schema";

export type BindingMode = "read" | "write";
export type SourceKind = "html" | "component" | "page" | "js";

export interface Binding {
  table: string;
  fields: string[];
  mode: BindingMode;
  kind: SourceKind;
  /** Project-relative file. */
  path: string;
  /** 1-based line of the declaration. */
  line: number;
  /** Component or page name (from the JSON `name` or the file name), else the path. */
  source: string;
  filter?: string;
  order?: string;
  group?: string;
}

export interface SourceInfo {
  path: string;
  kind: SourceKind;
  name: string;
  /** Tables the source binds directly. */
  tables: string[];
  /** Components a page uses (pages only). */
  components: string[];
  /** Tables reached through those components. */
  indirect: { table: string; via: string }[];
}

export interface BindingProblem {
  binding: Binding;
  message: string;
}

export interface BindingIndex {
  bindings: Binding[];
  sources: SourceInfo[];
  /** Tables of the schema, in schema order. */
  tables: string[];
  byTable: Record<string, Binding[]>;
  bySource: Record<string, Binding[]>;
  unusedTables: string[];
  broken: BindingProblem[];
}

const lineOf = (text: string, index: number): number => {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++)
    if (text.charCodeAt(i) === 10) n++;
  return n;
};

const baseName = (path: string) =>
  path.replace(/^.*\//, "").replace(/\.[^.]+$/, "");

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(
    tag
  )?.[1] ?? new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i").exec(tag)?.[1];

/** `data-source` lists in HTML; the fields are the `data-field`s up to the next list. */
export function scanHtml(path: string, text: string): Binding[] {
  const out: Binding[] = [];
  const re = /<[^<>]*\bdata-source\s*=\s*(?:"([^"]*)"|'([^']*)')[^<>]*>/gi;
  const matches = [...text.matchAll(re)];
  matches.forEach((m, i) => {
    const table = (m[1] ?? m[2] ?? "").trim();
    if (!table) return;
    const tag = m[0];
    const start = m.index! + tag.length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const span = text.slice(start, end);
    const fields = [
      ...new Set(
        [...span.matchAll(/\bdata-field\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
          .map((f) => (f[1] ?? f[2] ?? "").trim())
          .filter((f) => f && !f.startsWith("$"))
      ),
    ];
    const b: Binding = {
      table,
      fields,
      mode: "read",
      kind: "html",
      path,
      line: lineOf(text, m.index!),
      source: path,
    };
    const filter = attr(tag, "data-filter");
    const order = attr(tag, "data-order");
    const group = attr(tag, "data-group");
    if (filter) b.filter = filter;
    if (order) b.order = order;
    if (group) b.group = group;
    out.push(b);
  });
  return out;
}

const RESERVED = new Set([
  "tables",
  "table",
  "schema",
  "hydrate",
  "icons",
  "context",
  "setContext",
  "options",
  "autoHydrate",
  "refresh",
  "on",
]);
const WRITE_METHODS = new Set([
  "insert",
  "update",
  "remove",
  "delete",
  "save",
  "set",
]);
const READ_METHODS = new Set([
  "list",
  "get",
  "find",
  "first",
  "count",
  "all",
  "display",
  "children",
]);

/** `paperos.data.<table>.<method>(` and `paperos.data.table("<table>")` calls. */
export function scanJs(path: string, text: string): Binding[] {
  const out: Binding[] = [];
  const seen = new Set<string>();
  const push = (
    table: string,
    mode: BindingMode,
    index: number,
    fields: string[] = []
  ) => {
    const key = `${table}:${mode}:${lineOf(text, index)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      table,
      fields,
      mode,
      kind: "js",
      path,
      line: lineOf(text, index),
      source: path,
    });
  };
  for (const m of text.matchAll(
    /paperos\.data\.([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_]+)\s*\(/g
  )) {
    const [, table, method] = m;
    if (RESERVED.has(table)) continue;
    if (WRITE_METHODS.has(method))
      push(
        table,
        "write",
        m.index!,
        fieldsOfCall(text, m.index! + m[0].length)
      );
    else if (READ_METHODS.has(method))
      push(table, "read", m.index!, fieldsOfCall(text, m.index! + m[0].length));
  }
  for (const m of text.matchAll(
    /paperos\.data\.table\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/g
  ))
    push(m[1], "read", m.index!);
  return out;
}

/** Keys of an object literal argument (`{ where: { col: ... } }` -> col; `orderBy: "col"` -> col). */
function fieldsOfCall(text: string, from: number): string[] {
  let depth = 1;
  let i = from;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    i++;
    if (i - from > 600) break;
  }
  const arg = text.slice(from, i - 1);
  const fields = new Set<string>();
  const where = /where\s*:\s*\{([^}]*)\}/.exec(arg);
  if (where)
    for (const k of where[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g))
      fields.add(k[1]);
  const order = /(?:orderBy|sort)\s*:\s*["']-?([A-Za-z_][A-Za-z0-9_]*)/.exec(
    arg
  );
  if (order) fields.add(order[1]);
  return [...fields];
}

interface JsonDecl {
  name?: unknown;
  bindings?: unknown;
  components?: unknown;
}

/** `components/*.json` and `pages/*.json` declarations. */
export function scanJson(
  path: string,
  text: string
): { bindings: Binding[]; components: string[]; name: string } {
  const kind: SourceKind = /^pages\//.test(path) ? "page" : "component";
  const name = baseName(path);
  let decl: JsonDecl;
  try {
    decl = JSON.parse(text) as JsonDecl;
  } catch {
    return { bindings: [], components: [], name };
  }
  if (typeof decl !== "object" || decl === null)
    return { bindings: [], components: [], name };
  const source = typeof decl.name === "string" && decl.name ? decl.name : name;
  const bindings: Binding[] = [];
  let cursor = 0;
  const addBindings = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (typeof raw !== "object" || raw === null) continue;
      const b = raw as Record<string, unknown>;
      // Templates in component definitions ("{table}") are not bindings.
      if (typeof b.table !== "string" || !b.table || b.table.includes("{"))
        continue;
      const at = text.indexOf(`"table"`, cursor);
      const idx = at === -1 ? 0 : at;
      cursor = at === -1 ? cursor : at + 7;
      const binding: Binding = {
        table: b.table,
        fields: Array.isArray(b.fields)
          ? b.fields.filter((f): f is string => typeof f === "string")
          : [],
        mode: b.mode === "write" ? "write" : "read",
        kind,
        path,
        line: lineOf(text, idx),
        source,
      };
      if (typeof b.filter === "string") binding.filter = b.filter;
      if (typeof b.order === "string") binding.order = b.order;
      bindings.push(binding);
    }
  };
  // Pages list components by name (M4) or as blocks {name, props, bindings, children} (M5).
  const components: string[] = [];
  const addBlocks = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const c of list) {
      if (typeof c === "string") {
        if (!components.includes(c)) components.push(c);
      } else if (typeof c === "object" && c !== null) {
        const block = c as Record<string, unknown>;
        if (typeof block.name === "string" && !components.includes(block.name))
          components.push(block.name);
        addBindings(block.bindings);
        addBlocks(block.children);
      }
    }
  };
  addBlocks(decl.components);
  addBindings(decl.bindings);
  return { bindings, components, name: source };
}

export function scanFile(
  path: string,
  text: string
): { bindings: Binding[]; components: string[]; name: string } {
  if (/\.(html?|vue|svelte)$/i.test(path))
    return { bindings: scanHtml(path, text), components: [], name: path };
  if (/\.(m?js|cjs|jsx|tsx?)$/i.test(path)) {
    // JS files may hold HTML templates with data-source too.
    const bindings = [...scanJs(path, text), ...scanHtml(path, text)];
    return { bindings, components: [], name: path };
  }
  if (/\.json$/i.test(path) && !/^data\//.test(path))
    return scanJson(path, text);
  return { bindings: [], components: [], name: path };
}

/** Indexes every binding of a project against its schema. */
export function scanBindings(
  files: { path: string; text: string }[],
  schema: DataSchema
): BindingIndex {
  const bindings: Binding[] = [];
  const sources: SourceInfo[] = [];
  const componentsByName = new Map<string, SourceInfo>();
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const r = scanFile(f.path, f.text);
    if (!r.bindings.length && !r.components.length) continue;
    bindings.push(...r.bindings);
    const kind: SourceKind =
      r.bindings[0]?.kind ?? (/^pages\//.test(f.path) ? "page" : "component");
    const info: SourceInfo = {
      path: f.path,
      kind,
      name: r.name,
      tables: [...new Set(r.bindings.map((b) => b.table))],
      components: r.components,
      indirect: [],
    };
    sources.push(info);
    if (kind === "component") componentsByName.set(info.name, info);
  }
  for (const s of sources) {
    for (const c of s.components) {
      const comp = componentsByName.get(c) ?? componentsByName.get(baseName(c));
      if (!comp) continue;
      for (const t of comp.tables)
        if (!s.tables.includes(t))
          s.indirect.push({ table: t, via: comp.name });
    }
  }
  const byTable: Record<string, Binding[]> = {};
  const bySource: Record<string, Binding[]> = {};
  for (const b of bindings) {
    (byTable[b.table] ??= []).push(b);
    (bySource[b.path] ??= []).push(b);
  }
  const tables = schema.tables.map((t) => t.name);
  const broken: BindingProblem[] = [];
  for (const b of bindings) {
    const table = getTable(schema, b.table);
    if (!table) {
      broken.push({ binding: b, message: `table "${b.table}" does not exist` });
      continue;
    }
    for (const f of b.fields)
      if (!getColumn(table, f))
        broken.push({
          binding: b,
          message: `column "${f}" is not in ${b.table}`,
        });
  }
  return {
    bindings,
    sources,
    tables,
    byTable,
    bySource,
    unusedTables: tables.filter((t) => !byTable[t]),
    broken,
  };
}
