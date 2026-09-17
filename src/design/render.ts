/**
 * The component renderer, shared by the bundler (pages are rendered to HTML
 * before they reach the iframe) and the preview runtime (`<ds-component>`
 * and `data-component` elements hydrate in the page).
 *
 * `designCore` is self-contained (no imports, no outer references) so its
 * source can be injected into the preview with `toString()`, exactly like
 * `dataRuntime`. Template language:
 *
 *   {prop}            escaped text          {@prop}         raw HTML (slots)
 *   {#each items}...{/each}   repeat; inside: {.} the item, {key} a field,
 *                             {@index} the index, {@first} / {@last}
 *   {#if prop}...{:else}...{/if}   truthiness
 *   {prop|json}       JSON text             {{literal}}     a literal {literal}
 *
 * Missing values render as empty strings. Prop defaults and variant props
 * are merged under the instance props; `fields` props default to the columns
 * of the bound table when a schema is known.
 */

export interface RenderComponentDef {
  name: string;
  props: {
    name: string;
    type: string;
    default?: unknown;
    of?: string;
    options?: string[];
  }[];
  slots: string[];
  template: string;
  variants: { name: string; props: Record<string, unknown> }[];
}

export interface RenderPayload {
  components: RenderComponentDef[];
  schema?: {
    tables: {
      name: string;
      primaryKey: string;
      display?: string;
      columns: {
        name: string;
        type: string;
        ref?: string;
        required?: boolean;
      }[];
    }[];
  };
  /** Page routes, for `href="#/route"` navigation: route -> page name. */
  routes?: Record<string, string>;
}

export interface DesignCore {
  render(
    name: string,
    props?: Record<string, unknown>,
    children?: string,
    variant?: string
  ): string;
  template(source: string, scope: Record<string, unknown>): string;
  resolveProps(
    name: string,
    props?: Record<string, unknown>,
    variant?: string
  ): Record<string, unknown>;
  escape(text: unknown): string;
  has(name: string): boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function designCore(payload: RenderPayload): DesignCore {
  const components = payload.components || [];
  const schema = payload.schema || { tables: [] };
  const byName: Record<string, RenderComponentDef> = {};
  for (const c of components) byName[c.name] = c;

  const asText = (v: unknown): string =>
    v === undefined || v === null
      ? ""
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);

