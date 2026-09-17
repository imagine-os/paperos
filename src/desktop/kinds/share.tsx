"use client";

import { useEffect, useState } from "react";
import { stopEventPropagation } from "tldraw";
import { DEFAULT_SIGNALING, type TransportKind } from "@/collab/config";
import { initials, type Participant } from "@/collab/participants";
import { getCollabSession, type RoomStatus } from "@/collab/session";
import { getWindowManager } from "@/wm/window-manager";
import { useSignal } from "@/ide/use-signal";
import { collabSyncUrl } from "@/lib/env";
import type { WindowKindProps } from "../window-kinds";

const STATUS_LABEL: Record<RoomStatus, string> = {
  off: "Not in a room",
  connecting: "Connecting",
  waiting: "Waiting for the room's content",
  connected: "Connected",
};

/**
 * Create a room, copy its link, join one, see who is here, leave. The room
 * itself lives in `CollabSession`; this window is one view of it.
 */
export function ShareWindow({ editor }: WindowKindProps) {
  const session = getCollabSession();
  const state = useSignal(session.state);
  const participants = useSignal(session.participants);
  const identity = useSignal(session.identity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="pos-share"
      data-testid="share-window"
      data-status={state.status}
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <NameField
        name={identity.name}
        color={identity.color}
        onCommit={(n) => {
          try {
            session.setName(n);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      />
      {state.room ? (
        <InRoom
          state={state}
          participants={participants}
          busy={busy}
          onLeave={() => session.leave()}
          windowTitle={(id) =>
            getWindowManager(editor).getWindow(id as never)?.props.title ?? null
          }
        />
      ) : (
        <JoinOrCreate
          busy={busy}
          onCreate={(o) => run(() => session.create(o))}
          onJoin={(room, o) => run(() => session.join(room, o))}
        />
      )}
      {(error ?? state.error) && (
        <div
          className="pos-share__error"
          role="alert"
          data-testid="share-error"
        >
          {error ?? state.error}
        </div>
      )}
    </div>
  );
}

function NameField({
  name,
  color,
  onCommit,
}: {
  name: string;
  color: string;
  onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    if (draft.trim() && draft.trim() !== name) onCommit(draft);
    else setDraft(name);
  };
  return (
    <label className="pos-share__field">
      <span className="pos-share__label">Your name</span>
      <span className="pos-share__name">
        <span
          className="pos-share__avatar"
          style={{ background: color }}
          aria-hidden="true"
        >
          {initials(draft || name)}
        </span>
        <input
          className="pos-input"
          value={draft}
          maxLength={40}
          data-testid="share-name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </span>
    </label>
  );
}

interface RoomOpts {
  password?: string;
  transport?: { kind?: TransportKind; url?: string };
}

function JoinOrCreate({
  busy,
  onCreate,
  onJoin,
}: {
  busy: boolean;
  onCreate: (o: RoomOpts) => void;
  onJoin: (room: string, o: RoomOpts) => void;
}) {
  const session = getCollabSession();
  const stored = session.readStoredTransport();
  const [kind, setKind] = useState<TransportKind>(
    stored.kind ?? (collabSyncUrl ? "websocket" : "webrtc")
  );
  const [url, setUrl] = useState(stored.syncUrl ?? collabSyncUrl ?? "");
  const [signaling, setSignaling] = useState(stored.signaling ?? "");
  const [password, setPassword] = useState("");
  const [joinText, setJoinText] = useState("");

  const remember = (next: {
    kind?: TransportKind;
    url?: string;
    signaling?: string;
  }) => {
    session.writeStoredTransport({
      kind: next.kind ?? kind,
      syncUrl: next.url ?? url,
      signaling: next.signaling ?? signaling,
    });
  };

  const opts = (): RoomOpts => ({
    password: password || undefined,
    transport:
      kind === "websocket"
        ? { kind, url: url.trim() || undefined }
        : { kind, url: signaling.trim() || undefined },
  });

  const join = () => {
    const text = joinText.trim();
    if (!text) return;
    if (
      !window.confirm(
        `Join room "${text}"?\n\nIts canvas and project replace what you see here. Your own project stays in the Open menu.`
      )
    )
      return;
    onJoin(text, opts());
  };

  return (
    <div className="pos-share__body">
      <p className="pos-share__hint">
        Share this canvas and project live. Everyone in the room sees the same
        windows and files, with cursors and names. Nothing leaves your browser
        until you create or join a room.
      </p>
      <div className="pos-share__row">
        <label className="pos-share__field pos-share__field--grow">
          <span className="pos-share__label">Connection</span>
          <select
            className="pos-input"
            value={kind}
            data-testid="share-transport"
            onChange={(e) => {
              const k = e.target.value as TransportKind;
              setKind(k);
              remember({ kind: k });
            }}
          >
            <option value="webrtc">Peer-to-peer (WebRTC)</option>
            <option value="websocket">Sync server (self-hosted)</option>
          </select>
        </label>
        <label className="pos-share__field pos-share__field--grow">
          <span className="pos-share__label">Password (optional)</span>
          <input
            className="pos-input"
            type="password"
            value={password}
            autoComplete="off"
            data-testid="share-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
      </div>
      {kind === "websocket" ? (
        <label className="pos-share__field">
          <span className="pos-share__label">
            Sync server URL (npm run sync starts one on ws://localhost:1234)
          </span>
          <input
            className="pos-input"
            value={url}
            placeholder="ws://localhost:1234"
            data-testid="share-url"
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => remember({})}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
      ) : (
        <label className="pos-share__field">
          <span className="pos-share__label">
            Signaling server (optional; default {DEFAULT_SIGNALING[0]})
          </span>
          <input
            className="pos-input"
            value={signaling}
            placeholder={DEFAULT_SIGNALING[0]}
            data-testid="share-signaling"
            onChange={(e) => setSignaling(e.target.value)}
            onBlur={() => remember({})}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
      )}
      <button
        type="button"
        className="pos-button pos-button--primary pos-share__create"
        disabled={busy}
        data-testid="share-create"
        onClick={() => onCreate(opts())}
      >
        {busy ? "Connecting..." : "Create a room"}
      </button>
      <div className="pos-share__divider">or join one</div>
      <div className="pos-share__row">
        <input
          className="pos-input pos-share__field--grow"
          value={joinText}
          placeholder="Room id or link (amber-fox-417)"
          data-testid="share-join-input"
          onChange={(e) => setJoinText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") join();
          }}
        />
        <button
          type="button"
          className="pos-button"
          disabled={busy || !joinText.trim()}
          data-testid="share-join"
          onClick={join}
        >
          Join
        </button>
      </div>
    </div>
  );
}

function InRoom({
  state,
  participants,
  busy,
  onLeave,
  windowTitle,
}: {
  state: ReturnType<typeof getCollabSession>["state"] extends {
    get(): infer S;
  }
    ? S
    : never;
  participants: Participant[];
  busy: boolean;
  onLeave: () => void;
  windowTitle: (id: string) => string | null;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const input = document.querySelector<HTMLInputElement>(
        "[data-testid=share-link]"
      );
      input?.select();
    }
  };
  const dot =
    state.status === "connected" && state.online
      ? "connected"
      : state.status === "off"
        ? "off"
        : "waiting";
  return (
    <div className="pos-share__body">
      <div className="pos-share__room">
        <span className="pos-share__label">Room</span>
        <strong className="pos-share__id" data-testid="share-room-id">
          {state.room}
        </strong>
        {state.locked && (
          <span className="pos-share__lock" title="Password protected">
            {"\u{1F512}"}
          </span>
        )}
      </div>
      <div className="pos-share__status" data-testid="share-status">
        <span
          className={`pos-bridge-dot pos-bridge-dot--${dot}`}
          aria-hidden="true"
        />
        {STATUS_LABEL[state.status]}
        {state.status === "connected" &&
          ` · ${state.peers} ${state.peers === 1 ? "peer" : "peers"}`}
        {state.via && ` · ${state.via}`}
        {state.status === "connected" && !state.online && " · offline"}
      </div>
      {state.status === "waiting" && (
        <p className="pos-share__hint">
          Nobody has shared content into this room yet, or the password differs.
          The canvas fills in as soon as the room&apos;s content arrives.
        </p>
      )}
      <div className="pos-share__row">
        <input
          className="pos-input pos-share__field--grow"
          readOnly
          value={state.link ?? ""}
          data-testid="share-link"
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="pos-button"
          data-testid="share-copy"
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="pos-share__label">
        In this room ({participants.length})
      </div>
      <ul className="pos-share__people" data-testid="share-participants">
        {participants.map((p) => (
          <li
            key={p.id}
            className="pos-share__person"
            data-testid="share-participant"
            data-agent={p.agent}
            data-local={p.local}
          >
            <span
              className="pos-share__avatar"
              style={{ background: p.color }}
              aria-hidden="true"
            >
              {p.agent ? "\u{1F916}" : initials(p.name)}
            </span>
            <span className="pos-share__person-name">
              {p.name}
              {p.local && !p.agent && (
                <span className="pos-share__badge">you</span>
              )}
              {p.agent && <span className="pos-share__badge">agent</span>}
            </span>
            <span className="pos-share__person-where">
              {p.window ? (windowTitle(p.window) ?? "") : ""}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="pos-button pos-share__leave"
        disabled={busy}
        data-testid="share-leave"
        onClick={onLeave}
      >
        Leave room
      </button>
    </div>
  );
}
