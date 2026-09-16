"use client";

import {
  getProjectStore,
  supportsFileSystemAccess,
  type ProjectMeta,
} from "@/ide/project";
import { pushConsole } from "@/ide/console-store";

/**
 * The "Open" actions shared by the top bar, the Files window and the
 * command palette. Errors go to the Console window and a dialog.
 */

function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  pushConsole("error", message);
  window.alert(message);
}

function done(meta: ProjectMeta, skipped = 0) {
  pushConsole(
    "system",
    `Opened project "${meta.name}"${skipped ? ` (${skipped} binary file${skipped === 1 ? "" : "s"} skipped)` : ""}`
  );
}

export const canOpenFolder = supportsFileSystemAccess;

export async function openFolderProject(): Promise<ProjectMeta | null> {
  try {
    const meta = await getProjectStore().openDirectory();
    if (meta) done(meta);
    return meta;
  } catch (e) {
    fail(e);
    return null;
  }
}

export async function openSampleProject(): Promise<ProjectMeta> {
  const meta = await getProjectStore().createSampleProject();
  done(meta);
  return meta;
}

/** Opens a file picker for a .zip and imports it. */
export function importZipProject(): Promise<ProjectMeta | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(await importZipFile(file));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function importZipFile(file: File): Promise<ProjectMeta | null> {
  try {
    const { meta, skipped } = await getProjectStore().importZip(
      file,
      file.name
    );
    done(meta, skipped);
    return meta;
  } catch (e) {
    fail(e);
    return null;
  }
}

export async function importGithubProject(
  url?: string
): Promise<ProjectMeta | null> {
  const input =
    url ?? window.prompt("Public GitHub repository URL", "https://github.com/");
  if (!input) return null;
  pushConsole("system", `Downloading ${input.trim()}...`);
  try {
    const { meta, skipped } = await getProjectStore().importGithub(input);
    done(meta, skipped);
    return meta;
  } catch (e) {
    fail(e);
    return null;
  }
}

/** Creates a memory project from files dropped on the canvas (folders are walked). */
export async function importDroppedItems(
  items: DataTransferItemList
): Promise<ProjectMeta | null> {
  const files: Record<string, string> = {};
  let name = "Dropped files";
  const zips: File[] = [];

  const readEntry = async (
    entry: FileSystemEntry,
    prefix: string
  ): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej)
      );
      const path = prefix + entry.name;
      if (/\.zip$/i.test(entry.name)) zips.push(file);
      else if (isTextFile(file)) files[path] = await file.text();
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: FileSystemEntry[] = [];
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
          reader.readEntries(res, rej)
        );
        if (batch.length === 0) break;
        all.push(...batch);
      }
      for (const child of all) {
        if (child.isDirectory && IGNORED.has(child.name)) continue;
        await readEntry(child, `${prefix}${entry.name}/`);
      }
    }
  };

  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (entries.length === 1 && entries[0].isDirectory) {
    name = entries[0].name;
    // Walk the folder's children so the project root is the folder itself.
    const reader = (entries[0] as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
        reader.readEntries(res, rej)
      );
      if (batch.length === 0) break;
      for (const child of batch) {
        if (child.isDirectory && IGNORED.has(child.name)) continue;
        await readEntry(child, "");
      }
    }
  } else {
    for (const e of entries) await readEntry(e, "");
  }

  if (zips.length && Object.keys(files).length === 0)
    return importZipFile(zips[0]);
  if (Object.keys(files).length === 0) {
    fail(
      new Error("Nothing importable was dropped (text files and folders only).")
    );
    return null;
  }
  const meta = await getProjectStore().createMemoryProject(name, files, "drop");
  done(meta);
  return meta;
}

const IGNORED = new Set([".git", "node_modules", ".next", "dist", "out"]);

function isTextFile(file: File): boolean {
  if (
    file.type.startsWith("text/") ||
    /json|javascript|xml|svg/.test(file.type)
  )
    return true;
  return /\.(html?|css|m?jsx?|tsx?|json|md|txt|svg|ya?ml|toml|csv|env|gitignore|sh|py|rb|go|rs|java|c|h|cpp|cs|php|sql|vue|svelte|astro|mdx)$/i.test(
    file.name
  );
}

/** True when a drag carries a folder, a zip or text files (something the IDE can import). */
export function isProjectDrop(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  const items = Array.from(dt.items ?? []);
  if (items.length === 0) return false;
  return items.some((it) => {
    const entry = it.webkitGetAsEntry?.();
    if (entry?.isDirectory) return true;
    const f = it.getAsFile();
    return !!f && (/\.zip$/i.test(f.name) || isTextFile(f));
  });
}
