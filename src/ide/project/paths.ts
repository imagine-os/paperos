/**
 * Path helpers for project files. Paths are POSIX-style, relative to the
 * project root, with no leading slash: `src/index.js`, `README.md`.
 */

/** Collapses `.`/`..`, repeated and leading slashes. Returns "" for the root. */
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.join("/"));
}

/** Parent directory ("" for top-level entries). */
export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

/** Lower-cased extension without the dot ("" when none). */
export function extname(path: string): string {
  const base = basename(path);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i + 1).toLowerCase();
}

/**
 * Resolves `href` as written in a file at `fromPath`. Returns null for
 * absolute URLs, protocol-relative URLs, data/blob URIs and fragments, so the
 * caller leaves those untouched. Root-relative hrefs (`/style.css`) resolve
 * against the project root.
 */
export function resolveRelative(fromPath: string, href: string): string | null {
  const h = href.trim();
  if (!h || h.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith("//")) return null;
  const clean = h.split(/[?#]/)[0];
  if (clean.startsWith("/")) return normalizePath(clean);
  return joinPath(dirname(fromPath), clean);
}

/** True when `path` is `dir` itself or lives under it. */
export function isInside(path: string, dir: string): boolean {
  return dir === "" || path === dir || path.startsWith(dir + "/");
}

/** Every ancestor directory of a path, nearest last: `a/b/c.txt` -> ["a", "a/b"]. */
export function ancestors(path: string): string[] {
  const parts = path.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}