  const escape = (v: unknown): string =>
    asText(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const truthy = (v: unknown): boolean =>
    Array.isArray(v) ? v.length > 0 : !!v && v !== "false" && v !== "0";

  const lookup = (scopes: Record<string, unknown>[], key: string): unknown => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const s = scopes[i];
      if (s && typeof s === "object" && key in s) return (s as any)[key];
    }
    return undefined;
  };

  /** `a.b.c` through the scopes; `.` is the current item. */
  const resolve = (
    scopes: Record<string, unknown>[],
    path: string
  ): unknown => {
    if (path === ".") return lookup(scopes, ".");
    const parts = path.split(".");
    let v = lookup(scopes, parts[0]);
    for (let i = 1; i < parts.length && v !== undefined && v !== null; i++)
      v = (v as any)[parts[i]];
    return v;
  };

  const tableDef = (name: unknown) =>
    schema.tables.find((t) => t.name === asText(name));

  const displayColumn = (t: {
    display?: string;
    primaryKey: string;
    columns: { name: string }[];
  }) => {
    const has = (n: string) => t.columns.some((c) => c.name === n);
    if (t.display && has(t.display)) return t.display;
    for (const g of ["name", "title", "label", "email"]) if (has(g)) return g;
    return t.primaryKey;
  };

  // Finds the matching {/each} or {/if} for the block opened at `start`, honoring nesting.
  const findClose = (
    src: string,
    start: number,
    kind: "each" | "if"
  ): { close: number; end: number; elseAt: number } => {
    const openRe = new RegExp("\\{#" + kind + "\\b[^}]*\\}", "g");
    const closeTag = "{/" + kind + "}";
    let depth = 1;
    let i = start;
    let elseAt = -1;
    while (i < src.length) {
      const nextOpen = src.indexOf("{#" + kind, i);
      const nextClose = src.indexOf(closeTag, i);
      const nextElse = kind === "if" ? src.indexOf("{:else}", i) : -1;
      if (nextClose === -1)
        return { close: src.length, end: src.length, elseAt };
      if (
        depth === 1 &&
        nextElse !== -1 &&
        nextElse < nextClose &&
        (nextOpen === -1 || nextElse < nextOpen)
      ) {
        elseAt = nextElse;
        i = nextElse + 7;
        continue;
      }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        openRe.lastIndex = nextOpen;
        const m = openRe.exec(src);
        i = m ? m.index + m[0].length : nextOpen + 2;
        continue;
      }
      depth--;
      if (depth === 0)
        return { close: nextClose, end: nextClose + closeTag.length, elseAt };
      i = nextClose + closeTag.length;
    }
    return { close: src.length, end: src.length, elseAt };
  };

  const template = (src: string, scopes: Record<string, unknown>[]): string => {
    let out = "";
    let i = 0;
    while (i < src.length) {
      const at = src.indexOf("{", i);
      if (at === -1) {
        out += src.slice(i);
        break;
      }
      out += src.slice(i, at);
      // {{...}} is a literal brace pair (for data-filter="parent_id={{id}}").
      if (src.charAt(at + 1) === "{") {
        const lit = src.indexOf("}}", at + 2);
        if (lit !== -1) {
          out += "{" + src.slice(at + 2, lit) + "}";
          i = lit + 2;
          continue;
        }
      }
      const close = src.indexOf("}", at);
      if (close === -1) {
        out += src.slice(at);
        break;
      }
      const tag = src.slice(at + 1, close).trim();
      const afterTag = close + 1;
      if (tag.startsWith("#each ")) {
        const key = tag.slice(6).trim();
        const { close: bodyEnd, end } = findClose(src, afterTag, "each");
        const body = src.slice(afterTag, bodyEnd);
        const list = resolve(scopes, key);
        const items: unknown[] = Array.isArray(list)
          ? list
          : list && typeof list === "object"
            ? Object.keys(list as object).map((k) => ({
                key: k,
                value: (list as any)[k],
              }))
            : [];
        items.forEach((item, index) => {
          const scope: Record<string, unknown> =
            item && typeof item === "object" && !Array.isArray(item)
              ? Object.assign({}, item as Record<string, unknown>)
              : {};
          scope["."] = item;
          scope["@index"] = index;
          scope["@first"] = index === 0;
          scope["@last"] = index === items.length - 1;
          out += template(body, scopes.concat([scope]));
        });
        i = end;
        continue;
      }
      if (tag.startsWith("#if ")) {
        const key = tag.slice(4).trim();
        const { close: bodyEnd, end, elseAt } = findClose(src, afterTag, "if");
        const negate = key.startsWith("!");
        const value = resolve(scopes, negate ? key.slice(1) : key);
        const ok = negate ? !truthy(value) : truthy(value);
        const thenBody = src.slice(afterTag, elseAt === -1 ? bodyEnd : elseAt);
        const elseBody = elseAt === -1 ? "" : src.slice(elseAt + 7, bodyEnd);
        out += template(ok ? thenBody : elseBody, scopes);
        i = end;
        continue;
      }
      if (tag.startsWith("/") || tag.startsWith(":") || tag === "") {
        // Stray close tags render as nothing.
        i = afterTag;
        continue;
      }
      // Not a template tag (CSS braces, JSON): leave it alone.
      if (!/^[@.]?[A-Za-z_@.][A-Za-z0-9_.@]*(\|[a-z]+)?$/.test(tag)) {
        out += src.slice(at, afterTag);
        i = afterTag;
        continue;
      }
      let raw = false;
      let expr = tag;
      if (
        expr.charAt(0) === "@" &&
        expr !== "@index" &&
        expr !== "@first" &&
        expr !== "@last"
      ) {
        raw = true;
        expr = expr.slice(1);
      }
      let filter = "";
      const pipe = expr.indexOf("|");
      if (pipe !== -1) {
        filter = expr.slice(pipe + 1);
        expr = expr.slice(0, pipe);
      }
      const value = resolve(scopes, expr);
      if (filter === "json")
        out += escape(JSON.stringify(value === undefined ? null : value));
      else if (filter === "attr")
        out += escape(JSON.stringify(value === undefined ? null : value));
      else if (raw) out += asText(value);
      else out += escape(value);
      i = afterTag;
    }
    return out;
  };

  const resolveProps = (
    name: string,
    props?: Record<string, unknown>,
    variant?: string
  ): Record<string, unknown> => {
    const def = byName[name];
    const out: Record<string, unknown> = {};
    const defaults: Record<string, unknown> = {};
    let variantProps: Record<string, unknown> | null = null;
    if (def) {
      for (const p of def.props)
        if (p.default !== undefined) defaults[p.name] = out[p.name] = p.default;
      const v = variant || (props && (props as any).variant);
      if (v) {
        const found = def.variants.find((x) => x.name === v);
        if (found) {
          variantProps = found.props;
          Object.assign(out, found.props);
        }
        out.variant = v;
      }
    }
    if (props)
      for (const k of Object.keys(props)) {
        // A prop left at its default does not undo what the variant set.
        if (
          variantProps &&
          k in variantProps &&
          k in defaults &&
          JSON.stringify(props[k]) === JSON.stringify(defaults[k])
        )
          continue;
        if (props[k] !== undefined && props[k] !== "") out[k] = props[k];
        else if (!(k in out)) out[k] = props[k];
      }
    if (def) {
      for (const p of def.props) {
        if (p.type !== "fields" && p.type !== "field") continue;
        const table = tableDef(out[p.of || "table"]);
        if (!table) continue;
        const current = out[p.name];
        if (
          p.type === "fields" &&
          (!Array.isArray(current) || current.length === 0)
        ) {
          out[p.name] = table.columns
            .filter((c) => c.type !== "json" || table.columns.length <= 2)
            .map((c) => c.name);
        }
        if (
          p.type === "field" &&
          (current === undefined || current === null || current === "")
        )
          out[p.name] = displayColumn(table);
      }
      // Column objects for templates that need labels and types.
      const table = tableDef(out.table);
      if (table && out.columns === undefined) {
        const fields = Array.isArray(out.fields)
          ? (out.fields as unknown[]).map(asText)
          : [];
        out.columns = (
          fields.length ? fields : table.columns.map((c) => c.name)
        ).map((f) => {
          const col = table.columns.find((c) => c.name === f);
          const type = col ? col.type : "string";
          const inputType =
            type === "number"
              ? "number"
              : type === "boolean"
                ? "checkbox"
                : type === "date"
                  ? "date"
                  : type === "image"
                    ? "url"
                    : "text";
          const refTable = col && col.ref ? tableDef(col.ref) : undefined;
          return {
            name: f,
            label: f.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
            type,
            ref: col ? col.ref : undefined,
            refDisplay: refTable ? displayColumn(refTable) : undefined,
            inputType,
            isRef: type === "ref",
            isImage: type === "image",
            isBoolean: type === "boolean",
            required: !!(col && col.required),
            key: f === table.primaryKey,
          };
        });
        if (out.display === undefined) out.display = displayColumn(table);
        if (out.primaryKey === undefined) out.primaryKey = table.primaryKey;
      }
    }
    return out;
  };

  const render = (
    name: string,
    props?: Record<string, unknown>,
    children?: string,
    variant?: string
  ): string => {
    const def = byName[name];
    if (!def)
      return (
        '<div class="ds-missing" data-component="' +
        escape(name) +
        '">Unknown component: ' +
        escape(name) +
        "</div>"
      );
    const scope = resolveProps(name, props, variant);
    if (children !== undefined && children !== "") scope.children = children;
    for (const s of def.slots) if (scope[s] === undefined) scope[s] = "";
    scope.component = def.name;
    return template(def.template, [scope]);
  };

  return {
    render,
    template: (src, scope) => template(src, [scope]),
    resolveProps,
    escape,
    has: (name) => !!byName[name],
  };
}

