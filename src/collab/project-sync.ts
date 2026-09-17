/**
 * Project files <-> Yjs. The room document holds the shared project:
 *
 *   meta   Y.Map  { projectId, projectName }
 *   files  Y.Map  path -> Y.Text (the live content of every file)
 *   dirs   Y.Map  path -> true   (empty folders)
 *
 * Every peer keeps a local project with the room's project id (a memory
 * project mirrored to IndexedDB), so file references in shared windows
 * (`{"project","path"}`) resolve everywhere. The mirror runs both ways:
 * room text changes are written to the local backend (debounced), local
 * mutations (new file, rename, delete, a write from the shell or the Data
 * window) are applied to the room. Open editors bind to the room's Y.Text
 * through `setDocSource()` in `src/ide/docs.ts`, so the room is the buffer.
 */
import * as Y from "yjs";
import type { ProjectStore } from "@/ide/project/store";
import type { FileMap } from "@/ide/project/types";
import { readLiveText } from "@/ide/docs";

export const META_KEY = "meta";
export const FILES_KEY = "files";
export const DIRS_KEY = "dirs";

/** Origin of this module's own writes to the room document. */
export const PROJECT_ORIGIN = "paperos-project";

export const MIRROR_DEBOUNCE_MS = 300;

export interface RoomProjectMeta {
  projectId: string;
  projectName: string;
}

export function roomFiles(doc: Y.Doc): Y.Map<Y.Text> {
  return doc.getMap<Y.Text>(FILES_KEY);
}

export function roomDirs(doc: Y.Doc): Y.Map<boolean> {
  return doc.getMap<boolean>(DIRS_KEY);
}

export function roomProjectMeta(doc: Y.Doc): RoomProjectMeta | null {
  const meta = doc.getMap<string>(META_KEY);
  const projectId = meta.get("projectId");
  if (!projectId) return null;
  return {
    projectId,
    projectName: meta.get("projectName") ?? "Shared project",
  };
}

/** The room's file map as plain strings (for seeding a local project). */
export function roomFileMap(doc: Y.Doc): FileMap {
  const out: FileMap = {};
  roomFiles(doc).forEach((text, path) => {
    out[path] = text.toString();
  });
  return out;
}

/** The text of one file, or null when it is not in the room. */
export function getRoomText(doc: Y.Doc, path: string): Y.Text | null {
  return roomFiles(doc).get(path) ?? null;
}

/** The Y.Text for a path, created (empty) when missing. */
export function ensureRoomText(doc: Y.Doc, path: string): Y.Text {
  const files = roomFiles(doc);
  let text = files.get(path);
  if (!text) {
    text = new Y.Text();
    doc.transact(() => files.set(path, text!), PROJECT_ORIGIN);
  }
  return text;
}

function replaceText(text: Y.Text, next: string) {
  if (text.toString() === next) return;
  text.delete(0, text.length);
  text.insert(0, next);
}

/**
 * Fills an empty room with a project: meta, every file's live text and the
 * empty folders. The creator's side of "first one in seeds the room".
 */
export async function seedRoomProject(
  doc: Y.Doc,
  store: ProjectStore,
  projectId: string
): Promise<void> {
  const meta = store.get(projectId);
  if (!meta) throw new Error(`Unknown project ${projectId}`);
  const session = await store.session(projectId);
  if (!session?.backend) throw new Error("Project is not accessible");
  const entries = await session.backend.list();
  const texts: [string, string][] = [];
  for (const e of entries) {
    if (e.type !== "file") continue;
    const t = await readLiveText(projectId, e.path, store);
    if (t !== null) texts.push([e.path, t]);
  }
  const filePaths = new Set(texts.map(([p]) => p));
  const emptyDirs = entries
    .filter((e) => e.type === "dir")
    .map((e) => e.path)
    .filter((d) => ![...filePaths].some((p) => p.startsWith(`${d}/`)));
  doc.transact(() => {
    const m = doc.getMap<string>(META_KEY);
    m.set("projectId", projectId);
    m.set("projectName", meta.name);
    const files = roomFiles(doc);
    for (const [path, text] of texts) files.set(path, new Y.Text(text));
    const dirs = roomDirs(doc);
    for (const d of emptyDirs) dirs.set(d, true);
  }, PROJECT_ORIGIN);
}

/**
 * Makes the room's project exist locally: creates a memory project with the
 * room's id when missing, otherwise writes the room's files over the local
 * copy (room wins; local-only files are removed). Returns the project id.
 */
export async function adoptRoomProject(
  doc: Y.Doc,
  store: ProjectStore
): Promise<string> {
  const meta = roomProjectMeta(doc);
  if (!meta) throw new Error("The room has no project yet");
  const files = roomFileMap(doc);
  const existing = store.get(meta.projectId);
  if (!existing) {
    await store.createMemoryProject(meta.projectName, files, "room", {
      id: meta.projectId,
    });
  } else {
    const session = await store.session(meta.projectId);
    if (!session?.backend) throw new Error("Project is not accessible");
    const local = await session.backend.list();
    for (const e of local) {
      if (e.type === "file" && !(e.path in files))
        await store.deleteEntry(meta.projectId, e.path);
    }
    for (const [path, text] of Object.entries(files)) {
      let current: string | null = null;
      try {
        current = await store.readFile(meta.projectId, path);
      } catch {
        current = null;
      }
      if (current !== text) await store.writeFile(meta.projectId, path, text);
    }
    for (const d of roomDirs(doc).keys()) {
      if (!local.some((e) => e.path === d))
        await store.createFolder(meta.projectId, d);
    }
    if (existing.name !== meta.projectName)
      await store.rename(meta.projectId, meta.projectName);
  }
  await store.setActive(meta.projectId);
  return meta.projectId;
}

