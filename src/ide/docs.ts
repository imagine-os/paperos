/**
 * One shared document per file.
 *
 * Every open file has a `Y.Doc` keyed by project id + path. The editor binds
 * to its `Y.Text` through y-codemirror.next, the preview and markdown windows
 * read the same text, and `y-indexeddb` keeps unsaved buffers across reloads.
 * "Saved" means the text matches what the project backend holds; Save writes
 * the buffer back to the backend.
 *
 * To make a file collaborative later (M4), attach a sync provider in
 * `attachProvider()`: it is called once per document after local persistence
 * has loaded, and receives the doc and its key. No other code needs to change.
 */
import * as Y from "yjs";
import { signal, type Signal } from "./signal";
import { getProjectStore, type ProjectStore } from "./project/store";

export interface FileDoc {
  key: string;
  projectId: string;
  path: string;
  doc: Y.Doc;
  text: Y.Text;
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

  const doc = new Y.Doc();
  const text = doc.getText("content");
  const dirty = signal(false);
  const error = signal<string | null>(null);
  let saved: string | null = null;
  let loaded = false;

  const refreshDirty = () =>
    dirty.set(saved !== null && text.toString() !== saved);

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

  const ready = (async () => {
    const dispose = await persist(doc, key);
    disposers.set(key, [dispose]);
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

  doc.on("update", () => {
    refreshDirty();
    docsChanged.update((n) => n + 1);
  });

  const fileDoc: FileDoc = {
    key,
    projectId,
    path,
    doc,
    text,
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
      if (text.toString() !== backend) {
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
  d.doc.destroy();
}