/**
 * The browser side: hydrates `<ds-component name="Card" props='{...}'>`
 * and `<div data-component="Card" data-prop-title="...">` elements, exposes
 * `paperos.design` and turns `href="#/route"` clicks into navigation
 * messages for the Preview window. It also draws what templates cannot
 * (`enhance()`: icons, avatar initials, charts and calendars from the bound
 * tables, role gates), keeps the preview context (`setContext({tenant,
 * role})`: `@key` filters, the tenant's brand colors, gated rows and blocks)
 * and toggles the theme (`setTheme`, `[data-toggle-theme]`).
 */
export function designRuntime(
  win: any,
  payload: RenderPayload,
  core: (payload: RenderPayload) => DesignCore
): any {
  const api = core(payload);
  const doc = win.document;

  const parseProps = (text: string | null): Record<string, unknown> => {
    if (!text) return {};
    try {
      const v = JSON.parse(text);
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  };

  const propsOf = (el: any): Record<string, unknown> => {
    const props = parseProps(
      el.getAttribute("props") || el.getAttribute("data-props")
    );
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      if (a.name.indexOf("data-prop-") === 0) {
        const key = a.name
          .slice(10)
          .replace(/-([a-z])/g, (_m: string, c: string) => c.toUpperCase());
        let v: unknown = a.value;
        if (v === "true") v = true;
        else if (v === "false") v = false;
        else if (typeof v === "string" && /^[\[{]/.test(v)) {
          try {
            v = JSON.parse(v);
          } catch {
            /* keep the text */
          }
        }
        props[key] = v;
      }
    }
    return props;
  };

  const hydrateOne = (el: any) => {
    const name = el.getAttribute("name") || el.getAttribute("data-component");
    if (!name) return null;
    const html = api.render(
      name,
      propsOf(el),
      el.innerHTML,
      el.getAttribute("variant") || el.getAttribute("data-variant") || undefined
    );
    const wrapper = doc.createElement("div");
    wrapper.innerHTML = html;
    const nodes = Array.prototype.slice.call(wrapper.childNodes);
    const parent = el.parentNode;
    if (!parent) return null;
    for (const n of nodes) parent.insertBefore(n, el);
    parent.removeChild(el);
    return nodes.filter((n: any) => n.nodeType === 1);
  };

  const hydrate = (root?: any): number => {
    const r = root || doc;
    if (!r || !r.querySelectorAll) return 0;
    let count = 0;
    // Innermost first so nested components render into their parents' slots.
    for (let guard = 0; guard < 20; guard++) {
      const list: any[] = Array.prototype.slice.call(
        r.querySelectorAll("ds-component, [data-component]")
      );
      const leaves = list.filter(
        (el) => !el.querySelector("ds-component, [data-component]")
      );
      if (!leaves.length) break;
      const fresh: any[] = [];
      for (const el of leaves) {
        const nodes = hydrateOne(el);
        if (nodes) fresh.push(...nodes);
        count++;
      }
      const data = win.paperos && win.paperos.data;
      if (data && typeof data.hydrate === "function")
        for (const n of fresh) {
          if (n.hasAttribute && n.hasAttribute("data-source"))
            data.hydrate(n.parentNode || n);
          else data.hydrate(n);
        }
    }
    if (count) enhance(r);
    return count;
  };

  const navigate = (route: string) => {
    try {
      win.parent.postMessage(
        {
          source: "paperos-preview",
          type: "navigate",
          route,
          page: (payload.routes || {})[route] || null,
        },
        "*"
      );
    } catch {
      /* not in a frame */
    }
  };

  const dataApi = (): any => (win.paperos && win.paperos.data) || null;

  // ----- icons (inline SVG, 24px grid, stroke = currentColor) -----
  const ICON_PATHS: Record<string, string> = {
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    users:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M15 5a3.5 3.5 0 0 1 0 7M17.5 14.5A6 6 0 0 1 21.5 20"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    chart: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone:
      '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    linkedin:
      '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.5M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
    megaphone:
      '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1zM14 9a3 3 0 0 1 0 6M17 6a7 7 0 0 1 0 12"/>',
    image:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="8" cy="8" r="1.5"/>',
    receipt:
      '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8 8h8M8 12h8M8 16h5"/>',
    star: '<path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    sparkles:
      '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/>',
    book: '<path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2zM4 17h14"/>',
    pen: '<path d="m4 20 1.5-5L16 4.5l3.5 3.5L9 18.5zM14 6.5l3.5 3.5"/>',
    file: '<path d="M6 2h8l5 5v15H6zM14 2v5h5"/>',
    scissors:
      '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 19M8.5 16.5 20 5"/>',
    utensils:
      '<path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18M17 3c-2 2-2 6-2 8h4V3zM17 11v10"/>',
    hammer: '<path d="m14 4 6 6-2 2-6-6zM12 6 4 14l2 2 2 2 8-8"/>',
    cart: '<path d="M3 4h2l2.5 11h10L20 7H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="16" cy="20" r="1.5"/>',
    heart:
      '<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>',
    map: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    money:
      '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
    briefcase:
      '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    target:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    send: '<path d="m3 11 18-8-8 18-2-8z"/>',
  };
  const icons: Record<string, string> = {};
  for (const k of Object.keys(ICON_PATHS))
    icons[k] =
      '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICON_PATHS[k] +
      "</svg>";

  const qsa = (root: any, selector: string): any[] => {
    try {
      return Array.prototype.slice.call(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  // ----- context: tenant and role -----
  const ctxOf = (): Record<string, unknown> => {
    const d = dataApi();
    return d ? d.context || (d.context = {}) : {};
  };
  const rowOf = (table: string, id: unknown): any => {
    const d = dataApi();
    return d && d[table] && typeof d[table].get === "function"
      ? d[table].get(id)
      : null;
  };
  const roleLevel = (id: unknown): number | null => {
    const r = rowOf("roles", id);
    return r && typeof r.level === "number" ? r.level : null;
  };
  const roleByName = (name: string): any => {
    const d = dataApi();
    const rows: any[] = d && d.roles ? d.roles.list() : [];
    const n = String(name).toLowerCase();
    return (
      rows.find((r) => String(r.name).toLowerCase() === n) ||
      rows.find((r) => String(r.id) === String(name)) ||
      null
    );
  };
  /** Rows with `required_role` are hidden from lower roles; menu rows with a `business_type` from other businesses. */
  const gate = (_table: string, row: any): boolean => {
    const d = dataApi();
    if (!d || !row || typeof row !== "object" || !("required_role" in row))
      return true;
    if (row.required_role !== null && row.required_role !== undefined) {
      const needed = roleLevel(row.required_role);
      const ctx = ctxOf();
      const have = ctx.role !== undefined ? roleLevel(ctx.role) : null;
      if (needed !== null && (have === null || have < needed)) return false;
    }
    const business = ctxOf().business;
    if (row.business_type && business && row.business_type !== business)
      return false;
    return true;
  };
  const applyTenantTheme = () => {
    const d = dataApi();
    const root = doc && doc.documentElement;
    if (!d || !root || !root.style) return;
    const ctx = ctxOf();
    const t = ctx.tenant !== undefined ? rowOf("tenants", ctx.tenant) : null;
    const map: Record<string, string> = {
      brand_primary: "--ds-color-primary",
      brand_accent: "--ds-color-accent",
      brand_accent2: "--ds-color-accent2",
    };
    for (const k of Object.keys(map)) {
      if (t && t[k]) root.style.setProperty(map[k], String(t[k]));
      else root.style.removeProperty(map[k]);
    }
    if (t) {
      root.setAttribute("data-tenant", String(t.id));
      if (t.business_type) ctx.business = t.business_type;
    } else root.removeAttribute("data-tenant");
  };
  const applyGates = (root?: any) => {
    const r = root || doc;
    if (!r) return;
    const ctx = ctxOf();
    const have = ctx.role !== undefined ? roleLevel(ctx.role) : null;
    for (const el of qsa(r, "[data-min-role]")) {
      const role = roleByName(el.getAttribute("data-min-role"));
      const needed = role && typeof role.level === "number" ? role.level : null;
      const denied = needed !== null && (have === null || have < needed);
      el.hidden = denied;
      const name = el.getAttribute("data-min-role");
      for (const d of qsa(r, "[data-gate-denied]"))
        if (d.getAttribute("data-gate-denied") === name) d.hidden = !denied;
    }
  };
  const syncSelects = (root?: any) => {
    const r = root || doc;
    if (!r) return;
    const ctx = ctxOf();
    for (const sel of qsa(r, "[data-set-context]")) {
      const key = sel.getAttribute("data-set-context");
      const want = ctx[key];
      const options: any[] = Array.prototype.slice.call(sel.options || []);
      for (const o of options)
        o.selected =
          want !== undefined &&
          String(o.getAttribute("data-id")) === String(want);
    }
  };

  // ----- avatars: initials and a per-name hue -----
  const initialsOf = (name: string): string => {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "";
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  };
  const hueOf = (name: string): number => {
    let h = 0;
    const s = String(name || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  };
  const enhanceAvatars = (r: any) => {
    for (const el of qsa(r, ".ds-avatar[data-name]")) {
      const name = el.getAttribute("data-name") || "";
      const target =
        el.querySelector && el.querySelector(".ds-avatar__initials");
      if (target && !String(target.textContent || "").trim())
        target.textContent = initialsOf(name);
      if (!el.hasAttribute("data-hue") && name) {
        el.setAttribute("data-hue", String(hueOf(name)));
        if (el.style)
          el.style.setProperty("--ds-avatar-hue", String(hueOf(name)));
      }
    }
  };
  const enhanceIcons = (r: any) => {
    for (const el of qsa(r, "[data-icon]")) {
      const name = el.getAttribute("data-icon");
      if (name && icons[name] && el.getAttribute("data-icon-drawn") !== name) {
        el.innerHTML = icons[name];
        el.setAttribute("data-icon-drawn", name);
      }
    }
  };

  // ----- charts and calendars: drawn from the bound table -----
  const resolveFilter = (filter: string): string => {
    const ctx = ctxOf();
    return String(filter || "").replace(
      /@([A-Za-z_][A-Za-z0-9_]*)/g,
      (_m, key: string) => {
        const v = ctx[key];
        if (v === undefined || v === null) return "null";
        const t = String(v);
        return /\s/.test(t) ? '"' + t + '"' : t;
      }
    );
  };
  const rowsOf = (table: string, filter: string): any[] => {
    const d = dataApi();
    if (!d || !table || !d[table]) return [];
    let rows: any[] = d[table].list({ filter: resolveFilter(filter) });
    const visible = d.options && d.options.visible;
    if (typeof visible === "function")
      rows = rows.filter((row) => visible(table, row) !== false);
    return rows;
  };
  const num = (v: unknown): number => {
    const n =
      typeof v === "number"
        ? v
        : parseFloat(
            String(v === undefined || v === null ? "" : v).replace(
              /[^0-9.-]/g,
              ""
            )
          );
    return isFinite(n) ? n : 0;
  };
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const MONTHS_LONG = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const fmtValue = (v: number, format: string): string => {
    if (format === "currency")
      return (
        "$" +
        (v >= 1000
          ? Math.round(v).toLocaleString()
          : (Math.round(v * 100) / 100).toLocaleString())
      );
    if (format === "compact")
      return v >= 1000
        ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k"
        : String(Math.round(v));
    return String(Math.round(v * 100) / 100);
  };
  const chartSeries = (el: any): { label: string; value: number }[] => {
    const table = el.getAttribute("data-table");
    if (table) {
      const x = el.getAttribute("data-x");
      const y = el.getAttribute("data-y");
      let rows = rowsOf(table, el.getAttribute("data-filter") || "");
      if (!x)
        return [
          {
            label: table,
            value: y ? rows.reduce((a, r) => a + num(r[y]), 0) : rows.length,
          },
        ];
      const dateLike =
        rows.length > 0 &&
        rows.every((r) => /^\d{4}-\d{2}(-\d{2})?/.test(String(r[x] || "")));
      if (dateLike)
        rows = rows
          .slice()
          .sort((a, b) => String(a[x]).localeCompare(String(b[x])));
      const years = new Set(rows.map((r) => String(r[x]).slice(0, 4)));
      const buckets: Record<string, number> = {};
      const order: string[] = [];
      for (const r of rows) {
        const raw = String(r[x] === undefined || r[x] === null ? "" : r[x]);
        let key = raw;
        if (dateLike) {
          const m = Number(raw.slice(5, 7)) - 1;
          key = MONTHS[m] + (years.size > 1 ? " " + raw.slice(2, 4) : "");
        }
        if (!(key in buckets)) {
          buckets[key] = 0;
          order.push(key);
        }
        buckets[key] += y ? num(r[y]) : 1;
      }
      return order.slice(0, 14).map((k) => ({ label: k, value: buckets[k] }));
    }
    try {
      const list = JSON.parse(el.getAttribute("data-values") || "[]");
      return Array.isArray(list)
        ? list.map((v: any) => ({
            label: String(
              v.label !== undefined ? v.label : v.x !== undefined ? v.x : ""
            ),
            value: num(v.value !== undefined ? v.value : v.y),
          }))
        : [];
    } catch {
      return [];
    }
  };
  let chartSeq = 0;
  const drawChart = (el: any) => {
    const body = el.querySelector && el.querySelector(".ds-chart__body");
    if (!body) return;
    const series = chartSeries(el);
    const format = el.getAttribute("data-format") || "number";
    const total = series.reduce((a, s) => a + s.value, 0);
    const totalEl = el.querySelector(".ds-chart__total");
    if (totalEl)
      totalEl.textContent =
        el.getAttribute("data-show-total") === "false"
          ? ""
          : fmtValue(total, format);
    if (!series.length) {
      body.innerHTML = '<div class="ds-chart__empty">No data</div>';
      return;
    }
    const W = Math.max(240, Math.min(1400, num(el.clientWidth) - 40 || 600));
    const H = Math.max(80, num(el.getAttribute("data-height")) || 180);
    const padL = 8,
      padR = 8,
      padT = 22,
      padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const max = Math.max(1, ...series.map((s) => s.value));
    const id = "dsc" + ++chartSeq;
    const kind = el.getAttribute("data-chart") === "line" ? "line" : "bars";
    const esc = api.escape;
    let svg =
      '<svg class="ds-chart__svg" viewBox="0 0 ' +
      W +
      " " +
      H +
      '" role="img"><defs>' +
      '<linearGradient id="' +
      id +
      '-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--ds-color-primary)"/><stop offset="1" style="stop-color: var(--ds-color-accent)"/></linearGradient>' +
      '<linearGradient id="' +
      id +
      '-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--ds-color-primary); stop-opacity: 0.35"/><stop offset="1" style="stop-color: var(--ds-color-primary); stop-opacity: 0"/></linearGradient></defs>';
    for (let g = 1; g <= 3; g++) {
      const gy = padT + innerH - (innerH * g) / 3;
      svg +=
        '<line class="ds-chart__grid" x1="' +
        padL +
        '" x2="' +
        (W - padR) +
        '" y1="' +
        gy.toFixed(1) +
        '" y2="' +
        gy.toFixed(1) +
        '"/>';
    }
    const n = series.length;
    const step = innerW / n;
    if (kind === "bars") {
      const bw = Math.max(6, Math.min(72, step * 0.62));
      series.forEach((s, i) => {
        const h = (s.value / max) * innerH;
        const x = padL + i * step + (step - bw) / 2;
        const y = padT + innerH - h;
        svg +=
          '<rect class="ds-chart__bar" x="' +
          x.toFixed(1) +
          '" y="' +
          y.toFixed(1) +
          '" width="' +
          bw.toFixed(1) +
          '" height="' +
          Math.max(0, h).toFixed(1) +
          '" rx="4" fill="url(#' +
          id +
          '-g)"><title>' +
          esc(s.label) +
          ": " +
          esc(fmtValue(s.value, format)) +
          "</title></rect>";
        if (n <= 12)
          svg +=
            '<text class="ds-chart__value" x="' +
            (x + bw / 2).toFixed(1) +
            '" y="' +
            (y - 6).toFixed(1) +
            '" text-anchor="middle">' +
            esc(fmtValue(s.value, format)) +
            "</text>";
      });
    } else {
      const pts = series.map((s, i) => {
        const x = padL + i * step + step / 2;
        const y = padT + innerH - (s.value / max) * innerH;
        return [x, y];
      });
      const line = pts
        .map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1))
        .join(" ");
      const area =
        "M" +
        pts[0][0].toFixed(1) +
        "," +
        (padT + innerH) +
        " L" +
        line.replace(/ /g, " L") +
        " L" +
        pts[pts.length - 1][0].toFixed(1) +
        "," +
        (padT + innerH) +
        " Z";
      svg +=
        '<path class="ds-chart__area" d="' +
        area +
        '" fill="url(#' +
        id +
        '-a)"/>';
      svg += '<polyline class="ds-chart__line" points="' + line + '"/>';
      pts.forEach((p, i) => {
        svg +=
          '<circle class="ds-chart__dot" cx="' +
          p[0].toFixed(1) +
          '" cy="' +
          p[1].toFixed(1) +
          '" r="3.5"><title>' +
          esc(series[i].label) +
          ": " +
          esc(fmtValue(series[i].value, format)) +
          "</title></circle>";
      });
    }
    series.forEach((s, i) => {
      if (n > 12 && i % 2 === 1) return;
      svg +=
        '<text class="ds-chart__label" x="' +
        (padL + i * step + step / 2).toFixed(1) +
        '" y="' +
        (H - 8) +
        '" text-anchor="middle">' +
        esc(s.label) +
        "</text>";
    });
    svg += "</svg>";
    body.innerHTML = svg;
  };

  const TONES = ["primary", "accent", "accent2", "ok", "muted"];
  const drawCalendar = (el: any) => {
    const grid = el.querySelector && el.querySelector(".ds-calendar__grid");
    if (!grid) return;
    const table = el.getAttribute("data-table");
    const dateField = el.getAttribute("data-date");
    const titleField = el.getAttribute("data-title");
    const toneField = el.getAttribute("data-tone");
    const d = dataApi();
    const rows =
      table && dateField
        ? rowsOf(table, el.getAttribute("data-filter") || "")
        : [];
    const dated = rows
      .map((r) => ({ row: r, date: String(r[dateField] || "").slice(0, 10) }))
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    let month = el.getAttribute("data-month") || "";
    if (!/^\d{4}-\d{2}$/.test(month)) {
      if (dated.length) {
        // The month with the most events (the seed data's "current" month).
        const counts: Record<string, number> = {};
        for (const e of dated)
          counts[e.date.slice(0, 7)] = (counts[e.date.slice(0, 7)] || 0) + 1;
        month = Object.keys(counts).sort(
          (a, b) => counts[b] - counts[a] || a.localeCompare(b)
        )[0];
      } else {
        const now = new Date();
        month =
          now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      }
    }
    const year = Number(month.slice(0, 4));
    const mi = Number(month.slice(5, 7)) - 1;
    const first = new Date(Date.UTC(year, mi, 1));
    const daysInMonth = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const inMonth = dated.filter((e) => e.date.slice(0, 7) === month);
    const head = el.querySelector(".ds-calendar__month");
    if (head) head.textContent = MONTHS_LONG[mi] + " " + year;
    const count = el.querySelector(".ds-calendar__count");
    if (count)
      count.textContent = inMonth.length
        ? inMonth.length + " " + (table || "events")
        : "";
    const tones: Record<string, string> = {};
    let toneIdx = 0;
    const toneOf = (row: any): string => {
      if (!toneField) return "primary";
      const v = String(
        row[toneField] === undefined || row[toneField] === null
          ? ""
          : row[toneField]
      ).toLowerCase();
      if (
        ["cancelled", "canceled", "lost", "draft", "no-show"].indexOf(v) !== -1
      )
        return "muted";
      if (
        ["done", "completed", "paid", "won", "published", "confirmed"].indexOf(
          v
        ) !== -1
      )
        return "ok";
      if (!(v in tones)) tones[v] = TONES[toneIdx++ % TONES.length];
      return tones[v];
    };
    const label = (row: any): string => {
      if (
        titleField &&
        row[titleField] !== undefined &&
        row[titleField] !== null
      )
        return String(row[titleField]);
      return d && d[table] ? d[table].display(row) : "";
    };
    const today = new Date();
    const todayKey =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    const esc = api.escape;
    let html = "";
    for (const dow of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
      html += '<div class="ds-calendar__dow">' + dow + "</div>";
    for (let i = 0; i < lead; i++)
      html += '<div class="ds-calendar__day ds-calendar__day--pad"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const key = month + "-" + String(day).padStart(2, "0");
      const events = inMonth.filter((e) => e.date === key);
      html +=
        '<div class="ds-calendar__day' +
        (key === todayKey ? " ds-calendar__day--today" : "") +
        '" data-date="' +
        key +
        '"><span class="ds-calendar__num">' +
        day +
        "</span>";
      events.slice(0, 3).forEach((e) => {
        html +=
          '<span class="ds-calendar__event" data-tone="' +
          toneOf(e.row) +
          '" title="' +
          esc(label(e.row)) +
          '">' +
          esc(label(e.row)) +
          "</span>";
      });
      if (events.length > 3)
        html +=
          '<span class="ds-calendar__more">+' +
          (events.length - 3) +
          " more</span>";
      html += "</div>";
    }
    grid.innerHTML = html;
  };

  // ----- data sources overlay: a badge per bound block naming table.fields -----
  let sourcesOn = false;
  const hasSourceAncestor = (el: any): boolean => {
    let p = el.parentElement;
    while (p) {
      if (p.hasAttribute && p.hasAttribute("data-source")) return true;
      p = p.parentElement;
    }
    return false;
  };
  const postHover = (table: string | null) => {
    try {
      win.parent.postMessage(
        { source: "paperos-design", type: "hover-table", table },
        "*"
      );
    } catch {
      /* not in a frame */
    }
  };
  const setHot = (table: string | null) => {
    for (const el of qsa(doc, ".ds-src-hot")) el.classList.remove("ds-src-hot");
    if (!table) return;
    for (const el of qsa(doc, "[data-source],[data-count],[data-table]")) {
      const t =
        el.getAttribute("data-source") ||
        el.getAttribute("data-count") ||
        el.getAttribute("data-table");
      if (t === table && el.classList) el.classList.add("ds-src-hot");
    }
  };
  const applySources = (root?: any) => {
    const r = root || doc;
    if (!r || !r.querySelectorAll) return;
    for (const b of qsa(r, ".ds-src-badge")) b.parentNode && b.parentNode.removeChild(b);
    if (doc && doc.body) {
      if (sourcesOn) doc.body.setAttribute("data-sources", "on");
      else doc.body.removeAttribute("data-sources");
    }
    if (!sourcesOn) return;
    const perHost = new Map<any, { table: string; fields: string[]; filter: string; mode: string }[]>();
    for (const el of qsa(r, "[data-source],[data-count],[data-chart][data-table],[data-calendar][data-table]")) {
      if (el.hasAttribute("data-set-context")) continue;
      if (hasSourceAncestor(el)) continue;
      const table =
        el.getAttribute("data-source") ||
        el.getAttribute("data-count") ||
        el.getAttribute("data-table");
      if (!table) continue;
      const fields: string[] = [];
      for (const f of qsa(el, "[data-field]")) {
        const name = f.getAttribute("data-field");
        if (name && name.charAt(0) !== "$" && fields.indexOf(name) === -1) fields.push(name);
      }
      const x = el.getAttribute("data-x");
      const y = el.getAttribute("data-y");
      const d = el.getAttribute("data-date");
      const tt = el.getAttribute("data-title");
      for (const extra of [x, y, d, tt]) if (extra && fields.indexOf(extra) === -1) fields.push(extra);
      const host = (el.closest && el.closest(".ds-col")) || el.parentElement || el;
      const list = perHost.get(host) || [];
      const mode = el.tagName && String(el.tagName).toLowerCase() === "form" ? "write" : "read";
      if (!list.some((s) => s.table === table && s.fields.join() === fields.join()))
        list.push({ table, fields, filter: el.getAttribute("data-filter") || "", mode });
      perHost.set(host, list);
    }
    for (const form of qsa(r, "form[data-table]")) {
      const table = form.getAttribute("data-table");
      if (!table) continue;
      const host = (form.closest && form.closest(".ds-col")) || form.parentElement || form;
      const list = perHost.get(host) || [];
      const fields = qsa(form, "[name]").map((i) => i.getAttribute("name")).filter(Boolean);
      list.push({ table, fields, filter: "", mode: "write" });
      perHost.set(host, list);
    }
    perHost.forEach((list, host) => {
      if (!host || !host.appendChild) return;
      try {
        if (win.getComputedStyle && win.getComputedStyle(host).position === "static")
          host.style.position = "relative";
      } catch {
        /* no styles */
      }
      const badge = doc.createElement("span");
      badge.className = "ds-src-badge";
      badge.setAttribute("data-sources-badge", "");
      for (const s of list) {
        const chip = doc.createElement("span");
        chip.className = "ds-src-chip" + (s.mode === "write" ? " ds-src-chip--write" : "");
        chip.setAttribute("data-table", s.table);
        chip.innerHTML =
          "<b>" +
          api.escape(s.table) +
          "</b>" +
          (s.fields.length ? "." + api.escape(s.fields.slice(0, 5).join(", .")) + (s.fields.length > 5 ? " +" + (s.fields.length - 5) : "") : "") +
          (s.filter ? ' <i>where ' + api.escape(s.filter) + "</i>" : "") +
          (s.mode === "write" ? " <i>write</i>" : "");
        chip.addEventListener("mouseenter", () => {
          setHot(s.table);
          postHover(s.table);
        });
        chip.addEventListener("mouseleave", () => {
          setHot(null);
          postHover(null);
        });
        badge.appendChild(chip);
      }
      host.appendChild(badge);
    });
  };
  const showSources = (on?: boolean): boolean => {
    sourcesOn = on === undefined ? !sourcesOn : !!on;
    applySources();
    return sourcesOn;
  };

  /** Draws what templates cannot: icons, initials, charts, calendars, gates. Safe to run again. */
  const enhance = (root?: any): void => {
    const r = root || doc;
    if (!r || !r.querySelectorAll) return;
    try {
      enhanceIcons(r);
      enhanceAvatars(r);
      for (const el of qsa(r, "[data-chart]")) drawChart(el);
      for (const el of qsa(r, "[data-calendar]")) drawCalendar(el);
      applyGates(r);
      syncSelects(r);
      if (sourcesOn) applySources(r);
    } catch (e) {
      try {
        if (win.console && win.console.warn)
          win.console.warn("design enhance:", e);
      } catch {
        /* no console */
      }
    }
  };

  const setContext = (ctx: Record<string, unknown>) => {
    const d = dataApi();
    if (!d) return;
    Object.assign(ctxOf(), ctx || {});
    applyTenantTheme();
    if (typeof d.hydrate === "function") d.hydrate();
    enhance();
  };

  const setTheme = (theme?: string) => {
    const root = doc && doc.documentElement;
    if (!root) return;
    const current =
      root.getAttribute("data-theme") ||
      (win.matchMedia && win.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    const next = theme || (current === "dark" ? "light" : "dark");
    root.setAttribute("data-theme", next);
    return next;
  };

  const design = {
    render: api.render,
    template: api.template,
    resolveProps: api.resolveProps,
    components: () => (payload.components || []).map((c) => c.name),
    routes: payload.routes || {},
    icons,
    hydrate,
    enhance,
    setContext,
    context: ctxOf,
    setTheme,
    showSources,
    sources: () => sourcesOn,
    initials: initialsOf,
    navigate,
    autoHydrate: true,
  };
  win.paperos = win.paperos || {};
  win.paperos.design = design;

  // Defaults: the first tenant and the highest role, unless the page set them (?tenant=, ?role=).
  {
    const d = dataApi();
    if (d) {
      const ctx = ctxOf();
      if (ctx.tenant === undefined && d.tenants) {
        const firstTenant = d.tenants.list({ orderBy: "id" })[0];
        if (firstTenant) ctx.tenant = firstTenant.id;
      }
      if (ctx.role === undefined && d.roles) {
        const top = d.roles.list({ orderBy: "-level" })[0];
        if (top) ctx.role = top.id;
      }
      if (d.options && typeof d.options.visible !== "function")
        d.options.visible = gate;
      if (d.icons && typeof d.icons === "object")
        for (const k of Object.keys(icons))
          if (!(k in d.icons)) d.icons[k] = icons[k];
      applyTenantTheme();
    }
  }

  if (doc && typeof doc.addEventListener === "function") {
    const run = () => {
      if (design.autoHydrate !== false) hydrate();
      enhance();
    };
    if (doc.readyState === "loading")
      doc.addEventListener("DOMContentLoaded", run);
    else run();
    doc.addEventListener("change", (e: any) => {
      const t = e.target;
      if (!t || !t.getAttribute) return;
      const key = t.getAttribute("data-set-context");
      if (!key) return;
      const opt = t.selectedOptions && t.selectedOptions[0];
      const value =
        opt && opt.getAttribute("data-id") !== null
          ? opt.getAttribute("data-id")
          : t.value;
      const patch: Record<string, unknown> = {};
      patch[key] = value;
      setContext(patch);
    });
    doc.addEventListener("click", (e: any) => {
      let el = e.target;
      while (
        el &&
        el !== doc &&
        !(el.tagName && el.tagName.toLowerCase() === "a")
      )
        el = el.parentNode;
      if (!el || el === doc) return;
      const href = el.getAttribute && el.getAttribute("href");
      if (href && href.indexOf("#/") === 0) {
        e.preventDefault();
        navigate(href.slice(1));
      }
    });
    // The Page Builder marks blocks with data-block; tell it which one was clicked.
    doc.addEventListener("click", (e: any) => {
      let el = e.target;
      while (
        el &&
        el !== doc &&
        !(el.getAttribute && el.getAttribute("data-block"))
      )
        el = el.parentNode;
      if (!el || el === doc) return;
      try {
        win.parent.postMessage(
          {
            source: "paperos-design",
            type: "block",
            id: el.getAttribute("data-block"),
          },
          "*"
        );
      } catch {
        /* not in a frame */
      }
    });
    // Tabs, modals and the theme toggle need a little behavior.
    doc.addEventListener("click", (e: any) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const tab = t.closest(".ds-tabs__tab");
      if (tab) {
        const tabs = tab.closest(".ds-tabs");
        const bar = Array.prototype.slice.call(
          tabs.querySelectorAll(".ds-tabs__tab")
        );
        const panels = Array.prototype.slice.call(
          tabs.querySelectorAll(".ds-tabs__panel")
        );
        const i = bar.indexOf(tab);
        bar.forEach((b: any, k: number) =>
          b.classList.toggle("ds-tabs__tab--active", k === i)
        );
        panels.forEach((p: any, k: number) =>
          p.classList.toggle("ds-tabs__panel--active", k === i)
        );
      }
      const close = t.closest("[data-close]");
      if (close) {
        const modal = close.closest(".ds-modal");
        if (modal && !modal.classList.contains("ds-modal--inline"))
          modal.setAttribute("data-open", "false");
      }
      const open = t.closest("[data-open-modal]");
      if (open) {
        const id = open.getAttribute("data-open-modal");
        const modal = id ? doc.getElementById(id) : null;
        if (modal) modal.setAttribute("data-open", "true");
      }
      const toggle = t.closest("[data-toggle-theme]");
      if (toggle)
        setTheme(toggle.getAttribute("data-toggle-theme") || undefined);
    });
  }
  return design;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The script tag body for the preview: the runtime with the library embedded. */
export function designRuntimeScript(payload: RenderPayload): string {
  const json = JSON.stringify(payload)
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `(${designRuntime.toString()})(window, ${json}, ${designCore.toString()});`;
}
