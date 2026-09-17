/**
 * What the project shell needs from a file system: a flat list of entries
 * and five operations. `project-shell-fs.ts` binds it to the project store
 * in the browser; tests and the fake Canvas API host use a Map.
 */
export interface ShellEntry {
  path: string;
  type: "file" | "dir";
}

export interface ShellFs {
  entries(): ShellEntry[];
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** Character count of a file when known synchronously (for `ls -l`). */
  size?(path: string): number | null;
}

/** A Map-backed file system (null values are directories). */
export function memoryShellFs(
  initial: Record<string, string | null> = {}
): ShellFs & { files: Map<string, string | null> } {
  const files = new Map(Object.entries(initial));
  const dirsOf = (path: string) => {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      if (!files.has(dir)) files.set(dir, null);
    }
  };
  return {
    files,
    entries() {
      const seen = new Map<string, ShellEntry>();
      for (const [path, text] of files) {
        seen.set(path, { path, type: text === null ? "dir" : "file" });
        const parts = path.split("/");
        for (let i = 1; i < parts.length; i++) {
          const dir = parts.slice(0, i).join("/");
          if (!seen.has(dir)) seen.set(dir, { path: dir, type: "dir" });
        }
      }
      return [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
    },
    async read(path) {
      const t = files.get(path);
      return t === undefined || t === null ? null : t;
    },
    async write(path, text) {
      dirsOf(path);
      files.set(path, text);
    },
    async mkdir(path) {
      dirsOf(path);
      files.set(path, null);
    },
    async remove(path) {
      for (const key of [...files.keys()])
        if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    },
    size(path) {
      const t = files.get(path);
      return typeof t === "string" ? t.length : null;
    },
    async rename(from, to) {
      for (const [key, value] of [...files]) {
        if (key === from || key.startsWith(`${from}/`)) {
          files.delete(key);
          files.set(to + key.slice(from.length), value);
        }
      }
      dirsOf(to);
    },
  };
}
