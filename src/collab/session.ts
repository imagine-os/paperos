/**
 * The room this tab is in. One Yjs document per room carries the canvas
 * (`store-sync.ts`) and the project (`project-sync.ts`); awareness carries
 * who is here, what they focus and where their cursors are. y-indexeddb
 * keeps a local copy of the room so rejoining (even offline) is instant.
 *
 * Joining: the first one in seeds the room with their project and canvas;
 * everyone after adopts the room's project (a local project with the room's
 * project id) and canvas. Leaving keeps the local copy of both.
 */
import type { Editor } from "tldraw";
import { atom, react, type Atom, type TLPresenceUserInfo } from "tldraw";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { getBridgeClient } from "@/api/bridge-client";
import { parseFileRef } from "@/ide/file-ref";
import { clearFileDocStorage, resetFileDocs, setDocSource } from "@/ide/docs";
import { getProjectStore } from "@/ide/project/store";
import { signal, type Signal } from "@/ide/signal";
import { basePath, collabSignaling, collabSyncUrl } from "@/lib/env";
import { getWindowManager } from "@/wm/window-manager";
import {
  describeTransport,
  selectTransport,
  type StoredTransport,
  type Transport,
  type TransportKind,
} from "./config";
import { readIdentity, writeIdentity, type Identity } from "./identity";
import {
  lightColor,
  participantsFromStates,
  type AwarenessState,
  type Participant,
} from "./participants";
import {
  adoptRoomProject,
  bindProject,
  ensureRoomText,
  roomProjectMeta,
  seedRoomProject,
} from "./project-sync";
import { createProvider, type CollabProvider } from "./providers";
import { normalizeRoomId, parseRoomLink, roomKey, roomLink } from "./room-id";
import { bindStore } from "./store-sync";

export type RoomStatus = "off" | "connecting" | "waiting" | "connected";

export interface RoomState {
  /** Room id, or null when not in a room. */
  room: string | null;
  status: RoomStatus;
  transport: TransportKind | null;
  /** Signaling or sync server in use. */
  endpoint: string | null;
  /** Human readable transport line. */
  via: string | null;
  /** Other tabs in the room (agents not counted). */
  peers: number;
  /** The shared project's id. */
  project: string | null;
  /** The room has a password. */
  locked: boolean;
  /** Link to share (no password in it). */
  link: string | null;
  /** Last error while connecting, if any. */
  error: string | null;
  /** The transport reports a live connection (to peers or to the server). */
  online: boolean;
}

export const OFF_STATE: RoomState = {
  room: null,
  status: "off",
  transport: null,
  endpoint: null,
  via: null,
  peers: 0,
  project: null,
  locked: false,
  link: null,
  error: null,
  online: false,
};

export interface JoinOptions {
  password?: string;
  transport?: { kind?: TransportKind; url?: string };
}

export const TRANSPORT_KEY = "paperos-v2:collab-transport";
export const ROOM_STORAGE_PREFIX = "paperos-v2:room:";

/** How long a joiner waits for the first sync before it reports "waiting". */
export const JOIN_SYNC_TIMEOUT_MS = 6000;

interface ActiveRoom {
  id: string;
  doc: Y.Doc;
  awareness: Awareness;
  provider: CollabProvider | null;
  offs: (() => void)[];
  project: string | null;
}

export class CollabSession {
  readonly state: Signal<RoomState> = signal(OFF_STATE);
  readonly participants: Signal<Participant[]> = signal<Participant[]>([]);
  readonly identity: Signal<Identity> = signal(readIdentity());
  private editor: Editor | null = null;
  private active: ActiveRoom | null = null;
  private readonly user: Atom<TLPresenceUserInfo>;

  constructor() {
    const id = this.identity.get();
    this.user = atom<TLPresenceUserInfo>("collab user", {
      id: id.id,
      name: id.name,
      color: id.color,
    });
  }

  /** Remembers the mounted editor and joins the room named in the URL. Returns true when a join started. */
  install(
    editor: Editor,
    options: { confirmJoin?: (id: string) => boolean } = {}
  ): boolean {
    this.editor = editor;
    if (typeof window === "undefined") return false;
    const link = parseRoomLink(window.location.search);
    if (!link) return false;
    if (options.confirmJoin && !options.confirmJoin(link.id)) {
      this.writeUrl(null);
      return false;
    }
    void this.join(link.id, {
      transport: link.sync ? { kind: "websocket", url: link.sync } : undefined,
    }).catch(() => {});
    return true;
  }

  uninstall(editor: Editor): void {
    if (this.editor === editor) {
      this.leave();
      this.editor = null;
    }
  }

  get roomDoc(): Y.Doc | null {
    return this.active?.doc ?? null;
  }

  get awareness(): Awareness | null {
    return this.active?.awareness ?? null;
  }

