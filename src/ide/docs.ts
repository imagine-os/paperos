/**
 * One shared document per file.
 *
 * Every open file has a `Y.Doc` keyed by project id + path. The editor binds
 * to its `Y.Text` through y-codemirror.next, the preview and markdown windows
 * read the same text, and `y-indexeddb` keeps unsaved buffers across reloads.
 * "Saved" means the text matches what the project backend holds; Save writes
 * the buffer back to the backend.
 *
 * Two hooks make files collaborative (M8, `src/collab/`): `attachProvider()`
 * is called once per document after local persistence has loaded, and
 * `setDocSource()` lets a room hand out the shared `Y.Text` of a file so the
 * editor, the preview and the Data window all work on the room's copy. A
 * shared document is never dirty: the room mirror writes the backend.
 */
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { signal, type Signal } from "./signal";
import { getProjectStore, type ProjectStore } from "./project/store";

export interface FileDoc {
  key: string;
  projectId: string;
  path: string;
  doc: Y.Doc;
  text: Y.Text;
  /** The text comes from a room (`setDocSource`): shared with other peers, saved by the mirror. */
  shared: boolean;
  /** The room's awareness (remote cursors), when shared. */
  awareness: Awareness | null;
  /** Resolves once persistence has loaded and the backend content is in place. */
  ready: Promise<void>;
  /** True once `ready` resolved: before that the buffer may still be empty. */
  loaded: boolean;
  /** Buffer differs from what the backend holds. */
  dirty: Signal<boolean>;
  /** Backend read failed (missing file, no permission). */
  error: Signal<string | null>;
  save(): Promise<void>;
  /** Re-reads the backend and replaces the buffer when they differ (after external edits). */
  reload(): Promise<void>;
}

export type ProviderHook = (doc: Y.Doc, key: string) => (() => void) | void;

let providerHook: ProviderHook | null = null;

/**
 * Hook for a sync provider (y-websocket, Liveblocks Yjs, tldraw sync...).
 * Called for every document after local persistence is loaded; return a
 * disposer to be called when the document is destroyed.
 */
export function attachProvider(hook: ProviderHook | null): void {
  providerHook = hook;
}

/** Where a shared document comes from: a room's Y.Text for that file, or null for a local document. */
export type DocSource = (
  projectId: string,
  path: string
) => { doc: Y.Doc; text: Y.Text; awareness?: Awareness | null } | null;

let docSource: DocSource | null = null;

/** Installs (or removes) the source of shared documents; call `resetFileDocs()` after. */
export function setDocSource(source: DocSource | null): void {
  docSource = source;
}

/** Bumps when open documents were reset (editors rebind to the new documents). */
export const docsGeneration = signal(0);

/**
 * Closes every open document (of one project, or all) so the next
 * `getFileDoc` creates them again, from the room or locally. Windows that
 * hold a document watch `docsGeneration` and rebind.
 */
export function resetFileDocs(projectId?: string): void {
  for (const d of [...docs.values()]) {
    if (projectId && d.projectId !== projectId) continue;
    closeFileDoc(d.projectId, d.path);
  }
  docsGeneration.update((n) => n + 1);
}

export function docKey(projectId: string, path: string): string {
  return `paperos-v2:doc:${projectId}:${path}`;
}

/** Bumps whenever any open document's text changes (the preview listens). */
export const docsChanged = signal(0);

const docs = new Map<string, FileDoc>();
const disposers = new Map<string, (() => void)[]>();

async function persist(doc: Y.Doc, key: string): Promise<() => void> {
  if (typeof indexedDB === "undefined") return () => {};
  try {
    const { IndexeddbPersistence } = await import("y-indexeddb");
    const p = new IndexeddbPersistence(key, doc);
    await p.whenSynced;
    return () => void p.destroy();
  } catch {
    return () => {};
  }
}

