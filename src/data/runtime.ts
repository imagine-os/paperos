/**
 * The `paperos.data` runtime the preview bundler injects into the page.
 *
 * `dataRuntime` is self-contained (no imports, no outer references): its
 * source is taken with `toString()` and executed inside the preview iframe
 * with the schema and the rows embedded, so the same code is unit tested
 * here and runs in the sandbox. It exposes:
 *
 *   paperos.data.<table>.list({ where, filter, orderBy, limit, offset })
 *   paperos.data.<table>.get(id) / find(where) / count() / all() / display(row)
 *   paperos.data.tables(), .schema, .table(name)
 *   paperos.data.hydrate(root?, { visible?(table, row) })   (runs at load)
 *   paperos.data.icons = { name: "<svg>..." }  used by data-as="icon"
 *   paperos.data.setContext({ key: value })     for `@key` in data-filter
 *
 * and fills `[data-source="table"]` elements: the first element child is
 * the row template, repeated per row; `[data-field="col"]` inside it gets
 * the value (text, or `src` on images, `href` on links, `data-attr` to
 * choose, `data-as="html|icon"`, `data-display` for the display value of a
 * ref). `data-filter`, `data-order` and `data-group="col"` shape the list;
 * `{col}` in a nested list's filter refers to the enclosing row and
 * `{$group}` to the current group. `data-empty` is shown when nothing matches.
 */

export interface RuntimePayload {
  schema: { tables: RuntimeTable[] };
  tables: Record<string, Record<string, unknown>[]>;
}

export interface RuntimeTable {
  name: string;
  primaryKey: string;
  display?: string;
  columns: { name: string; type: string; ref?: string }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function dataRuntime(win: any, payload: RuntimePayload): any {
  type Row = Record<string, unknown>;
  type Term = { column: string | null; op: string; value: string };

  const schema = payload.schema || { tables: [] };
  const tables: Record<string, Row[]> = payload.tables || {};
  const tableDef = (name: string) => schema.tables.find((t) => t.name === name);

  const asText = (v: unknown): string =>
    v === undefined || v === null
      ? ""
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);

  const tokenize = (s: string): string[] => {
    const out: string[] = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
    return out;
  };

  const parseFilter = (filter: string): Term[] => {
    const terms: Term[] = [];
    for (const tok of tokenize(filter.trim())) {
      const m = /^([A-Za-z_][A-Za-z0-9_.]*)(!=|>=|<=|=|>|<|:)(.*)$/.exec(tok);
      if (!m) {
        if (tok) terms.push({ column: null, op: "~", value: tok });
        continue;
      }
      terms.push({
        column: m[1],
        op: m[2],
        value: m[3].replace(/^"(.*)"$/, "$1"),
      });
    }
    return terms;
  };

  const looseEquals = (cell: unknown, value: string): boolean => {
    if (value === "null" || value === "")
      return cell === null || cell === undefined || cell === "";
    if (typeof cell === "number") return Number(value) === cell;
    if (typeof cell === "boolean") return value.toLowerCase() === String(cell);
    return asText(cell).toLowerCase() === value.toLowerCase();
  };

  const compareTo = (cell: unknown, value: string): number | null => {
    if (cell === undefined || cell === null) return null;
    const n = Number(value);
    if (typeof cell === "number" && value.trim() !== "" && isFinite(n))
      return cell - n;
    const a = asText(cell);
    return a < value ? -1 : a > value ? 1 : 0;
  };

  const matchesTerm = (row: Row, t: Term): boolean => {
    if (t.column === null) {
      const q = t.value.toLowerCase();
      return Object.keys(row).some(
        (k) => asText(row[k]).toLowerCase().indexOf(q) !== -1
      );
    }
    const cell = row[t.column];
    if (t.op === ":" || t.op === "~")
      return asText(cell).toLowerCase().indexOf(t.value.toLowerCase()) !== -1;
    if (t.op === "=") return looseEquals(cell, t.value);
    if (t.op === "!=") return !looseEquals(cell, t.value);
    const c = compareTo(cell, t.value);
    if (c === null) return false;
    if (t.op === ">") return c > 0;
    if (t.op === ">=") return c >= 0;
    if (t.op === "<") return c < 0;
    return c <= 0;
  };

