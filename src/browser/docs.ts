/**
 * PaperOS's own documentation, bundled as text so the Browser window shows
 * it offline (and in the static export). Loaded on demand: the chunk is only
 * fetched when a `paperos://docs/...` address is opened.
 */
import { DOC_FILES, isDocFile } from "./address";

const loaders: Record<(typeof DOC_FILES)[number], () => Promise<string>> = {
  "README.md": () => import("../../README.md?raw").then((m) => m.default),
  "docs/CANVAS_API.md": () =>
    import("../../docs/CANVAS_API.md?raw").then((m) => m.default),
  "docs/MCP.md": () => import("../../docs/MCP.md?raw").then((m) => m.default),
  "docs/PLAN.md": () => import("../../docs/PLAN.md?raw").then((m) => m.default),
  "docs/BRAND.md": () =>
    import("../../docs/BRAND.md?raw").then((m) => m.default),
};

/** The markdown of a bundled doc, or null for anything else. */
export async function loadDoc(name: string): Promise<string | null> {
  if (!isDocFile(name)) return null;
  return loaders[name]();
}

/** `docs/MCP.md` + `CANVAS_API.md` -> `docs/CANVAS_API.md`; null when the link leaves the bundled set. */
export function resolveDocLink(from: string, href: string): string | null {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return null;
  const clean = href.split("#")[0].split("?")[0];
  if (!/\.md$/i.test(clean)) return null;
  const base = from.includes("/")
    ? from.slice(0, from.lastIndexOf("/") + 1)
    : "";
  const parts = (clean.startsWith("/") ? clean.slice(1) : base + clean).split(
    "/"
  );
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  const joined = out.join("/");
  return isDocFile(joined) ? joined : null;
}

/**
 * Wraps rendered markdown in a small standalone document (system fonts,
 * light and dark via `prefers-color-scheme`) for a srcdoc iframe. Links to
 * bundled docs arrive rewritten as `paperos://docs/<file>`.
 */
export function docDocument(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;--fg:#1c1b1a;--bg:#fbfaf7;--muted:#6b6862;--line:#e6e2da;--code:#f1eee7;--accent:#6b4eff}
@media(prefers-color-scheme:dark){:root{--fg:#ece9e2;--bg:#15161a;--muted:#a09c94;--line:#2b2d33;--code:#1f2126;--accent:#a996ff}}
body{margin:0;padding:28px 32px 48px;color:var(--fg);background:var(--bg);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:860px}
h1,h2,h3{line-height:1.25;margin:1.6em 0 .5em}h1{font-size:28px;margin-top:0}h2{font-size:21px;border-bottom:1px solid var(--line);padding-bottom:.25em}h3{font-size:17px}
a{color:var(--accent)}code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:1px 5px;border-radius:4px}
pre{background:var(--code);padding:12px 14px;border-radius:8px;overflow:auto}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--code)}
blockquote{margin:0;padding:0 1em;color:var(--muted);border-left:3px solid var(--line)}hr{border:0;border-top:1px solid var(--line)}
img{max-width:100%}
</style></head><body>${bodyHtml}</body></html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
