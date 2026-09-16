import { basename, dirname, normalizePath } from "./paths";
import type { FileEntry, ProjectBackend } from "./types";

/** Folders never worth showing or loading. */
export const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "out",
  ".DS_Store",
]);

type PermissionMode = "read" | "readwrite";

interface HandleWithPermission extends FileSystemDirectoryHandle {
  queryPermission?(d: { mode: PermissionMode }): Promise<PermissionState>;
  requestPermission?(d: { mode: PermissionMode }): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Asks the browser for a directory. Returns null when the user cancels. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const w = window as unknown as {
    showDirectoryPicker?: (o?: {
      mode?: PermissionMode;
    }) => Promise<FileSystemDirectoryHandle>;
  };
  if (!w.showDirectoryPicker) return null;
  try {
    return await w.showDirectoryPicker({ mode: "readwrite" });
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    throw e;
  }
}

/** Current permission for a stored handle, without prompting. */
export async function queryPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  const h = handle as HandleWithPermission;
  if (!h.queryPermission) return "granted";
  try {
    return await h.queryPermission({ mode: "readwrite" });
  } catch {
    return "denied";
  }
}

/** Prompts for permission (must run from a user gesture after a reload). */
export async function requestPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  const h = handle as HandleWithPermission;
  if (!h.requestPermission) return "granted";
  try {
    return await h.requestPermission({ mode: "readwrite" });
  } catch {
    return "denied";
  }
}

/**
 * A project backed by a real folder through the File System Access API
 * (Chromium). Reads and writes go straight to disk.
 */
export class FsaBackend implements ProjectBackend {
  readonly kind = "fsa" as const;
  readonly writable = true;

  constructor(readonly root: FileSystemDirectoryHandle) {}

  private async dir(
    path: string,
    create = false
  ): Promise<FileSystemDirectoryHandle> {
    let h = this.root;
    for (const part of normalizePath(path).split("/").filter(Boolean)) {
      h = await h.getDirectoryHandle(part, { create });
    }
    return h;
  }

  async list(): Promise<FileEntry[]> {
    const out: FileEntry[] = [];
    const walk = async (
      dir: FileSystemDirectoryHandle,
      prefix: string,
      depth: number
    ) => {
      if (depth > 12) return;
      for await (const [name, handle] of (
        dir as HandleWithPermission
      ).entries()) {
        const path = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === "directory") {
          if (IGNORED_DIRS.has(name)) continue;
          out.push({ path, type: "dir" });
          await walk(handle as FileSystemDirectoryHandle, path, depth + 1);
        } else {
          out.push({ path, type: "file" });
        }
      }
    };
    await walk(this.root, "", 0);
    return out;
  }

  async read(path: string): Promise<string> {
    const dir = await this.dir(dirname(path));
    const file = await (await dir.getFileHandle(basename(path))).getFile();
    return file.text();
  }

  async write(path: string, text: string): Promise<void> {
    const dir = await this.dir(dirname(path), true);
    const handle = await dir.getFileHandle(basename(path), { create: true });
    const w = await handle.createWritable();
    await w.write(text);
    await w.close();
  }

  async mkdir(path: string): Promise<void> {
    await this.dir(path, true);
  }

  async rename(from: string, to: string): Promise<void> {
    // No native rename across the API yet: copy then delete.
    const entries = await this.list();
    const isDir = entries.some((e) => e.path === from && e.type === "dir");
    if (isDir) {
      await this.mkdir(to);
      for (const e of entries) {
        if (e.type === "file" && e.path.startsWith(from + "/")) {
          await this.write(
            to + e.path.slice(from.length),
            await this.read(e.path)
          );
        }
      }
    } else {
      await this.write(to, await this.read(from));
    }
    await this.remove(from);
  }

  async remove(path: string): Promise<void> {
    const dir = await this.dir(dirname(path));
    await dir.removeEntry(basename(path), { recursive: true });
  }
}