/**
 * Two-way mirror between the room's files and the local project backend.
 * Returns a disposer. `debounceMs` is how long a room text change waits
 * before it is written locally (keystrokes coalesce).
 */
export function bindProject(
  doc: Y.Doc,
  store: ProjectStore,
  projectId: string,
  options: {
    debounceMs?: number;
    setTimeout?: typeof globalThis.setTimeout;
    clearTimeout?: typeof globalThis.clearTimeout;
  } = {}
): () => void {
  const debounceMs = options.debounceMs ?? MIRROR_DEBOUNCE_MS;
  const setT = options.setTimeout ?? globalThis.setTimeout;
  const clearT = options.clearTimeout ?? globalThis.clearTimeout;
  const files = roomFiles(doc);
  const dirs = roomDirs(doc);
  const pending = new Map<string, ReturnType<typeof setT>>();
  let disposed = false;
  /** Paths whose local write is this mirror's own (skip when it echoes back). */
  const echo = new Set<string>();

  const writeLocal = async (path: string) => {
    pending.delete(path);
    if (disposed) return;
    const text = files.get(path);
    if (!text) return;
    const next = text.toString();
    let current: string | null = null;
    try {
      current = await store.readFile(projectId, path);
    } catch {
      current = null;
    }
    if (current === next) return;
    echo.add(path);
    try {
      await store.writeFile(projectId, path, next);
    } catch (e) {
      console.warn(`[paperos] room -> local write failed for ${path}`, e);
    } finally {
      echo.delete(path);
    }
  };

  const schedule = (path: string) => {
    const t = pending.get(path);
    if (t) clearT(t);
    pending.set(
      path,
      setT(() => void writeLocal(path), debounceMs)
    );
  };

  // Room -> local.
  const onFiles = (
    events: Y.YEvent<Y.Map<Y.Text> | Y.Text>[],
    tx: Y.Transaction
  ) => {
    if (tx.origin === PROJECT_ORIGIN) return;
    for (const event of events) {
      if (event.target === files) {
        (event as Y.YMapEvent<Y.Text>).keysChanged.forEach((path) => {
          const change = (event as Y.YMapEvent<Y.Text>).changes.keys.get(path);
          if (change?.action === "delete") {
            const t = pending.get(path);
            if (t) clearT(t);
            pending.delete(path);
            echo.add(path);
            void store
              .deleteEntry(projectId, path)
              .catch(() => {})
              .finally(() => echo.delete(path));
          } else schedule(path);
        });
      } else {
        const path = event.path[0];
        if (typeof path === "string") schedule(path);
      }
    }
  };
  files.observeDeep(onFiles);

  const onDirs = (event: Y.YMapEvent<boolean>, tx: Y.Transaction) => {
    if (tx.origin === PROJECT_ORIGIN) return;
    event.keysChanged.forEach((path) => {
      const change = event.changes.keys.get(path);
      if (change?.action !== "delete") {
        echo.add(path);
        void store
          .createFolder(projectId, path)
          .catch(() => {})
          .finally(() => echo.delete(path));
      }
    });
  };
  dirs.observe(onDirs);

  // Local -> room.
  const offChanges = store.lastChange.subscribe(() => {
    const c = store.lastChange.get();
    if (!c || c.project !== projectId || disposed) return;
    if (echo.has(c.path)) return;
    switch (c.kind) {
      case "write":
        void (async () => {
          let next: string;
          try {
            next = await store.readFile(projectId, c.path);
          } catch {
            return;
          }
          if (disposed) return;
          doc.transact(() => {
            let text = files.get(c.path);
            if (!text) {
              text = new Y.Text();
              files.set(c.path, text);
            }
            replaceText(text, next);
            dirs.delete(c.path);
          }, PROJECT_ORIGIN);
        })();
        break;
      case "mkdir":
        doc.transact(() => {
          if (!dirs.has(c.path)) dirs.set(c.path, true);
        }, PROJECT_ORIGIN);
        break;
      case "delete":
        doc.transact(() => {
          for (const p of [...files.keys()])
            if (p === c.path || p.startsWith(`${c.path}/`)) files.delete(p);
          for (const p of [...dirs.keys()])
            if (p === c.path || p.startsWith(`${c.path}/`)) dirs.delete(p);
        }, PROJECT_ORIGIN);
        break;
      case "rename": {
        const to = c.to;
        if (!to) break;
        doc.transact(() => {
          for (const p of [...files.keys()]) {
            if (p !== c.path && !p.startsWith(`${c.path}/`)) continue;
            const text = files.get(p)!.toString();
            files.delete(p);
            files.set(to + p.slice(c.path.length), new Y.Text(text));
          }
          for (const p of [...dirs.keys()]) {
            if (p !== c.path && !p.startsWith(`${c.path}/`)) continue;
            dirs.delete(p);
            dirs.set(to + p.slice(c.path.length), true);
          }
        }, PROJECT_ORIGIN);
        break;
      }
    }
  });

  return () => {
    disposed = true;
    files.unobserveDeep(onFiles);
    dirs.unobserve(onDirs);
    offChanges();
    for (const t of pending.values()) clearT(t);
    pending.clear();
  };
}