  // ----- transport preference -------------------------------------------------

  readStoredTransport(): StoredTransport {
    try {
      const raw = window.localStorage.getItem(TRANSPORT_KEY);
      return raw ? (JSON.parse(raw) as StoredTransport) : {};
    } catch {
      return {};
    }
  }

  writeStoredTransport(t: StoredTransport): void {
    try {
      window.localStorage.setItem(TRANSPORT_KEY, JSON.stringify(t));
    } catch {
      // Storage blocked.
    }
  }

  resolveTransport(explicit?: JoinOptions["transport"]): Transport {
    return selectTransport({
      explicit,
      stored: this.readStoredTransport(),
      env: { signaling: collabSignaling, syncUrl: collabSyncUrl },
    });
  }

  // ----- identity ---------------------------------------------------------------

  setName(name: string): Identity {
    const clean = name.trim().slice(0, 40);
    if (!clean) throw new Error("name must not be empty");
    const next = { ...this.identity.get(), name: clean };
    this.identity.set(next);
    writeIdentity(next);
    this.user.set({ id: next.id, name: next.name, color: next.color });
    this.publishUser();
    return next;
  }

  private publishUser() {
    const a = this.active?.awareness;
    if (!a) return;
    const id = this.identity.get();
    a.setLocalStateField("user", {
      id: id.id,
      name: id.name,
      color: id.color,
      colorLight: lightColor(id.color),
    });
  }

  // ----- rooms ------------------------------------------------------------------

  /** Creates a room (random readable id unless given) seeded with this tab's canvas and project. */
  async create(
    options: JoinOptions & { id?: string } = {}
  ): Promise<RoomState> {
    const { newRoomId } = await import("./room-id");
    const id = options.id ? normalizeRoomId(options.id) : newRoomId();
    if (!id) throw new Error("Not a valid room id");
    return this.enter(id, options, "create");
  }

  /** Joins a room by id or link; adopts its project and canvas once they arrive. */
  async join(
    roomOrLink: string,
    options: JoinOptions = {}
  ): Promise<RoomState> {
    const link = parseRoomLink(roomOrLink);
    if (!link) throw new Error(`"${roomOrLink}" is not a room id or link`);
    const transport =
      options.transport ??
      (link.sync ? { kind: "websocket" as const, url: link.sync } : undefined);
    return this.enter(link.id, { ...options, transport }, "join");
  }

  /** Leaves the room; the canvas and project stay as they are, locally. */
  leave(): boolean {
    const a = this.active;
    if (!a) return false;
    this.active = null;
    for (const off of a.offs.reverse()) {
      try {
        off();
      } catch (e) {
        console.warn("[paperos] leaving room: cleanup failed", e);
      }
    }
    a.provider?.destroy();
    a.awareness.destroy();
    a.doc.destroy();
    setDocSource(null);
    if (a.project) {
      resetFileDocs(a.project);
      void clearFileDocStorage(a.project);
    }
    this.participants.set([]);
    this.state.set(OFF_STATE);
    this.writeUrl(null);
    return true;
  }

