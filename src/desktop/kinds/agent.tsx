"use client";

import { stopEventPropagation } from "tldraw";
import { getBridgeClient, type TranscriptEntry } from "@/api/bridge-client";
import { useSignal } from "@/ide/use-signal";
import { useEffect, useRef, useState } from "react";

/** Read-only transcript of the tool calls an agent makes over the bridge, with a pause switch. */
export function AgentWindow() {
  const [, force] = useState(0);
  const client = getBridgeClient();
  useEffect(() => {
    if (client) return;
    const t = setInterval(() => getBridgeClient() && force((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [client]);
  const status = useSignal(client?.status ?? OFF);
  const paused = useSignal(client?.paused ?? FALSE);
  const transcript = useSignal(client?.transcript ?? EMPTY);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  return (
    <div
      className="pos-agent"
      data-testid="agent-window"
      data-status={status}
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <div className="pos-toolbar pos-toolbar--dense">
        <span
          className={`pos-bridge-dot pos-bridge-dot--${status}`}
          aria-hidden="true"
        />
        <span className="pos-toolbar__muted" data-testid="agent-status">
          {status === "connected"
            ? "Agent connected"
            : status === "waiting"
              ? `Waiting for the bridge at ${client?.url ?? "ws://127.0.0.1:7331"}`
              : "Bridge off"}
        </span>
        <span className="pos-toolbar__status" />
        {status === "off" ? (
          <button
            type="button"
            className="pos-button pos-button--small"
            disabled={!client}
            onClick={() => client?.start()}
          >
            Turn on
          </button>
        ) : (
          <label
            className="pos-agent__pause"
            title="Paused: tool calls fail without touching the canvas"
          >
            <input
              type="checkbox"
              checked={paused}
              data-testid="agent-pause"
              onChange={(e) => client?.setPaused(e.target.checked)}
            />
            Pause
          </label>
        )}
        <button
          type="button"
          className="pos-button pos-button--small"
          onClick={() => client?.clearTranscript()}
        >
          Clear
        </button>
      </div>
      <div
        ref={list}
        className="pos-agent__list"
        data-testid="agent-transcript"
      >
        {transcript.length === 0 && (
          <div className="pos-files__hint">
            Tool calls arriving over the MCP bridge show up here. Start the
            bridge with <code>npm run mcp</code> and point your agent at it (see
            docs/MCP.md).
          </div>
        )}
        {transcript.map((e) => (
          <Entry key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

function Entry({ entry }: { entry: TranscriptEntry }) {
  const args = Object.keys(entry.args).length ? JSON.stringify(entry.args) : "";
  return (
    <div
      className="pos-agent__entry"
      data-ok={entry.ok}
      data-testid="agent-entry"
    >
      <div className="pos-agent__head">
        <span className="pos-agent__time">
          {new Date(entry.time).toLocaleTimeString()}
        </span>
        <span className="pos-agent__tool">{entry.tool}</span>
        <span className="pos-agent__ms">{entry.ms} ms</span>
      </div>
      {args && <pre className="pos-agent__args">{args}</pre>}
      <pre className="pos-agent__result">
        {entry.ok ? "← " : "✕ "}
        {entry.summary}
      </pre>
    </div>
  );
}

const OFF = {
  get: () => "off" as const,
  set() {},
  update() {},
  subscribe: () => () => {},
};
const FALSE = {
  get: () => false,
  set() {},
  update() {},
  subscribe: () => () => {},
};
const EMPTY = {
  get: () => [] as TranscriptEntry[],
  set() {},
  update() {},
  subscribe: () => () => {},
};
