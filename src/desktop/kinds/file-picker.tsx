"use client";

import { useEffect, useState } from "react";
import { getProjectStore, type FileEntry } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import { fileIcon } from "./files";

/** A flat list of the active project's files, for windows opened without a file. */
export function FilePicker({
  label,
  filter,
  onPick,
}: {
  label: string;
  filter?: (path: string) => boolean;
  onPick: (project: string, path: string) => void;
}) {
  const store = getProjectStore();
  const state = useSignal(store.state);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const project = state.activeId;

  useEffect(() => {
    store.init();
    if (!project) return;
    let off = () => {};
    let cancelled = false;
    store.session(project).then((s) => {
      if (!s || cancelled) return;
      const sync = () => setFiles(s.files.get());
      sync();
      off = s.files.subscribe(sync);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store, project]);

  const list = files.filter(
    (f) => f.type === "file" && (!filter || filter(f.path))
  );

  return (
    <div className="pos-picker">
      <p className="pos-picker__label">{label}</p>
      {!project && <p className="pos-files__hint">No project is open.</p>}
      <div className="pos-picker__list">
        {list.map((f) => (
          <button
            key={f.path}
            type="button"
            className="pos-files__row pos-files__row--file"
            onClick={() => project && onPick(project, f.path)}
          >
            <span className="pos-files__icon" aria-hidden="true">
              {fileIcon(f.path)}
            </span>
            <span className="pos-files__name">{f.path}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
