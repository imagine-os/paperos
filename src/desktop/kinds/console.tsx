"use client";

import { useEffect, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import {
  clearConsole,
  consoleEntries,
  consoleEvalTarget,
  pushConsole,
} from "@/ide/console-store";
import { useSignal } from "@/ide/use-signal";

/** Output of the preview iframe, plus a one-line snippet runner. */
export function ConsoleWindow() {
  const entries = useSignal(consoleEntries);
  const target = useSignal(consoleEvalTarget);
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const run = () => {
    const snippet = code.trim();
    if (!snippet) return;
    pushConsole("system", `> ${snippet}`);
    if (target) target(snippet);
    else pushConsole("error", "No preview window is open to run this in.");
    setHistory((h) => [snippet, ...h].slice(0, 50));
    setCursor(-1);
    setCode("");
  };

  return (
    <div
      className="pos-console"
      data-testid="console-window"
      onPointerDown={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <span className="pos-toolbar__muted">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
        <span className="pos-toolbar__status" />
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={clearConsole}
        >
          Clear
        </button>
      </div>
      <div
        ref={list}
        className="pos-console__list"
        onWheel={stopEventPropagation}
        data-testid="console-list"
      >
        {entries.length === 0 && (
          <div className="pos-files__hint">
            Console output from the preview shows up here.
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="pos-console__entry" data-level={e.level}>
            <span className="pos-console__time">
              {new Date(e.time).toLocaleTimeString()}
            </span>
            <span className="pos-console__level">
              {e.level === "result"
                ? "←"
                : e.level === "system"
                  ? "•"
                  : e.level}
            </span>
            <pre className="pos-console__text">{e.text}</pre>
          </div>
        ))}
      </div>
      <div className="pos-console__input">
        <span aria-hidden="true">{">"}</span>
        <input
          className="pos-console__field"
          aria-label="Run JavaScript in the preview"
          data-testid="console-input"
          placeholder={
            target
              ? "Run JS in the preview (Enter)"
              : "Open a Preview window to run snippets"
          }
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") run();
            if (e.key === "ArrowUp" && history.length) {
              const next = Math.min(cursor + 1, history.length - 1);
              setCursor(next);
              setCode(history[next]);
            }
            if (e.key === "ArrowDown") {
              const next = Math.max(cursor - 1, -1);
              setCursor(next);
              setCode(next === -1 ? "" : history[next]);
            }
          }}
        />
      </div>
    </div>
  );
}
