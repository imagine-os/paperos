/**
 * Bookmarks are a project file, `browser/bookmarks.json`, so they travel
 * with the project and show in Files:
 *
 *   { "bookmarks": [{ "title": "Preview", "url": "paperos://preview/" }, ...] }
 *
 * Tolerant parser (bad entries are skipped), defaults for projects that have
 * no file yet. Pure.
 */
import { addressTitle, normalizeAddress } from "./address";

export const BOOKMARKS_PATH = "browser/bookmarks.json";

export interface Bookmark {
  title: string;
  url: string;
}

export const DEFAULT_BOOKMARKS: readonly Bookmark[] = [
  { title: "Preview", url: "paperos://preview/" },
  { title: "PaperOS", url: "paperos://home" },
  { title: "Canvas API docs", url: "paperos://docs/docs/CANVAS_API.md" },
  { title: "Agent bridge (MCP)", url: "paperos://docs/docs/MCP.md" },
  { title: "Legacy prototype", url: "paperos://legacy" },
  { title: "MDN", url: "https://developer.mozilla.org/" },
];

export function parseBookmarks(text: string | null | undefined): Bookmark[] {
  if (!text) return [...DEFAULT_BOOKMARKS];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null
      ? (raw as { bookmarks?: unknown }).bookmarks
      : undefined;
  if (!Array.isArray(list)) return [];
  const out: Bookmark[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      out.push({ title: addressTitle(item), url: normalizeAddress(item) });
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    const o = item as { title?: unknown; url?: unknown };
    if (typeof o.url !== "string" || !o.url.trim()) continue;
    const url = normalizeAddress(o.url);
    out.push({
      title:
        typeof o.title === "string" && o.title.trim()
          ? o.title.trim()
          : addressTitle(url),
      url,
    });
  }
  return out;
}

export function serializeBookmarks(list: readonly Bookmark[]): string {
  return JSON.stringify({ bookmarks: list }, null, 2) + "\n";
}

/** Adds or retitles a bookmark (one per URL). */
export function addBookmark(
  list: readonly Bookmark[],
  bookmark: Bookmark
): Bookmark[] {
  const url = normalizeAddress(bookmark.url);
  const title = bookmark.title.trim() || addressTitle(url);
  const i = list.findIndex((b) => b.url === url);
  if (i === -1) return [...list, { title, url }];
  return list.map((b, j) => (j === i ? { title, url } : b));
}

export function removeBookmark(
  list: readonly Bookmark[],
  url: string
): Bookmark[] {
  const u = normalizeAddress(url);
  return list.filter((b) => b.url !== u);
}

export function isBookmarked(list: readonly Bookmark[], url: string): boolean {
  const u = normalizeAddress(url);
  return list.some((b) => b.url === u);
}
