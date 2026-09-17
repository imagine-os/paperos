import { signal, type Signal } from "../signal";
import {
  FsaBackend,
  pickDirectory,
  queryPermission,
  requestPermission,
} from "./fsa-backend";
import { fetchGithubRepo, parseGithubUrl } from "./github";
import { browserKv, type KvStore } from "./kv";
import { MemoryBackend } from "./memory-backend";
import { normalizePath } from "./paths";
import { migrate } from "./migrations";
import type {
  FileEntry,
  FileMap,
  ProjectBackend,
  ProjectMeta,
  SampleTemplate,
} from "./types";
import { readZip } from "./zip";

const META_PREFIX = "p/";
const ACTIVE_KEY = "active";

interface StoredMeta extends ProjectMeta {
  /** Only for `fsa` projects: the directory handle (structured-cloneable). */
  handle?: FileSystemDirectoryHandle;
}

export type Permission = "granted" | "prompt" | "denied";

/** What changed on disk, for listeners that need more than a counter. */
export interface FileChange {
  project: string;
  path: string;
  kind: "write" | "mkdir" | "rename" | "delete";
  /** New path, for renames. */
  to?: string;
}

export interface ProjectsState {
  status: "loading" | "ready";
  projects: ProjectMeta[];
  activeId: string | null;
}

/** Live view of one project: its backend, entries and (for folders) the permission state. */
export interface ProjectSession {
  meta: ProjectMeta;
  backend: ProjectBackend | null;
  files: Signal<FileEntry[]>;
  permission: Signal<Permission>;
}