  private async enter(
    id: string,
    options: JoinOptions,
    mode: "create" | "join"
  ): Promise<RoomState> {
    const editor = this.editor;
    if (!editor) throw new Error("The desktop is not mounted yet");
    if (this.active) this.leave();
    const transport = this.resolveTransport(options.transport);
    const password = options.password?.trim() || undefined;
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const room: ActiveRoom = {
      id,
      doc,
      awareness,
      provider: null,
      offs: [],
      project: null,
    };
    this.active = room;
    const link = roomLink(`${window.location.origin}${basePath}`, {
      id,
      ...(transport.kind === "websocket" ? { sync: transport.url } : {}),
    });
    const patch = (p: Partial<RoomState>) => {
      if (this.active !== room) return;
      this.state.update((s) => ({ ...s, ...p }));
    };
    this.state.set({
      ...OFF_STATE,
      room: id,
      status: "connecting",
      transport: transport.kind,
      endpoint:
        transport.kind === "webrtc" ? transport.signaling[0] : transport.url,
      via: describeTransport(transport),
      locked: !!password,
      link,
    });
    this.writeUrl(link);

    try {
      // Local copy of the room first (instant rejoin, works offline).
      if (typeof indexedDB !== "undefined") {
        const { IndexeddbPersistence } = await import("y-indexeddb");
        const persistence = new IndexeddbPersistence(
          `${ROOM_STORAGE_PREFIX}${id}`,
          doc
        );
        await persistence.whenSynced;
        room.offs.push(() => void persistence.destroy());
      }
      if (this.active !== room) return this.state.get();

      this.publishUser();
      awareness.setLocalStateField("focus", { window: null, file: null });
      awareness.setLocalStateField("agent", false);
      this.watchAwareness(room);

      const provider = await createProvider({
        transport,
        room: roomKey(id, password),
        doc,
        awareness,
        password,
      });
      room.provider = provider;
      if (this.active !== room) {
        provider.destroy();
        return this.state.get();
      }
      room.offs.push(
        provider.status.subscribe(() =>
          patch({ online: provider.status.get() === "connected" })
        )
      );
      patch({ online: provider.status.get() === "connected" });

      const projects = getProjectStore();
      await projects.init();
      let projectId: string;
      if (mode === "create" && !roomProjectMeta(doc)) {
        const active = projects.getActiveId();
        if (!active) throw new Error("No project is open to share");
        await seedRoomProject(doc, projects, active);
        projectId = active;
      } else {
        // Joiner: wait for the room's project (the local copy may already have it).
        if (!roomProjectMeta(doc)) {
          await Promise.race([
            provider.whenSynced,
            waitForMeta(doc),
            sleep(JOIN_SYNC_TIMEOUT_MS),
          ]);
        }
        if (this.active !== room) return this.state.get();
        if (!roomProjectMeta(doc)) {
          patch({ status: "waiting" });
          await waitForMeta(doc);
          if (this.active !== room) return this.state.get();
        }
        projectId = await adoptRoomProject(doc, projects);
      }
      if (this.active !== room) return this.state.get();
      room.project = projectId;

      // Documents come from the room from now on.
      setDocSource((project, path) =>
        project === projectId
          ? { doc, text: ensureRoomText(doc, path), awareness }
          : null
      );
      resetFileDocs(projectId);
      room.offs.push(bindProject(doc, projects, projectId));
      room.offs.push(bindStore(editor.store, doc, awareness, this.user));
      this.watchFocus(room, editor);
      this.watchAgent(room);

      patch({ status: "connected", project: projectId, error: null });
      return this.state.get();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (this.active === room) {
        this.leave();
        this.state.set({ ...OFF_STATE, error: message });
      }
      throw e;
    }
  }

  // ----- awareness --------------------------------------------------------------

  private watchAwareness(room: ActiveRoom) {
    let last = "";
    const update = () => {
      if (this.active !== room) return;
      const list = participantsFromStates(
        room.awareness.getStates() as Map<number, AwarenessState>,
        room.awareness.clientID
      );
      const key = JSON.stringify(list);
      if (key === last) return;
      last = key;
      this.participants.set(list);
      this.state.update((s) => ({
        ...s,
        peers: list.filter((p) => !p.local && !p.agent).length,
      }));
    };
    room.awareness.on("change", update);
    room.offs.push(() => room.awareness.off("change", update));
    update();
  }

  private watchFocus(room: ActiveRoom, editor: Editor) {
    const wm = getWindowManager(editor);
    room.offs.push(
      react("collab.focus", () => {
        const id = wm.focusedId.get();
        const w = id ? wm.getWindow(id) : undefined;
        const ref = w ? parseFileRef(w.props.content) : null;
        const file = ref ? `${ref.project}:${ref.path}` : null;
        room.awareness.setLocalStateField("focus", { window: id, file });
      })
    );
  }

  private watchAgent(room: ActiveRoom) {
    const publish = () => {
      const client = getBridgeClient();
      room.awareness.setLocalStateField(
        "agent",
        client?.status.get() === "connected"
      );
    };
    const client = getBridgeClient();
    if (client) room.offs.push(client.status.subscribe(publish));
    else {
      // The bridge client installs right after the desktop mounts; poll briefly.
      const t = setInterval(() => {
        const c = getBridgeClient();
        if (!c) return;
        clearInterval(t);
        room.offs.push(c.status.subscribe(publish));
        publish();
      }, 500);
      room.offs.push(() => clearInterval(t));
    }
    publish();
  }

  // ----- url --------------------------------------------------------------------

  private writeUrl(link: string | null) {
    if (typeof window === "undefined" || !window.history?.replaceState) return;
    try {
      const url = new URL(window.location.href);
      if (link) {
        const target = new URL(link);
        url.search = target.search;
      } else {
        url.searchParams.delete("room");
        url.searchParams.delete("sync");
      }
      window.history.replaceState(null, "", url.toString());
    } catch {
      // Not in a browser with a mutable URL.
    }
  }
}

function waitForMeta(doc: Y.Doc): Promise<void> {
  return new Promise((resolve) => {
    if (roomProjectMeta(doc)) return resolve();
    const meta = doc.getMap<string>("meta");
    const check = () => {
      if (roomProjectMeta(doc)) {
        meta.unobserve(check);
        resolve();
      }
    };
    meta.observe(check);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let session: CollabSession | null = null;

/** The app-wide room session (created on first use). */
export function getCollabSession(): CollabSession {
  if (!session) session = new CollabSession();
  return session;
}
