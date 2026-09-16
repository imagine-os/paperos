import type { KvStore } from "./kv";
import { ancestors, dirname, isInside, normalizePath } from "./paths";
import type { EntryType, FileEntry, FileMap, ProjectBackend } from "./types";

interface StoredEntry {
  project: string;
  path: string;
  type: EntryType;
  text: string;
}

const fileKey = (project: string, path: string) => `${project}/${path}`;

/**
 * Files kept in memory and mirrored to the KV store (IndexedDB in the
 * browser). Works in every browser; used for the sample project, ZIP and
 * GitHub imports and dropped folders.
 */
export class MemoryBackend implements ProjectBackend {
  readonly kind = "memory" as const;
  readonly writable = true;
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  constructor(
    private readonly kv: KvStore,
    readonly projectId: string
  ) {}

  /** Loads what the KV store has for this project. */
  async load(): Promise<void> {
    const rows = await this.kv.list<StoredEntry>(
      "files",
      fileKey(this.projectId, "")
    );
    this.files.clear();
    this.dirs.clear();
    for (const r of rows) {
      if (r.type === "dir") this.dirs.add(r.path);
      else this.files.set(r.path, r.text);
    }
  }

  /** Replaces the content with `map` and persists it (import). */
  async seed(map: FileMap): Promise<void> {
    await this.kv.clear("files", fileKey(this.projectId, ""));
    this.files.clear();
    this.dirs.clear();
    for (const [raw, text] of Object.entries(map)) {
      const path = normalizePath(raw);
      if (!path) continue;
      this.files.set(path, text);
    }
    await Promise.all(
      [...this.files].map(([path, text]) =>
        this.persist({ path, type: "file", text })
      )
    );
  }

  private persist(e: Omit<StoredEntry, "project">): Promise<void> {
    return this.kv.set<StoredEntry>("files", fileKey(this.projectId, e.path), {
      project: this.projectId,
      ...e,
    });
  }

  async list(): Promise<FileEntry[]> {
    const dirs = new Set(this.dirs);
    for (const p of this.files.keys())
      for (const a of ancestors(p)) dirs.add(a);
    return [
      ...[...dirs].map((path) => ({ path, type: "dir" as const })),
      ...[...this.files.keys()].map((path) => ({
        path,
        type: "file" as const,
      })),
    ];
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  async read(path: string): Promise<string> {
    const text = this.files.get(normalizePath(path));
    if (text === undefined) throw new Error(`No such file: ${path}`);
    return text;
  }

  /** Synchronous snapshot for the preview bundler. */
  snapshot(): FileMap {
    return Object.fromEntries(this.files);
  }

  async write(path: string, text: string): Promise<void> {
    const p = normalizePath(path);
    if (!p) throw new Error("Empty path");
    this.files.set(p, text);
    this.dirs.delete(p);
    await this.persist({ path: p, type: "file", text });
  }

  async mkdir(path: string): Promise<void> {
    const p = normalizePath(path);
    if (!p || this.files.has(p)) return;
    this.dirs.add(p);
    await this.persist({ path: p, type: "dir", text: "" });
  }

  async rename(from: string, to: string): Promise<void> {
    const a = normalizePath(from);
    const b = normalizePath(to);
    if (!a || !b || a === b) return;
    const moves: [string, string, EntryType, string][] = [];
    for (const [p, text] of this.files)
      if (isInside(p, a)) moves.push([p, b + p.slice(a.length), "file", text]);
    for (const d of this.dirs)
      if (isInside(d, a)) moves.push([d, b + d.slice(a.length), "dir", ""]);
    for (const [oldPath, newPath, type, text] of moves) {
      if (type === "file") {
        this.files.delete(oldPath);
        this.files.set(newPath, text);
      } else {
        this.dirs.delete(oldPath);
        this.dirs.add(newPath);
      }
      await this.kv.delete("files", fileKey(this.projectId, oldPath));
      await this.persist({ path: newPath, type, text });
    }
    // Keep the parent of a moved-away entry from vanishing when it is now empty.
    const parent = dirname(a);
    if (parent) await this.mkdir(parent);
  }

  async remove(path: string): Promise<void> {
    const p = normalizePath(path);
    const gone: string[] = [];
    for (const f of this.files.keys()) if (isInside(f, p)) gone.push(f);
    for (const d of this.dirs) if (isInside(d, p)) gone.push(d);
    for (const g of gone) {
      this.files.delete(g);
      this.dirs.delete(g);
      await this.kv.delete("files", fileKey(this.projectId, g));
    }
  }

  /** Forgets everything stored for this project. */
  async destroy(): Promise<void> {
    await this.kv.clear("files", fileKey(this.projectId, ""));
    this.files.clear();
    this.dirs.clear();
  }
}
