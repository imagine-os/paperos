"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { signal } from "@/ide/signal";
import { useSignal } from "@/ide/use-signal";
import {
  disposeTerminalSession,
  getTerminalSession,
} from "@/terminal/registry";
import { parseTerminalContent, type TerminalBackend } from "@/terminal/session";
import type { WindowKindProps } from "../window-kinds";

/** The person said yes to running a real shell through the bridge, for this tab session. */
export const bridgeShellApproved = signal(false);

/**
 * A terminal as a window. Two backends behind one prompt: the project shell
 * (a command interpreter over the project's files, in the tab) and the
 * bridge shell (a real shell on the user's machine through the agent
 * bridge, opt-in with a confirmation). The scrollback, the backend and the
 * history live in a `TerminalSession` (src/terminal/session.ts) shared
 * with the Canvas API.
 */
export function TerminalWindow({ shape, editor, update }: WindowKindProps) {
  const session = useMemo(
    () => getTerminalSession(editor, shape.id),
    [editor, shape.id]
  );
  const lines = useSignal(session.lines);
  const backend = useSignal(session.backend);
  const bridgeShell = useSignal(session.bridgeShell);
  const busy = useSignal(session.busy);
  useSignal(session.promptTick);
  const bridgeStatus = useSignal(session.bridge?.status ?? NO_BRIDGE_STATUS);
  const approved = useSignal(bridgeShellApproved);
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(-1);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useMemo(
    () => parseTerminalContent(shape.props.content),
    [shape.props.content]
  );

  // Initial commands (from a board), once.
  useEffect(() => {
    void session.runInitial(content.run);
  }, [session, content.run]);

  // A window that reopens with backend: bridge asks again; nothing starts on its own.
  useEffect(() => {
    if (content.backend === "bridge" && !bridgeShell && approved)
      setConfirming(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.backend]);

  const lastText = lines[lines.length - 1]?.text;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, lastText]);

  // Dispose the session when the window is gone (not on a mere re-render).
  useEffect(() => {
    return () => {
      if (!editor.getShape(shape.id)) disposeTerminalSession(shape.id);
    };
  }, [editor, shape.id]);

  const submit = async () => {
    const line = value;
    setValue("");
    setCursor(-1);
    await session.run(line);
  };

  const choose = (b: TerminalBackend) => {
    if (b === "project") {
      session.setBackend("project");
      update({ content: JSON.stringify({ ...content, backend: "project" }) });
      return;
    }
    if (bridgeShell) {
      session.setBackend("bridge");
      update({ content: JSON.stringify({ ...content, backend: "bridge" }) });
      return;
    }
    setConfirming(true);
  };

  const startBridge = async () => {
    setStarting("Starting…");
    try {
      bridgeShellApproved.set(true);
      await session.startBridgeShell();
      update({ content: JSON.stringify({ ...content, backend: "bridge" }) });
      setConfirming(false);
      setStarting(null);
    } catch (e) {
      setStarting(e instanceof Error ? e.message : String(e));
    }
  };

  const prompt = session.prompt();
  const bridgeLabel =
    bridgeStatus === "connected"
      ? bridgeShell
        ? `Bridge shell: ${bridgeShell.shell} (${bridgeShell.backend})`
        : "Bridge connected"
      : bridgeStatus === "waiting"
        ? "Bridge: waiting for the CLI"
        : "Bridge off";

  return (
    <div
      className="pos-terminal"
      data-testid="terminal-window"
      data-backend={backend}
      onPointerDown={stopEventPropagation}
      onClick={() => input.current?.focus()}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <div className="pos-tabs" role="tablist" aria-label="Terminal backend">
          <button
            type="button"
            role="tab"
            aria-selected={backend === "project"}
            className={`pos-tabs__tab${backend === "project" ? " pos-tabs__tab--active" : ""}`}
            data-testid="terminal-backend-project"
            onClick={() => choose("project")}
          >
            Project shell
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={backend === "bridge"}
            className={`pos-tabs__tab${backend === "bridge" ? " pos-tabs__tab--active" : ""}`}
            data-testid="terminal-backend-bridge"
            title="A real shell on your machine, through the agent bridge"
            onClick={() => choose("bridge")}
          >
            Bridge shell
          </button>
        </div>
        <span className="pos-toolbar__status" data-testid="terminal-status">
          <span
            className={`pos-bridge-dot pos-bridge-dot--${bridgeStatus}`}
            aria-hidden="true"
          />{" "}
          {bridgeLabel}
        </span>
        {bridgeShell && (
          <button
            type="button"
            className="pos-button pos-button--small"
            title="End the shell on your machine"
            onClick={() => void session.stopBridgeShell()}
          >
            Stop shell
          </button>
        )}
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={() => session.clear()}
        >
          Clear
        </button>
      </div>
      {backend === "project" && bridgeStatus !== "connected" && (
        <div className="pos-terminal__hint" data-testid="terminal-hint">
          Project shell: commands run against the project&apos;s files in this
          tab. For a real shell, turn on the Agent bridge (top bar), run{" "}
          <code>npm run mcp</code>, then pick Bridge shell.
        </div>
      )}
      {confirming && (
        <div className="pos-terminal__confirm" data-testid="terminal-confirm">
          <strong>Run a real shell on your machine?</strong>
          <p>
            The bridge shell starts <code>{"$SHELL"}</code> where the
            paperos-mcp CLI runs, with your user&apos;s privileges. Everything
            typed here (and anything a script sends with{" "}
            <code>paperos.terminal.write</code>) runs there. It ends when this
            window, the tab or the CLI closes.
          </p>
          {bridgeStatus !== "connected" && (
            <p className="pos-terminal__confirm-warn">
              The agent bridge is{" "}
              {bridgeStatus === "waiting" ? "waiting for the CLI" : "off"}. Turn
              it on in the top bar and start <code>npm run mcp</code> first.
            </p>
          )}
          {starting && <p className="pos-terminal__confirm-warn">{starting}</p>}
          <div className="pos-terminal__confirm-actions">
            <button
              type="button"
              className="pos-button pos-button--small pos-button--primary"
              data-testid="terminal-confirm-start"
              disabled={
                bridgeStatus !== "connected" || starting === "Starting…"
              }
              onClick={() => void startBridge()}
            >
              Start shell
            </button>
            <button
              type="button"
              className="pos-button pos-button--small"
              onClick={() => {
                setConfirming(false);
                setStarting(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div
        ref={scroller}
        className="pos-terminal__scroll"
        data-testid="terminal-output"
        onWheel={stopEventPropagation}
      >
        {lines.map((l) => (
          <div key={l.id} className="pos-terminal__line" data-kind={l.kind}>
            {l.text || "\u00a0"}
          </div>
        ))}
        <div className="pos-terminal__input-row">
          <span className="pos-terminal__prompt">{prompt}</span>
          <input
            ref={input}
            className="pos-terminal__input"
            aria-label="Terminal input"
            data-testid="terminal-input"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              } else if (e.key === "Tab") {
                e.preventDefault();
                const c = session.complete(value);
                if (c.candidates.length > 1)
                  session.system(c.candidates.join("  "));
                setValue(c.line);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const h = session.history;
                if (!h.length) return;
                const next = Math.min(cursor + 1, h.length - 1);
                setCursor(next);
                setValue(h[h.length - 1 - next]);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const h = session.history;
                const next = Math.max(cursor - 1, -1);
                setCursor(next);
                setValue(next === -1 ? "" : h[h.length - 1 - next]);
              } else if (e.key === "l" && e.ctrlKey) {
                e.preventDefault();
                session.clear();
              } else if (e.key === "c" && e.ctrlKey && backend === "bridge") {
                e.preventDefault();
                void session.write("\u0003");
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

const NO_BRIDGE_STATUS = signal<"off" | "waiting" | "connected">("off");
