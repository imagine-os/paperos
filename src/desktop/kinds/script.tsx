"use client";

import { useEffect, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { getCanvasApi } from "@/api/install";
import { runScript, type ScriptLine } from "@/api/run-script";
import type { PlainEditorHandle } from "@/ide/editor/create-plain-editor";
import { DEFAULT_SCRIPT, SNIPPETS } from "@/ide/snippets";
import { resolvedTheme } from "@/ide/theme";
import { useSignal } from "@/ide/use-signal";
import { Dropdown, MenuItem } from "../menu";
import type { WindowKindProps } from "../window-kinds";

const SAVE_DELAY_MS = 300;

interface OutputLine extends ScriptLine {
  id: number;
}

/**
 * The script console: a JavaScript editor whose code runs against the
 * Canvas API (`paperos`) with a captured `console`, plus an output pane.
 * The source lives in the window's `content` prop.
 */
export function ScriptWindow({ shape, update }: WindowKindProps) {
  const host = useRef<HTMLDivElement>(null);
  const output = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<PlainEditorHandle | null>(null);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const theme = useSignal(resolvedTheme);
  const nextId = useRef(1);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initial = useRef(shape.props.content);

  const push = (line: ScriptLine) =>
    setLines((l) => [...l, { ...line, id: nextId.current++ }].slice(-500));

  const run = async () => {
    const code = handle?.getDoc() ?? shape.props.content;
    const api = getCanvasApi();
    if (!api) {
      push({ level: "error", text: "The Canvas API is not ready yet." });
      return;
    }
    setRunning(true);
    setStatus("Running...");
    push({ level: "system", text: `▶ run ${new Date().toLocaleTimeString()}` });
    const result = await runScript(code, { paperos: api }, push);
    setRunning(false);
    setStatus(
      result.ok
        ? `Done in ${Math.round(result.ms)} ms`
        : `Failed after ${Math.round(result.ms)} ms`
    );
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    let disposed = false;
    let created: PlainEditorHandle | null = null;
    (async () => {
      const { createPlainEditor } =
        await import("@/ide/editor/create-plain-editor");
      if (disposed || !host.current) return;
      created = createPlainEditor({
        parent: host.current,
        doc: initial.current || DEFAULT_SCRIPT,
        dark: resolvedTheme.get() === "dark",
        onRun: () => void runRef.current(),
        onChange: (doc) => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(
            () => update({ content: doc }),
            SAVE_DELAY_MS
          );
        },
      });
      if (!initial.current) update({ content: DEFAULT_SCRIPT });
      setHandle(created);
    })();
    return () => {
      disposed = true;
      created?.destroy();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handle?.setDark(theme === "dark");
  }, [handle, theme]);

  useEffect(() => {
    const el = output.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const loadSnippet = (code: string) => {
    handle?.setDoc(code);
    update({ content: code });
  };

  return (
    <div
      className="pos-script"
      data-testid="script-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <button
          type="button"
          className="pos-button pos-button--small pos-button--primary"
          disabled={!handle || running}
          title="Run (Ctrl+Enter)"
          data-testid="script-run"
          onClick={() => void run()}
        >
          ▶ Run
        </button>
        <Dropdown label="Snippets" small testId="script-snippets">
          {SNIPPETS.map((s) => (
            <MenuItem
              key={s.id}
              label={s.title}
              testId={`snippet-${s.id}`}
              onSelect={() => loadSnippet(s.code)}
            />
          ))}
        </Dropdown>
        <span className="pos-toolbar__status" data-testid="script-status">
          {status}
        </span>
        <a
          className="pos-toolbar__muted pos-script__link"
          href="https://github.com/imagine-os/paperos/blob/main/docs/CANVAS_API.md"
          target="_blank"
          rel="noreferrer"
          title="Canvas API reference"
        >
          API docs
        </a>
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={() => setLines([])}
        >
          Clear
        </button>
      </div>
      <div
        ref={host}
        className="pos-script__editor"
        data-testid="script-editor"
      />
      <div
        ref={output}
        className="pos-script__output"
        data-testid="script-output"
      >
        {lines.length === 0 && (
          <div className="pos-files__hint">
            Output appears here. <code>paperos</code> is the Canvas API;{" "}
            <code>await</code> works at the top level.
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className="pos-console__entry" data-level={l.level}>
            <span className="pos-console__level">
              {l.level === "result"
                ? "←"
                : l.level === "system"
                  ? "•"
                  : l.level}
            </span>
            {l.level === "result" && l.text.startsWith("data:image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="pos-script__image"
                src={l.text}
                alt="Script result"
              />
            ) : (
              <pre className="pos-console__text">{l.text}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