export function newProjectId(): string {
  return `prj_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The list of known projects and the active one. Metadata and memory-backed
 * files live in IndexedDB (`paperos-v2:projects`). Folder projects keep their
 * directory handle there too and ask for permission again after a reload.
 */
export class ProjectStore {
  readonly state = signal<ProjectsState>({
    status: "loading",
    projects: [],
    activeId: null,
  });
  /** Bumps whenever a file's saved content changes (write, rename, delete). */
  readonly changes = signal(0);
  /** The most recent file mutation (set right before `changes` bumps). */
  readonly lastChange = signal<FileChange | null>(null);
  private sessions = new Map<string, ProjectSession>();
  private handles = new Map<string, FileSystemDirectoryHandle>();
  private initPromise: Promise<void> | null = null;

  constructor(private readonly kv: KvStore = browserKv()) {}

  /** Loads projects; creates the sample project when there is none. Idempotent. */
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.load();
    return this.initPromise;
  }

  private async load() {
    // Schema version first: an older store is migrated before it is read.
    const report = await migrate(this.kv);
    if (report.newer)
      console.warn(
        `PaperOS: the project store is at schema ${report.to}, newer than this build (${report.from}); leaving it as is.`
      );
    const rows = await this.kv.list<StoredMeta>("meta", META_PREFIX);
    const projects: ProjectMeta[] = [];
    for (const row of rows) {
      const { handle, ...meta } = row;
      if (meta.backend === "fsa" && handle) this.handles.set(meta.id, handle);
      projects.push(meta);
    }
    projects.sort((a, b) => a.createdAt - b.createdAt);
    let activeId = (await this.kv.get<string>("meta", ACTIVE_KEY)) ?? null;
    if (!projects.some((p) => p.id === activeId))
      activeId = projects[0]?.id ?? null;
    this.state.set({ status: "ready", projects, activeId });
    if (projects.length === 0) {
      await this.createSampleProject("sample");
    } else if (activeId) {
      await this.session(activeId);
    }
  }

  // ----- reading -------------------------------------------------------------

  list(): ProjectMeta[] {
    return this.state.get().projects;
  }

  get(id: string): ProjectMeta | undefined {
    return this.list().find((p) => p.id === id);
  }

  getActiveId(): string | null {
    return this.state.get().activeId;
  }

  /** Session for a project (opening its backend on first use). */
  async session(id: string): Promise<ProjectSession | null> {
    const existing = this.sessions.get(id);
    if (existing) return existing;
    const meta = this.get(id);
    if (!meta) return null;
    const s: ProjectSession = {
      meta,
      backend: null,
      files: signal<FileEntry[]>([]),
      permission: signal<Permission>("granted"),
    };
    this.sessions.set(id, s);
    if (meta.backend === "memory") {
      const b = new MemoryBackend(this.kv, id);
      await b.load();
      s.backend = b;
      await this.refresh(id);
    } else {
      const handle = this.handles.get(id);
      if (!handle) {
        s.permission.set("denied");
      } else {
        const p = await queryPermission(handle);
        s.permission.set(p);
        if (p === "granted") {
          s.backend = new FsaBackend(handle);
          await this.refresh(id);
        }
      }
    }
    return s;
  }

  /** The session if it has been opened already (synchronous, for components). */
  peekSession(id: string | null): ProjectSession | undefined {
    return id ? this.sessions.get(id) : undefined;
  }

  /** Asks the browser again for access to a folder project (needs a user gesture). */
  async grantAccess(id: string): Promise<boolean> {
    const s = await this.session(id);
    const handle = this.handles.get(id);
    if (!s || !handle) return false;
    const p = await requestPermission(handle);
    s.permission.set(p);
    if (p !== "granted") return false;
    s.backend = new FsaBackend(handle);
    await this.refresh(id);
    return true;
  }

  async refresh(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (!s?.backend) return;
    s.files.set(await s.backend.list());
  }

  async readFile(id: string, path: string): Promise<string> {
    const s = await this.session(id);
    if (!s?.backend) throw new Error("Project is not accessible");
    return s.backend.read(normalizePath(path));
  }

  /** Synchronous read for memory projects (the preview bundler); null otherwise. */
  peekFile(id: string, path: string): string | null {
    const b = this.sessions.get(id)?.backend;
    if (b instanceof MemoryBackend) {
      const p = normalizePath(path);
      return b.has(p) ? b.snapshot()[p] : null;
    }
    return null;
  }

  // ----- writing -------------------------------------------------------------

  private async mutate(
    id: string,
    change: Omit<FileChange, "project">,
    fn: (b: ProjectBackend) => Promise<void>
  ) {
    const s = await this.session(id);
    if (!s?.backend) throw new Error("Project is not accessible");
    if (!s.backend.writable) throw new Error("Project is read-only");
    await fn(s.backend);
    await this.refresh(id);
    await this.touch(id);
    this.lastChange.set({ project: id, ...change });
    this.changes.update((n) => n + 1);
  }

  writeFile(id: string, path: string, text: string) {
    const p = normalizePath(path);
    return this.mutate(id, { path: p, kind: "write" }, (b) => b.write(p, text));
  }

  createFile(id: string, path: string, text = "") {
    return this.writeFile(id, path, text);
  }

  createFolder(id: string, path: string) {
    const p = normalizePath(path);
    return this.mutate(id, { path: p, kind: "mkdir" }, (b) => b.mkdir(p));
  }

  renameEntry(id: string, from: string, to: string) {
    const f = normalizePath(from);
    const t = normalizePath(to);
    return this.mutate(id, { path: f, to: t, kind: "rename" }, (b) =>
      b.rename(f, t)
    );
  }

  deleteEntry(id: string, path: string) {
    const p = normalizePath(path);
    return this.mutate(id, { path: p, kind: "delete" }, (b) => b.remove(p));
  }

  // ----- projects ------------------------------------------------------------

  private async saveMeta(
    meta: ProjectMeta,
    handle?: FileSystemDirectoryHandle
  ) {
    const row: StoredMeta = handle ? { ...meta, handle } : meta;
    await this.kv.set("meta", META_PREFIX + meta.id, row);
  }

  private async touch(id: string) {
    const meta = this.get(id);
    if (!meta) return;
    const next = { ...meta, updatedAt: Date.now() };
    this.state.update((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === id ? next : p)),
    }));
    const session = this.sessions.get(id);
    if (session) session.meta = next;
    await this.saveMeta(next, this.handles.get(id));
  }

  private async add(meta: ProjectMeta, handle?: FileSystemDirectoryHandle) {
    if (handle) this.handles.set(meta.id, handle);
    await this.saveMeta(meta, handle);
    this.state.update((s) => ({ ...s, projects: [...s.projects, meta] }));
    await this.setActive(meta.id);
  }

  async setActive(id: string | null): Promise<void> {
    if (id && !this.get(id)) return;
    this.state.update((s) => ({ ...s, activeId: id }));
    await this.kv.set("meta", ACTIVE_KEY, id);
    if (id) await this.session(id);
  }

  /** A browser-only project from a file map (sample, ZIP, GitHub, dropped folder). */
  async createMemoryProject(
    name: string,
    files: FileMap,
    source: string,
    options: { id?: string } = {}
  ): Promise<ProjectMeta> {
    const now = Date.now();
    const meta: ProjectMeta = {
      id: options.id ?? newProjectId(),
      name,
      backend: "memory",
      source,
      createdAt: now,
      updatedAt: now,
    };
    const backend = new MemoryBackend(this.kv, meta.id);
    await backend.seed(files);
    this.sessions.set(meta.id, {
      meta,
      backend,
      files: signal<FileEntry[]>(await backend.list()),
      permission: signal<Permission>("granted"),
    });
    await this.add(meta);
    return meta;
  }

  /**
   * The sample site, or the "Small Business SaaS" template. The templates
   * are large and load on demand (their own chunks), not with the desktop.
   */
  async createSampleProject(
    template: SampleTemplate = "sample"
  ): Promise<ProjectMeta> {
    if (template === "saas") {
      const { SAAS_NAME, saasProjectFiles } = await import("./saas");
      return this.createMemoryProject(SAAS_NAME, saasProjectFiles(), "saas");
    }
    const { SAMPLE_NAME, sampleProjectFiles } = await import("./sample");
    return this.createMemoryProject(
      SAMPLE_NAME,
      sampleProjectFiles(),
      "sample"
    );
  }

  /** File System Access API folder picker (Chromium). Null when cancelled or unsupported. */
  async openDirectory(): Promise<ProjectMeta | null> {
    const handle = await pickDirectory();
    if (!handle) return null;
    return this.addDirectory(handle);
  }

  async addDirectory(handle: FileSystemDirectoryHandle): Promise<ProjectMeta> {
    const now = Date.now();
    const meta: ProjectMeta = {
      id: newProjectId(),
      name: handle.name,
      backend: "fsa",
      source: "folder",
      createdAt: now,
      updatedAt: now,
    };
    await this.add(meta, handle);
    return meta;
  }

  async importZip(
    file: Blob,
    name: string
  ): Promise<{ meta: ProjectMeta; skipped: number }> {
    const { files, skipped } = await readZip(file);
    if (Object.keys(files).length === 0)
      throw new Error("The ZIP contains no text files.");
    const meta = await this.createMemoryProject(
      name.replace(/\.zip$/i, ""),
      files,
      "zip"
    );
    return { meta, skipped };
  }

  async importGithub(
    url: string
  ): Promise<{ meta: ProjectMeta; skipped: number }> {
    const repo = parseGithubUrl(url);
    if (!repo)
      throw new Error(
        "Not a GitHub repository URL (expected github.com/owner/repo)."
      );
    const { files, skipped } = await fetchGithubRepo(repo);
    if (Object.keys(files).length === 0)
      throw new Error("The repository contains no text files.");
    const meta = await this.createMemoryProject(
      `${repo.owner}/${repo.repo}`,
      files,
      `github:${repo.owner}/${repo.repo}`
    );
    return { meta, skipped };
  }

  async rename(id: string, name: string): Promise<void> {
    const meta = this.get(id);
    if (!meta || !name.trim()) return;
    const next = { ...meta, name: name.trim(), updatedAt: Date.now() };
    this.state.update((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === id ? next : p)),
    }));
    await this.saveMeta(next, this.handles.get(id));
  }

  /** Forgets a project (and its stored files for memory projects). */
  async remove(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s?.backend instanceof MemoryBackend) await s.backend.destroy();
    this.sessions.delete(id);
    this.handles.delete(id);
    await this.kv.delete("meta", META_PREFIX + id);
    const rest = this.list().filter((p) => p.id !== id);
    this.state.update((st) => ({ ...st, projects: rest }));
    if (this.getActiveId() === id) await this.setActive(rest[0]?.id ?? null);
    this.changes.update((n) => n + 1);
  }
}

let store: ProjectStore | null = null;

/** The app-wide project store (IndexedDB-backed, created on first use). */
export function getProjectStore(): ProjectStore {
  if (!store) store = new ProjectStore();
  return store;
}