  const compareValues = (a: unknown, b: unknown): number => {
    const an = a === null || a === undefined || a === "";
    const bn = b === null || b === undefined || b === "";
    if (an && bn) return 0;
    if (an) return 1;
    if (bn) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean")
      return Number(a) - Number(b);
    return asText(a).localeCompare(asText(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };

  const sortRows = (rows: Row[], sort: unknown): Row[] => {
    if (!sort) return rows;
    let column = "";
    let dir = 1;
    if (typeof sort === "string") {
      const s = sort.trim();
      if (s.charAt(0) === "-") {
        column = s.slice(1);
        dir = -1;
      } else {
        const m = /^(\S+)\s+(asc|desc)$/i.exec(s);
        column = m ? m[1] : s;
        dir = m && m[2].toLowerCase() === "desc" ? -1 : 1;
      }
    } else if (typeof sort === "object" && sort !== null) {
      column = String((sort as Row).column || "");
      dir = (sort as Row).dir === "desc" ? -1 : 1;
    }
    if (!column) return rows;
    return rows
      .slice()
      .sort((a, b) => dir * compareValues(a[column], b[column]));
  };

  const query = (rows: Row[], opts: Row | undefined): Row[] => {
    const o = opts || {};
    let list = rows;
    const where = o.where as Row | undefined;
    if (where) {
      for (const k of Object.keys(where))
        list = list.filter((r) => looseEquals(r[k], asText(where[k])));
    }
    if (typeof o.filter === "string" && o.filter.trim()) {
      const terms = parseFilter(o.filter);
      list = list.filter((r) => terms.every((t) => matchesTerm(r, t)));
    }
    list = sortRows(list, o.orderBy || o.sort);
    const offset = typeof o.offset === "number" ? o.offset : 0;
    if (offset || typeof o.limit === "number")
      list = list.slice(
        offset,
        typeof o.limit === "number" ? offset + o.limit : undefined
      );
    return list;
  };

  const displayColumn = (t: RuntimeTable): string => {
    const has = (n: string) => t.columns.some((c) => c.name === n);
    if (t.display && has(t.display)) return t.display;
    for (const g of ["name", "title", "label", "email"]) if (has(g)) return g;
    return t.primaryKey;
  };

  const displayOf = (tableName: string, id: unknown): string => {
    const t = tableDef(tableName);
    if (!t) return asText(id);
    const rows = tables[tableName] || [];
    const row = rows.find((r) => asText(r[t.primaryKey]) === asText(id));
    if (!row) return asText(id);
    const v = row[displayColumn(t)];
    return v === undefined || v === null ? asText(id) : asText(v);
  };

  const tableApi = (name: string) => {
    const t = tableDef(name);
    const pk = t ? t.primaryKey : "id";
    const rows = () => (tables[name] || []).map((r) => Object.assign({}, r));
    return {
      name,
      all: () => rows(),
      list: (opts?: Row) => query(rows(), opts),
      get: (id: unknown) =>
        rows().find((r) => asText(r[pk]) === asText(id)) || null,
      find: (where: Row) => query(rows(), { where })[0] || null,
      count: (opts?: Row) => query(rows(), opts).length,
      display: (row: Row | unknown) =>
        typeof row === "object" && row !== null
          ? t
            ? asText((row as Row)[displayColumn(t)])
            : asText((row as Row)[pk])
          : displayOf(name, row),
      columns: () => (t ? t.columns.slice() : []),
    };
  };

  const api: any = {
    schema,
    context: {},
    icons: {},
    options: {},
    autoHydrate: true,
    tables: () => schema.tables.map((t) => t.name),
    table: (name: string) => tableApi(name),
    setContext(ctx: Row) {
      Object.assign(api.context, ctx || {});
      api.hydrate();
    },
  };
  for (const t of schema.tables)
    if (!(t.name in api)) api[t.name] = tableApi(t.name);

  // ----- hydration -----

  const TEMPLATE = "__paperosTemplate";

  const hasAncestorSource = (el: any, root: any): boolean => {
    let p = el.parentElement;
    while (p && p !== root) {
      if (p.hasAttribute && p.hasAttribute("data-source")) return true;
      p = p.parentElement;
    }
    return false;
  };

  const topLevelSources = (root: any): any[] => {
    const all: any[] = Array.prototype.slice.call(
      root.querySelectorAll("[data-source]")
    );
    return all.filter((el) => !hasAncestorSource(el, root));
  };

  const resolvePlaceholders = (filter: string, ctx: Row): string =>
    filter
      .replace(/\{(\$?[A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, key: string) => {
        const v = ctx[key];
        return v === undefined
          ? "null"
          : /\s/.test(asText(v))
            ? '"' + asText(v) + '"'
            : asText(v);
      })
      .replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_m, key: string) => {
        const v = api.context[key];
        return v === undefined
          ? "null"
          : /\s/.test(asText(v))
            ? '"' + asText(v) + '"'
            : asText(v);
      });

  const fillField = (el: any, row: Row, tableName: string) => {
    const field = el.getAttribute("data-field");
    if (!field) return;
    let value: unknown = row[field];
    const t = tableDef(tableName);
    const col = t ? t.columns.find((c) => c.name === field) : undefined;
    if (el.hasAttribute("data-display") && col && col.type === "ref" && col.ref)
      value = displayOf(col.ref, value);
    const as = el.getAttribute("data-as");
    const attrName = el.getAttribute("data-attr");
    const text = asText(value);
    if (attrName) {
      el.setAttribute(attrName, text);
      return;
    }
    const tag = String(el.tagName || "").toLowerCase();
    if (as === "html") el.innerHTML = text;
    else if (as === "icon")
      el.innerHTML = api.icons[text] !== undefined ? api.icons[text] : "";
    else if (tag === "img" || tag === "source" || as === "image")
      el.setAttribute("src", text);
    else if (tag === "a" || as === "link") el.setAttribute("href", text);
    else if (tag === "input") el.setAttribute("value", text);
    else el.textContent = text;
  };

  const fillClone = (clone: any, row: Row, tableName: string, ctx: Row) => {
    const t = tableDef(tableName);
    if (t && row[t.primaryKey] !== undefined)
      clone.setAttribute("data-id", asText(row[t.primaryKey]));
    const fields: any[] = Array.prototype.slice.call(
      clone.querySelectorAll("[data-field]")
    );
    if (clone.hasAttribute("data-field")) fields.unshift(clone);
    for (const f of fields) {
      if (f !== clone && hasAncestorSource(f, clone)) continue;
      fillField(f, row, tableName);
    }
    for (const nested of topLevelSources(clone))
      hydrateElement(nested, Object.assign({}, ctx, row));
  };

  const hydrateElement = (el: any, ctx: Row) => {
    const tableName = el.getAttribute("data-source");
    let tpl = el[TEMPLATE];
    if (!tpl) {
      tpl = el.firstElementChild ? el.firstElementChild.cloneNode(true) : null;
      el[TEMPLATE] = tpl;
    }
    if (!tpl) return;
    let rows = (tables[tableName] || []).slice();
    const filter = el.getAttribute("data-filter");
    if (filter) {
      const terms = parseFilter(resolvePlaceholders(filter, ctx));
      rows = rows.filter((r) => terms.every((t) => matchesTerm(r, t)));
    }
    const visible = api.options && api.options.visible;
    if (typeof visible === "function")
      rows = rows.filter((r) => visible(tableName, r) !== false);
    rows = sortRows(rows, el.getAttribute("data-order"));
    el.textContent = "";
    const group = el.getAttribute("data-group");
    if (group) {
      const seen: string[] = [];
      for (const r of rows) {
        const g = asText(r[group]);
        if (seen.indexOf(g) === -1) seen.push(g);
      }
      for (const g of seen) {
        const clone = tpl.cloneNode(true);
        const groupRow: Row = { $group: g };
        groupRow[group] = g;
        fillClone(
          clone,
          groupRow,
          tableName,
          Object.assign({}, ctx, { $group: g })
        );
        el.appendChild(clone);
      }
    } else {
      for (const r of rows) {
        const clone = tpl.cloneNode(true);
        fillClone(clone, r, tableName, ctx);
        el.appendChild(clone);
      }
    }
    if (!rows.length && el.hasAttribute("data-empty"))
      el.textContent = el.getAttribute("data-empty");
  };

  api.hydrate = (root?: any, options?: Row) => {
    const doc = win.document;
    const r = root || doc;
    if (options) Object.assign(api.options, options);
    if (!r || !r.querySelectorAll) return 0;
    const list = topLevelSources(r);
    for (const el of list) hydrateElement(el, {});
    return list.length;
  };

  win.paperos = win.paperos || {};
  win.paperos.data = api;
  const doc = win.document;
  if (doc && typeof doc.addEventListener === "function") {
    const run = () => {
      if (api.autoHydrate !== false) api.hydrate();
    };
    if (doc.readyState === "loading")
      doc.addEventListener("DOMContentLoaded", run);
    else run();
  }
  return api;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The script tag body: the runtime applied to `window` with the payload embedded. */
export function dataRuntimeScript(payload: RuntimePayload): string {
  const json = JSON.stringify(payload)
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `(${dataRuntime.toString()})(window, ${json});`;
}
