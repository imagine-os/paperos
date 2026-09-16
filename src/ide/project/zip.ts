import type { FileMap } from "./types";
import { IGNORED_DIRS } from "./fsa-backend";

/** Extensions treated as text. Anything else is skipped on import (M2 keeps files as strings). */
const TEXT_EXT = new Set([
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "json",
  "md",
  "markdown",
  "txt",
  "svg",
  "xml",
  "yml",
  "yaml",
  "toml",
  "csv",
  "env",
  "gitignore",
  "editorconfig",
  "prettierrc",
  "sh",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "php",
  "sql",
  "vue",
  "svelte",
  "astro",
  "mdx",
  "lock",
  "cfg",
  "ini",
  "conf",
  "txt",
  "map",
  "eslintrc",
  "npmrc",
  "nvmrc",
]);

export function isTextPath(path: string): boolean {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const i = base.lastIndexOf(".");
  if (i === -1)
    return /^(LICENSE|README|Makefile|Dockerfile|Procfile)$/i.test(base);
  return TEXT_EXT.has(base.slice(i + 1).toLowerCase());
}

export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((p) => IGNORED_DIRS.has(p));
}

/**
 * Strips the single top-level folder ZIP tools and GitHub zipballs wrap
 * everything in (`repo-main/...`) when every entry shares it.
 */
export function stripCommonRoot(map: FileMap): FileMap {
  const paths = Object.keys(map);
  if (paths.length === 0) return map;
  const first = paths[0].split("/")[0];
  if (!paths.every((p) => p.startsWith(first + "/"))) return map;
  return Object.fromEntries(
    paths.map((p) => [p.slice(first.length + 1), map[p]])
  );
}

export interface ZipImport {
  files: FileMap;
  skipped: number;
}

/** Reads text files out of a ZIP (JSZip is loaded on demand). */
export async function readZip(data: ArrayBuffer | Blob): Promise<ZipImport> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);
  const files: FileMap = {};
  let skipped = 0;
  const jobs: Promise<void>[] = [];
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    if (isIgnoredPath(path)) return;
    if (!isTextPath(path)) {
      skipped++;
      return;
    }
    jobs.push(
      entry.async("string").then((text) => {
        files[path] = text;
      })
    );
  });
  await Promise.all(jobs);
  return { files: stripCommonRoot(files), skipped };
}
