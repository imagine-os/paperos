"use client";

import { useEffect, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { docsChanged, readLiveText } from "@/ide/docs";
import { encodeFileRef, parseFileRef } from "@/ide/file-ref";
import { openFile } from "@/ide/open-file";
import { basename, extname, getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import type { WindowKindProps } from "../window-kinds";
import { FilePicker } from "./file-picker";

const isMarkdown = (p: string) =>
  extname(p) === "md" || extname(p) === "markdown";

/** Renders a Markdown file (README.md of the active project by default). */
export function MarkdownWindow({ shape, editor, update }: WindowKindProps) {
  const store = getProjectStore();
  const state = useSignal(store.state);
  const ref = parseFileRef(shape.props.content);

  // Default to README.md when the window opens without a file.
  useEffect(() => {
    if (ref || !state.activeId) return;
    const project = state.activeId;
    store.session(project).then((s) => {
      const readme = s?.files
        .get()
        .find((f) => f.type === "file" && /^readme\.md$/i.test(f.path));
      if (readme)
        update({
          content: encodeFileRef({ project, path: readme.path }),
          title: readme.path,
        });
    });
  }, [ref, state.activeId, store, update]);

  if (!ref) {
    return (
      <div
        className="pos-markdown pos-markdown--empty"
        onPointerDown={stopEventPropagation}
      >
        <FilePicker
          label="Pick a Markdown file:"
          filter={isMarkdown}
          onPick={(project, path) =>
            update({
              content: encodeFileRef({ project, path }),
              title: basename(path),
            })
          }
        />
      </div>
    );
  }

  return (
    <MarkdownView
      key={ref.project + ":" + ref.path}
      project={ref.project}
      path={ref.path}
      onEdit={() => openFile(editor, ref, { kind: "editor", nearId: shape.id })}
      onPickOther={() => update({ content: "", title: "Markdown" })}
    />
  );
}

function MarkdownView({
  project,
  path,
  onEdit,
  onPickOther,
}: {
  project: string;
  path: string;
  onEdit: () => void;
  onPickOther: () => void;
}) {
  const store = getProjectStore();
  const changes = useSignal(store.changes);
  const tick = useSignal(docsChanged);
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const text = await readLiveText(project, path, store);
      if (cancelled) return;
      if (text === null) {
        setError(`Cannot read ${path}`);
        return;
      }
      const [{ marked }, { default: DOMPurify }] = await Promise.all([
        import("marked"),
        import("dompurify"),
      ]);
      const raw = await marked.parse(text, { gfm: true, breaks: false });
      if (!cancelled) {
        setError(null);
        setHtml(DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }));
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [project, path, store, changes, tick]);

  return (
    <div
      className="pos-markdown"
      data-testid="markdown-window"
      onPointerDown={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <span className="pos-toolbar__path" title={path}>
          {path}
        </span>
        <span className="pos-toolbar__status">{error}</span>
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={onPickOther}
        >
          Other file
        </button>
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
      <article
        className="pos-markdown__body"
        onWheel={stopEventPropagation}
        // Sanitized with DOMPurify above.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
