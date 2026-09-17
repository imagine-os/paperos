"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import {
  consoleEvalTarget,
  isPreviewMessage,
  pushConsole,
} from "@/ide/console-store";
import { docsChanged, readLiveText } from "@/ide/docs";
import { isPagePath, pagePath } from "@/design/pages";
import { bundle, pickEntry, splitEntry } from "@/ide/preview/bundle";
import { previewReload } from "@/ide/preview/preview-state";
import { getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import { hintTable } from "@/lineage/open";
import type { WindowKindProps } from "../window-kinds";
import { isDesignMessage } from "./design-common";

/** `pages/x.json?tenant=2` with `sources=1` added or removed. */
export function withQueryFlag(
  content: string,
  key: string,
  on: boolean
): string {
  const { path, query } = splitEntry(content);
  const next = { ...query };
  if (on) next[key] = "1";
  else delete next[key];
  const q = Object.entries(next)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return q ? `${path}?${q}` : path;
}

export const PREVIEW_DEBOUNCE_MS = 300;

/**
 * Live preview of the active project's web entry in a sandboxed iframe.
 * The document is rebuilt from the live buffers (unsaved edits included)
 * 300 ms after the last change. `content` holds an entry path override; a
 * `pages/<name>.json` entry renders that composed page.
 */
export function PreviewWindow({ shape, editor, update }: WindowKindProps) {
  const store = getProjectStore();
  const state = useSignal(store.state);
  const changes = useSignal(store.changes);
  const docTick = useSignal(docsChanged);
  const reloadTick = useSignal(previewReload);
  const project = state.activeId;
  const iframe = useRef<HTMLIFrameElement>(null);
  const [srcdoc, setSrcdoc] = useState<string>("");
  const [entry, setEntry] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // `pages/x.json?tenant=2` carries the preview context in its query.
  const override = shape.props.content || null;
  const parsed = override ? splitEntry(override) : null;
  const overridePath = parsed?.path || null;
  const query = parsed?.query ?? {};
  const queryText =
    override && override.includes("?")
      ? override.slice(override.indexOf("?"))
      : "";
  const sourcesOn = query.sources === "1";

  // Files of the active project (for picking the entry).
  useEffect(() => {
    store.init();
    if (!project) return;
    let off = () => {};
    let cancelled = false;
    store.session(project).then((s) => {
      if (!s || cancelled) return;
      const sync = () =>
        setPaths(
          s.files
            .get()
            .filter((f) => f.type === "file")
            .map((f) => f.path)
        );
      sync();
      off = s.files.subscribe(sync);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store, project]);

  useEffect(() => {
    setEntry(
      overridePath && paths.includes(overridePath)
        ? overridePath
        : pickEntry(paths)
    );
  }, [overridePath, paths]);

  const rebuild = useCallback(async () => {
    if (!project || !entry) {
      setSrcdoc("");
      return;
    }
    const out = await bundle(entry, (p) => readLiveText(project, p, store), {
      list: () => paths,
      context: query,
      sources: sourcesOn,
    });
    setSrcdoc(out.html);
    setMissing(out.missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, entry, store, paths, queryText]);

  // Debounced rebuild on any document or file change.
  useEffect(() => {
    const t = setTimeout(() => void rebuild(), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rebuild, changes, docTick, version, reloadTick]);

  // Console bridge: messages from this iframe go to the console store.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow) return;
      // A hovered "Data sources" badge outlines the table's card on the canvas.
      if (isDesignMessage(e.data) && e.data.type === "hover-table") {
        hintTable(editor, e.data.table ?? null);
        return;
      }
      if (!isPreviewMessage(e.data)) return;
      if (e.data.type === "console" && e.data.level) {
        pushConsole(e.data.level, (e.data.args ?? []).join(" "));
      }
      // A link to another page (href="#/route") switches the entry.
      if (e.data.type === "navigate" && e.data.page) {
        const target = pagePath(e.data.page);
        if (paths.includes(target)) update({ content: target + queryText });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [paths, update, queryText, editor]);

  // This window runs Console snippets (the latest preview wins).
  useEffect(() => {
    const run = (code: string) => {
      iframe.current?.contentWindow?.postMessage(
        { source: "paperos-console", type: "eval", code },
        "*"
      );
    };
    consoleEvalTarget.set(run);
    return () => {
      if (consoleEvalTarget.get() === run) consoleEvalTarget.set(null);
    };
  }, []);

  const shown = entry ? `/${entry}${queryText}` : "";
  const commitEntry = () => {
    if (draft === null) return;
    const next = draft.trim().replace(/^\/+/, "");
    setDraft(null);
    if (next && next !== `${entry ?? ""}${queryText}`)
      update({ content: next });
  };

  return (
    <div
      className="pos-preview"
      data-testid="preview-window"
      onPointerDown={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <button
          type="button"
          className="pos-button pos-button--small"
          title="Reload"
          aria-label="Reload preview"
          onClick={() => setVersion((v) => v + 1)}
        >
          {"↻"}
        </button>
        <input
          className="pos-preview__url"
          aria-label="Entry file"
          data-testid="preview-entry"
          list={`entries-${shape.id}`}
          value={draft ?? shown}
          placeholder={paths.length ? "Entry file (index.html)" : "No files"}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setDraft(shown)}
          onBlur={commitEntry}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(null);
          }}
        />
        {entry && isPagePath(entry) && (
          <button
            type="button"
            className={`pos-button pos-button--small${sourcesOn ? " pos-button--primary" : ""}`}
            title="Data sources: badge every block with the table and fields it binds"
            aria-pressed={sourcesOn}
            data-testid="preview-sources"
            onClick={() =>
              update({
                content: withQueryFlag(
                  `${entry}${queryText}`,
                  "sources",
                  !sourcesOn
                ),
              })
            }
          >
            Sources
          </button>
        )}
        <datalist id={`entries-${shape.id}`}>
          {paths
            .filter((p) => /\.html?$/i.test(p) || isPagePath(p))
            .map((p) => (
              <option key={p} value={`/${p}`} />
            ))}
        </datalist>
      </div>
      {missing.length > 0 && (
        <div className="pos-preview__warn" role="status">
          Missing: {missing.join(", ")}
        </div>
      )}
      {entry ? (
        <iframe
          ref={iframe}
          className="pos-preview__frame"
          title={`Preview of ${entry}`}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          srcDoc={srcdoc}
          onWheel={stopEventPropagation}
        />
      ) : (
        <div className="pos-files__hint">
          {project
            ? "No HTML file in this project. Add an index.html to preview it."
            : "No project is open."}
        </div>
      )}
    </div>
  );
}
