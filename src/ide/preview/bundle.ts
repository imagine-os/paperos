/**
 * Builds a self-contained HTML document from project files so it can run in
 * a sandboxed iframe via `srcdoc`, with no server and no service worker.
 *
 * Relative `<link rel=stylesheet href>` and `<script src>` become inline
 * `<style>` / `<script>`; `url()` references inside CSS and `src` of images
 * pointing at project files become data URIs when the file is text (SVG);
 * everything external is left as is. A console bridge is injected first so
 * the Console window sees logs and errors and can run snippets, and when the
 * project has `data/schema.json` the `paperos.data` runtime follows it with
 * the tables embedded (see `src/data/runtime.ts`).
 */
import { dataRuntimeScript } from "@/data/runtime";
import { parseRows, parseSchema, SCHEMA_PATH, tablePath } from "@/data/schema";
import { extname, resolveRelative } from "../project/paths";

export type ReadFile = (path: string) => string | null | Promise<string | null>;

export interface BundleResult {
  html: string;
  /** Project files the document pulled in (used to pick the refresh trigger). */
  deps: string[];
  /** Relative references that pointed at files that do not exist. */
  missing: string[];
}

const MIME: Record<string, string> = {
  svg: "image/svg+xml",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  html: "text/html",
  txt: "text/plain",
};

/** Runs inside the iframe: forwards console output and errors, runs snippets. */
export const CONSOLE_BRIDGE = `(function () {
  var post = function (level, args) {
    try {
      parent.postMessage({ source: "paperos-preview", type: "console", level: level, args: args.map(fmt) }, "*");
    } catch (e) {}
  };
  var fmt = function (v) {
    try {
      if (v instanceof Error) return v.stack || String(v);
      if (typeof v === "string") return v;
      if (v && v.nodeType === 1) return "<" + v.tagName.toLowerCase() + ">";
      return JSON.stringify(v, function (k, x) { return typeof x === "function" ? "[Function]" : x; }, 2);
    } catch (e) { return String(v); }
  };
  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      post(level, args);
      orig && orig.apply(console, args);
    };
  });
  window.addEventListener("error", function (e) {
    post("error", [e.message + (e.filename ? " (" + e.filename + ":" + e.lineno + ")" : "")]);
  });
  window.addEventListener("unhandledrejection", function (e) {
    post("error", ["Unhandled promise rejection: " + fmt(e.reason)]);
  });
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.source !== "paperos-console" || d.type !== "eval") return;
    try {
      var r = (0, eval)(d.code);
      post("result", [r === undefined ? "undefined" : fmt(r)]);
    } catch (err) {
      post("error", [fmt(err)]);
    }
  });
  parent.postMessage({ source: "paperos-preview", type: "ready" }, "*");
})();`;

function escapeClose(tag: string, code: string): string {
  return code.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

/** Picks the entry document: `index.html` at the root, else the first .html file. */
export function pickEntry(paths: string[]): string | null {
  if (paths.includes("index.html")) return "index.html";
  const html = paths.filter(
    (p) => extname(p) === "html" || extname(p) === "htm"
  );
  html.sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );
  return html[0] ?? null;
}

async function inlineCss(
  css: string,
  cssPath: string,
  read: ReadFile,
  deps: string[],
  missing: string[],
  depth: number
): Promise<string> {
  if (depth > 4) return css;
  // @import "x.css"; / @import url(x.css);
  let out = "";
  let last = 0;
  const importRe = /@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?\s*;/g;
  for (const m of css.matchAll(importRe)) {
    const target = resolveRelative(cssPath, m[1]);
    out += css.slice(last, m.index);
    last = m.index! + m[0].length;
    if (target && extname(target) === "css") {
      const t = await read(target);
      if (t !== null) {
        deps.push(target);
        out += await inlineCss(t, target, read, deps, missing, depth + 1);
        continue;
      }
      missing.push(target);
    }
    out += m[0];
  }
  out += css.slice(last);
  // Pull url() targets into the cache so the replacement below can be synchronous.
  for (const m of out.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const target = resolveRelative(cssPath, m[1]);
    if (target) await read(target);
  }
  return out.replace(
    /url\(\s*["']?([^"')]+)["']?\s*\)/g,
    (whole, ref: string) => {
      const target = resolveRelative(cssPath, ref);
      if (!target) return whole;
      const data = dataUri(target, read, deps);
      return data ? `url("${data}")` : whole;
    }
  );
}

