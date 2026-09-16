"use client";

import { useEffect, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { getFileDoc, type FileDoc } from "@/ide/docs";
import type { EditorHandle } from "@/ide/editor/create-editor";
import { formatterFor } from "@/ide/editor/format";
import { encodeFileRef, parseFileRef } from "@/ide/file-ref";
import { fileWindowTitle } from "@/ide/open-file";
import { pushConsole } from "@/ide/console-store";
import { getProjectStore } from "@/ide/project";
import { resolvedTheme } from "@/ide/theme";
import { useSignal } from "@/ide/use-signal";
import type { WindowKindProps } from "../window-kinds";
import { FilePicker } from "./file-picker";

/** CodeMirror 6 bound to the file's shared document. One file per window. */
export function EditorWindow({ shape, update }: WindowKindProps) {
  const ref = parseFileRef(shape.props.content);
  if (!ref) {
    return (
      <div
        className="pos-editor pos-editor--empty"
        onPointerDown={stopEventPropagation}
      >
        <FilePicker
          label="Open a file from the Files window, or pick one:"
          onPick={(project, path) =>
            update({
              content: encodeFileRef({ project, path }),
              title: fileWindowTitle(path),
            })
          }
        />
      </div>
    );
  }
  return (
    <BoundEditor
      key={ref.project + ":" + ref.path}
      project={ref.project}
      path={ref.path}
      update={update}
    />
  );
}

function BoundEditor({
  project,
  path,
  update,
}: {
  project: string;
  path: string;
  update: WindowKindProps["update"];
}) {
  const host = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<FileDoc | null>(null);
  const [handle, setHandle] = useState<EditorHandle | null>(null);
  const [status, setStatus] = useState<string>("Loading...");
  const theme = useSignal(resolvedTheme);
  const dirty = useSignal(doc?.dirty ?? FALSE);
  const error = useSignal(doc?.error ?? NONE);
  const projectName = useSignal(getProjectStore().state).projects.find(
    (p) => p.id === project
  )?.name;

  const save = async () => {
    if (!doc) return;
    try {
      await doc.save();
      setStatus("Saved");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setStatus(m);
      pushConsole("error", `Save failed: ${m}`);
    }
  };

  const format = async () => {
    if (!doc || !handle) return;
    try {
      const { formatSource } = await import("@/ide/editor/format");
      const next = await formatSource(path, doc.text.toString());
      if (next !== doc.text.toString()) {
        doc.doc.transact(() => {
          doc.text.delete(0, doc.text.length);
          doc.text.insert(0, next);
        });
      }
      setStatus("Formatted");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setStatus(m.split("\n")[0]);
      pushConsole("error", `Format failed: ${m}`);
    }
  };

  const saveRef = useRef(save);
  const formatRef = useRef(format);
  saveRef.current = save;
  formatRef.current = format;

  useEffect(() => {
    let disposed = false;
    let created: EditorHandle | null = null;
    const d = getFileDoc(project, path);
    setDoc(d);
    (async () => {
      await d.ready;
      if (disposed || !host.current) return;
      const { createEditor } = await import("@/ide/editor/create-editor");
      if (disposed || !host.current) return;
      created = await createEditor({
        parent: host.current,
        text: d.text,
        path,
        dark: resolvedTheme.get() === "dark",
        onSave: () => void saveRef.current(),
        onFormat: () => void formatRef.current(),
      });
      if (disposed) {
        created.destroy();
        return;
      }
      setHandle(created);
      setStatus("");
    })();
    return () => {
      disposed = true;
      created?.destroy();
      setHandle(null);
    };
  }, [project, path]);

  useEffect(() => {
    handle?.setDark(theme === "dark");
  }, [handle, theme]);

  useEffect(() => {
    update({ title: fileWindowTitle(path, dirty) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, path]);

  const canFormat = formatterFor(path) !== null;

  return (
    <div
      className="pos-editor"
      data-testid="editor-window"
      data-dirty={dirty}
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <span
          className="pos-toolbar__path"
          title={`${projectName ?? project} / ${path}`}
        >
          {projectName && (
            <span className="pos-toolbar__muted">{projectName} / </span>
          )}
          {path}
        </span>
        <span className="pos-toolbar__status">{error ?? status}</span>
        <button
          type="button"
          className="pos-button pos-button--small"
          disabled={!dirty}
          title="Save (Ctrl+S)"
          data-testid="editor-save"
          onClick={save}
        >
          Save
        </button>
        <button
          type="button"
          className="pos-button pos-button--small"
          disabled={!handle || !canFormat}
          title={
            canFormat
              ? "Format with Prettier (Shift+Alt+F)"
              : "No formatter for this file type"
          }
          onClick={format}
        >
          Format
        </button>
      </div>
      <div ref={host} className="pos-editor__host" data-testid="editor-host" />
    </div>
  );
}

const FALSE = {
  get: () => false,
  set() {},
  update() {},
  subscribe: () => () => {},
} as const;
const NONE = {
  get: () => null,
  set() {},
  update() {},
  subscribe: () => () => {},
} as const;
