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
      columns: { name: string; type: string; ref?: string }[];
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
    if (def) {
      for (const p of def.props)
        if (p.default !== undefined) out[p.name] = p.default;
      const v = variant || (props && (props as any).variant);
      if (v) {
        const found = def.variants.find((x) => x.name === v);
        if (found) Object.assign(out, found.props);
        out.variant = v;
      }
    }
    if (props)
      for (const k of Object.keys(props))
        if (props[k] !== undefined && props[k] !== "") out[k] = props[k];
        else if (!(k in out)) out[k] = props[k];
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
 * messages for the Preview window.
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

  const design = {
    render: api.render,
    template: api.template,
    resolveProps: api.resolveProps,
    components: () => (payload.components || []).map((c) => c.name),
    routes: payload.routes || {},
    hydrate,
    navigate,
    autoHydrate: true,
  };
  win.paperos = win.paperos || {};
  win.paperos.design = design;

  if (doc && typeof doc.addEventListener === "function") {
    const run = () => {
      if (design.autoHydrate !== false) hydrate();
    };
    if (doc.readyState === "loading")
      doc.addEventListener("DOMContentLoaded", run);
    else run();
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
    // Tabs and modals need a little behavior.
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
