/**
 * The DataStore's file system for a project in the browser: reads the live
 * Yjs buffers (so unsaved edits in an editor count), writes through the
 * shared documents (so editors update) and listens to document and project
 * changes. One DataStore per project, created on first use.
 */
import {
  closeFileDoc,
  docsChanged,
  readLiveText,
  writeLiveText,
} from "@/ide/docs";
import { getProjectStore, type ProjectStore } from "@/ide/project/store";
import { isDataPath } from "./schema";
import { DataStore, type DataFs } from "./store";

export function projectDataFs(
  projectId: string,
  store: ProjectStore = getProjectStore()
): DataFs {
  return {
    async list() {
      const s = await store.session(projectId);
      return (
        s?.files
          .get()
          .filter((f) => f.type === "file")
          .map((f) => f.path) ?? []
      );
    },
    read: (path) => readLiveText(projectId, path, store),
    write: (path, text) => writeLiveText(projectId, path, text, store),
    async remove(path) {
      await store.deleteEntry(projectId, path);
      closeFileDoc(projectId, path);
    },
    async rename(from, to) {
      await store.renameEntry(projectId, from, to);
      closeFileDoc(projectId, from);
    },
    onChange(listener) {
      const offDocs = docsChanged.subscribe(listener);
      const offFiles = store.lastChange.subscribe(() => {
        const c = store.lastChange.get();
        if (!c || c.project !== projectId) return;
        if (isDataPath(c.path) || (c.to && isDataPath(c.to))) listener();
      });
      return () => {
        offDocs();
        offFiles();
      };
    },
  };
}

const stores = new Map<string, DataStore>();

/** The DataStore of a project (cached). */
export function getDataStore(
  projectId: string,
  store: ProjectStore = getProjectStore()
): DataStore {
  let s = stores.get(projectId);
  if (!s) {
    s = new DataStore(projectDataFs(projectId, store));
    stores.set(projectId, s);
  }
  return s;
}