/** The document for a file, created (and loaded) on first use. */
export function getFileDoc(
  projectId: string,
  path: string,
  store: ProjectStore = getProjectStore()
): FileDoc {
  const key = docKey(projectId, path);
  const existing = docs.get(key);
  if (existing) return existing;

  const source = docSource?.(projectId, path) ?? null;
  const doc = source?.doc ?? new Y.Doc();
  const text = source?.text ?? doc.getText("content");
  const shared = source !== null;
  const dirty = signal(false);
  const error = signal<string | null>(null);
  let saved: string | null = null;
  let loaded = false;

  const refreshDirty = () =>
    dirty.set(!shared && saved !== null && text.toString() !== saved);

  const readBackend = async (): Promise<string | null> => {
    try {
      const t = await store.readFile(projectId, path);
      error.set(null);
      return t;
    } catch (e) {
      error.set(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const onText = () => {
    refreshDirty();
    docsChanged.update((n) => n + 1);
  };
  text.observe(onText);
  disposers.set(key, [() => text.unobserve(onText)]);

  const ready = (async () => {
    const dispose = shared ? () => {} : await persist(doc, key);
    disposers.get(key)?.push(dispose);
    const backend = await readBackend();
    if (backend !== null) {
      saved = backend;
      // A fresh document takes the backend content; a persisted buffer wins otherwise.
      if (text.length === 0 && backend.length > 0) text.insert(0, backend);
    }
    refreshDirty();
    loaded = true;
    const off = providerHook?.(doc, key);
    if (off) disposers.get(key)?.push(off);
  })();

  const fileDoc: FileDoc = {
    key,
    projectId,
    path,
    doc,
    text,
    shared,
    awareness: source?.awareness ?? null,
    ready,
    get loaded() {
      return loaded;
    },
    dirty,
    error,
    async save() {
      await ready;
      const content = text.toString();
      await store.writeFile(projectId, path, content);
      saved = content;
      refreshDirty();
    },
    async reload() {
      await ready;
      const backend = await readBackend();
      if (backend === null) return;
      saved = backend;
      // Shared: the room is the buffer; the backend follows it, not the other way round.
      if (!shared && text.toString() !== backend) {
        doc.transact(() => {
          text.delete(0, text.length);
          text.insert(0, backend);
        });
      }
      refreshDirty();
    },
  };
  docs.set(key, fileDoc);
  return fileDoc;
}

/** The live text of a file when its document is open and loaded, else null. */
export function peekLiveText(projectId: string, path: string): string | null {
  const d = docs.get(docKey(projectId, path));
  return d && d.loaded ? d.text.toString() : null;
}

/** Current text of a file: the open buffer when there is one, else the backend. */
export async function readLiveText(
  projectId: string,
  path: string,
  store: ProjectStore = getProjectStore()
): Promise<string | null> {
  const live = peekLiveText(projectId, path);
  if (live !== null) return live;
  try {
    return await store.readFile(projectId, path);
  } catch {
    return null;
  }
}

/**
 * Replaces a file's content through its shared document (open editors
 * update) and saves it. Creates the file when it does not exist yet.
 */
export async function writeLiveText(
  projectId: string,
  path: string,
  text: string,
  store: ProjectStore = getProjectStore()
): Promise<void> {
  const doc = getFileDoc(projectId, path, store);
  await doc.ready;
  if (doc.error.get()) {
    await store.createFile(projectId, path, "");
    await doc.reload();
  }
  if (doc.text.toString() !== text) {
    doc.doc.transact(() => {
      doc.text.delete(0, doc.text.length);
      doc.text.insert(0, text);
    });
  }
  await doc.save();
}

/** Open documents of a project that have unsaved changes. */
export function dirtyDocs(projectId?: string): FileDoc[] {
  return [...docs.values()].filter(
    (d) => (!projectId || d.projectId === projectId) && d.dirty.get()
  );
}

/** Drops a document (after a rename or delete). */
export function closeFileDoc(projectId: string, path: string): void {
  const key = docKey(projectId, path);
  const d = docs.get(key);
  if (!d) return;
  disposers.get(key)?.forEach((f) => f());
  disposers.delete(key);
  docs.delete(key);
  if (!d.shared) d.doc.destroy();
}

/**
 * Deletes the y-indexeddb databases of a project's local documents (best
 * effort, Chromium has `indexedDB.databases()`), so a project that was
 * shared in a room does not come back with stale buffers afterwards.
 */
export async function clearFileDocStorage(projectId: string): Promise<void> {
  try {
    const idb = globalThis.indexedDB as
      | (IDBFactory & { databases?: () => Promise<{ name?: string }[]> })
      | undefined;
    if (!idb?.databases) return;
    const prefix = docKey(projectId, "");
    for (const db of await idb.databases()) {
      if (db.name?.startsWith(prefix)) idb.deleteDatabase(db.name);
    }
  } catch {
    // Storage blocked or unsupported: nothing to clear.
  }
}
