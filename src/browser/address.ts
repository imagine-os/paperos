/**
 * Addresses the Browser window understands. Besides http(s) URLs there are
 * first-class internal targets written as `paperos://` URLs:
 *
 *   paperos://preview/<entry>   the project preview (index.html, pages/home.json?tenant=2)
 *   paperos://docs/<file>       PaperOS's own docs (README.md, docs/CANVAS_API.md)
 *   paperos://legacy            the 2025 prototype
 *   paperos://home              the PaperOS landing page
 *   about:blank                 an empty tab
 *
 * Pure: no DOM, no fetches.
 */

export type BrowserTarget =
  | { type: "http"; url: string }
  | { type: "preview"; entry: string }
  | { type: "docs"; doc: string }
  | { type: "legacy" }
  | { type: "home" }
  | { type: "blank" };

export const INTERNAL_SCHEME = "paperos://";
export const BLANK_ADDRESS = "about:blank";
export const HOME_ADDRESS = "paperos://home";
export const DEFAULT_PREVIEW_ADDRESS = "paperos://preview/";

/** Bundled documentation the `docs` target can show, in menu order. */
export const DOC_FILES = [
  "README.md",
  "docs/CANVAS_API.md",
  "docs/MCP.md",
  "docs/PLAN.md",
  "docs/BRAND.md",
] as const;

export type DocFile = (typeof DOC_FILES)[number];

export function isDocFile(name: string): name is DocFile {
  return (DOC_FILES as readonly string[]).includes(name);
}

const HOST_RE =
  /^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?([/?#].*)?$/i;

/** Turns what the user typed into a target. Never throws; unknown input becomes a search-free https URL or blank. */
export function parseAddress(raw: string): BrowserTarget {
  const input = raw.trim();
  if (!input || input === BLANK_ADDRESS) return { type: "blank" };

  if (input.toLowerCase().startsWith(INTERNAL_SCHEME)) {
    const rest = input.slice(INTERNAL_SCHEME.length);
    const slash = rest.indexOf("/");
    const name = (slash === -1 ? rest : rest.slice(0, slash)).toLowerCase();
    const tail = slash === -1 ? "" : rest.slice(slash + 1);
    switch (name) {
      case "preview":
        return { type: "preview", entry: tail.replace(/^\/+/, "") };
      case "docs": {
        const doc = tail.replace(/^\/+/, "") || "README.md";
        return { type: "docs", doc };
      }
      case "legacy":
        return { type: "legacy" };
      case "home":
      case "":
        return { type: "home" };
      default:
        // `paperos://index.html` reads as a preview entry.
        return { type: "preview", entry: rest.replace(/^\/+/, "") };
    }
  }

  if (/^https?:\/\//i.test(input)) return { type: "http", url: input };
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(input)) {
    // Another scheme (ftp:, mailto:, javascript:): not something to embed.
    return { type: "blank" };
  }
  if (HOST_RE.test(input)) {
    const scheme = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.)/i.test(
      input
    )
      ? "http"
      : "https";
    return { type: "http", url: `${scheme}://${input}` };
  }
  // A project path typed on its own previews that file.
  if (/^\/?[\w.@-]+(\/[\w.@-]+)*(\.html?|\.json)(\?.*)?$/i.test(input)) {
    return { type: "preview", entry: input.replace(/^\/+/, "") };
  }
  return { type: "blank" };
}

/** The canonical text of a target (what the address bar shows). */
export function formatAddress(target: BrowserTarget): string {
  switch (target.type) {
    case "http":
      return target.url;
    case "preview":
      return `${INTERNAL_SCHEME}preview/${target.entry}`;
    case "docs":
      return `${INTERNAL_SCHEME}docs/${target.doc}`;
    case "legacy":
      return `${INTERNAL_SCHEME}legacy`;
    case "home":
      return HOME_ADDRESS;
    case "blank":
      return BLANK_ADDRESS;
  }
}

/** parse + format: the normalized form of an address. */
export function normalizeAddress(raw: string): string {
  return formatAddress(parseAddress(raw));
}

export function isInternalAddress(raw: string): boolean {
  return parseAddress(raw).type !== "http";
}

/** A short title for a tab before the page says otherwise. */
export function addressTitle(raw: string): string {
  const t = parseAddress(raw);
  switch (t.type) {
    case "http":
      return hostOf(t.url) || t.url;
    case "preview":
      return t.entry ? `Preview: ${t.entry.split("?")[0]}` : "Preview";
    case "docs":
      return t.doc.replace(/^docs\//, "");
    case "legacy":
      return "Legacy prototype";
    case "home":
      return "PaperOS";
    case "blank":
      return "New tab";
  }
}

/** Host name of an http(s) URL without a leading `www.`; "" when unparsable. */
export function hostOf(url: string): string {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(url);
  return m ? m[1].toLowerCase().replace(/^www\./, "") : "";
}