const syncCache = new WeakMap<object, Map<string, string | null>>();

/** Data URI for a text asset when it can be read synchronously (a cache filled by `bundle`). */
function dataUri(path: string, read: ReadFile, deps: string[]): string | null {
  const cache = syncCache.get(read);
  const text = cache?.get(path);
  if (text === undefined || text === null) return null;
  deps.push(path);
  const mime = MIME[extname(path)] ?? "text/plain";
  return `data:${mime};base64,${toBase64(text)}`;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** The `paperos.data` runtime with the project's tables, or null without a schema. */
async function dataScript(
  read: ReadFile,
  deps: string[]
): Promise<string | null> {
  const schemaText = await read(SCHEMA_PATH);
  if (schemaText === null) return null;
  deps.push(SCHEMA_PATH);
  const { schema } = parseSchema(schemaText);
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of schema.tables) {
    const text = await read(tablePath(t.name));
    if (text !== null) deps.push(tablePath(t.name));
    tables[t.name] = text === null ? [] : parseRows(text).rows;
  }
  return dataRuntimeScript({
    schema: {
      tables: schema.tables.map((t) => ({
        name: t.name,
        primaryKey: t.primaryKey,
        display: t.display,
        columns: t.columns.map((c) => ({
          name: c.name,
          type: c.type,
          ref: c.ref,
        })),
      })),
    },
    tables,
  });
}

/**
 * Produces the srcdoc for `entry`. `read` returns a file's current text (the
 * live editor buffer or the backend) or null when it does not exist.
 */
export async function bundle(
  entry: string,
  read: ReadFile
): Promise<BundleResult> {
  const deps: string[] = [entry];
  const missing: string[] = [];
  const cache = new Map<string, string | null>();
  const cached: ReadFile = async (p) => {
    if (!cache.has(p)) cache.set(p, await read(p));
    return cache.get(p)!;
  };
  syncCache.set(cached, cache);

  let html =
    (await cached(entry)) ?? `<!doctype html><p>No such file: ${entry}</p>`;

  // Preload every relative asset once so the CSS pass can resolve url() synchronously.
  const assetRe = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(assetRe)) {
    const target = resolveRelative(entry, m[1]);
    if (target) await cached(target);
  }

  // <link rel="stylesheet" href="...">
  const linkRe = /<link\b[^>]*?>/gi;
  const links = [...html.matchAll(linkRe)];
  for (const m of links.reverse()) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const target = href ? resolveRelative(entry, href) : null;
    if (!target) continue;
    const css = await cached(target);
    if (css === null) {
      missing.push(target);
      continue;
    }
    deps.push(target);
    const inlined = await inlineCss(css, target, cached, deps, missing, 0);
    html =
      html.slice(0, m.index) +
      `<style data-src="${target}">\n${escapeClose("style", inlined)}\n</style>` +
      html.slice(m.index! + tag.length);
  }

  // <script src="..."></script>
  const scriptRe =
    /<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi;
  const scripts = [...html.matchAll(scriptRe)];
  for (const m of scripts.reverse()) {
    const target = resolveRelative(entry, m[2]);
    if (!target) continue;
    const js = await cached(target);
    if (js === null) {
      missing.push(target);
      continue;
    }
    deps.push(target);
    const attrs = `${m[1]}${m[3]}`.replace(/\s+/g, " ").trim();
    const open = `<script${attrs ? " " + attrs : ""} data-src="${target}">`;
    html =
      html.slice(0, m.index) +
      `${open}\n${escapeClose("script", js)}\n</script>` +
      html.slice(m.index! + m[0].length);
  }

  // <img src="x.svg"> and similar: text assets become data URIs.
  html = html.replace(
    /(<(?:img|source|video|audio|iframe)\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
    (whole, pre, ref, post) => {
      const target = resolveRelative(entry, ref);
      if (!target) return whole;
      const data = dataUri(target, cached, deps);
      return data ? `${pre}${data}${post}` : whole;
    }
  );

  let bridge = `<script data-paperos="bridge">${CONSOLE_BRIDGE}</script>`;
  const data = await dataScript(cached, deps);
  if (data) bridge += `\n<script data-paperos="data">${data}</script>`;
  if (/<head[^>]*>/i.test(html))
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${bridge}`);
  else if (/<html[^>]*>/i.test(html))
    html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${bridge}</head>`);
  else html = `${bridge}\n${html}`;

  return { html, deps: [...new Set(deps)], missing: [...new Set(missing)] };
}
