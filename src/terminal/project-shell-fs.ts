/**
 * The project shell's file system in the browser: the active project's
 * entries and the live Yjs buffers, so `cat` sees unsaved edits and
 * `echo > file` updates open editors (the same path the Data window and the
 * Canvas API take).
 */
import {
  closeFileDoc,
  peekLiveText,
  readLiveText,
  writeLiveText,
} from "@/ide/docs";
import { getProjectStore, type ProjectStore } from "@/ide/project/store";
import type { ShellFs } from "./fs";

export function projectShellFs(
  project: string,
  store: ProjectStore = getProjectStore()
): ShellFs {
  return {
    entries() {
      const s = store.peekSession(project);
      return s
        ? s.files.get().map((f) => ({ path: f.path, type: f.type }))
        : [];
    },
    read: (path) => readLiveText(project, path, store),
    write: (path, text) => writeLiveText(project, path, text, store),
    mkdir: (path) => store.createFolder(project, path),
    async remove(path) {
      closeFileDoc(project, path);
      await store.deleteEntry(project, path);
    },
    async rename(from, to) {
      closeFileDoc(project, from);
      await store.renameEntry(project, from, to);
    },
    size(path) {
      const live = peekLiveText(project, path);
      if (live !== null) return live.length;
      const text = store.peekFile(project, path);
      return text === null ? null : text.length;
    },
  };
}
