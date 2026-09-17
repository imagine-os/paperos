/**
 * The Canvas API: a typed facade over the desktop for scripts, plugins and
 * agents. Every method returns plain JSON-serializable data and throws an
 * `Error` with a readable message on bad input. The surface is described in
 * `schema.ts`; keep the two in step (the docs and the MCP tools come from
 * the schema).
 */
import type { BindingIndex } from "@/data/bindings";
import {
  addBookmark,
  removeBookmark,
  type Bookmark,
} from "@/browser/bookmarks";
import {
  activeTab,
  createState,
  describeTabs,
  goBack,
  goForward,
  navigate as navigateTab,
  reload as reloadTab,
  tabTitle,
} from "@/browser/tabs";
import type { Renames } from "@/data/migrate";
import type { QueryOptions, QueryResult } from "@/data/query";
import type { DataSchema, Row, RowId } from "@/data/schema";
import type { TableInfo } from "@/data/store";
import { normalizePath } from "@/ide/project/paths";
import { isSampleTemplate } from "@/ide/project/types";
import { collectWindowIds } from "@/wm/tree";
import type { LayoutNode, LayoutPreset, Rect, Side } from "@/wm/types";
import type { CanvasEvent, EventBus } from "./events";
import { lineageForPage, type LineageGraph } from "@/lineage/model";
import type { Participant } from "@/collab/participants";
import type { RoomState } from "@/collab/session";
import type {
  BoardOpenRecord,
  BoardRecord,
  CanvasHost,
  RoomOptions,
  FlowRecord,
  LineageFocusRecord,
  LineageOpenRecord,
  MapRecord,
  SectionRecord,
  TourRecord,
  WindowRecord,
} from "./host";
import { LAYOUT_PRESETS, SIDES, type EventName } from "./schema";

export interface WindowInfo extends WindowRecord {
  focused: boolean;
}

export interface LayoutState {
  preset: LayoutPreset;
  root: LayoutNode | null;
  region: Rect | null;
  tiled: string[];
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  preset: LayoutPreset;
  windowCount: number;
  active: boolean;
}

export interface ProjectInfo {
  id: string;
  name: string;
  source: string;
  backend: string;
  active: boolean;
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export interface BrowserTabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface BrowserInfo {
  id: string;
  title: string;
  tabs: BrowserTabInfo[];
}

export interface TerminalInfo {
  id: string;
  title: string;
  backend: "project" | "bridge";
  prompt: string;
  lines: number;
}

export interface RoomApiOptions {
  password?: string;
  transport?: "webrtc" | "websocket";
  url?: string;
}

export interface CreateWindowOptions {
  kind: string;
  title?: string;
  content?: string;
  rect?: Partial<Rect>;
  tiled?: boolean;
}

export interface CanvasApi {
  readonly version: number;
  windows: {
    list(): WindowInfo[];
    get(id: string): WindowInfo | null;
    create(options: CreateWindowOptions): WindowInfo;
    update(id: string, patch: { title?: string; content?: string }): WindowInfo;
    close(id: string): { closed: boolean };
    focus(id: string): WindowInfo;
    move(id: string, x: number, y: number): WindowInfo;
    resize(id: string, w: number, h: number): WindowInfo;
  };
  layout: {
    apply(preset: LayoutPreset): LayoutState;
    tile(ids?: string[]): LayoutState;
    untile(ids?: string[]): LayoutState;
    split(id: string, side: Side, windowId?: string): LayoutState;
    swap(a: string, b: string): LayoutState;
    getTree(): LayoutState;
  };
  workspaces: {
    list(): WorkspaceInfo[];
    save(name: string): WorkspaceInfo;
    switch(idOrName: string): WorkspaceInfo;
    rename(id: string, name: string): WorkspaceInfo;
    delete(id: string): { deleted: boolean };
  };
  projects: {
    list(): ProjectInfo[];
    open(source: string): Promise<ProjectInfo>;
    current(): ProjectInfo | null;
  };
  files: {
    list(): Promise<{ path: string; type: "file" | "dir" }[]>;
    read(path: string): Promise<{ path: string; text: string }>;
    write(path: string, text: string): Promise<{ path: string; size: number }>;
    create(path: string, text?: string): Promise<{ path: string }>;
    delete(path: string): Promise<{ deleted: boolean }>;
    rename(from: string, to: string): Promise<{ path: string }>;
    open(path: string, kind?: "editor" | "markdown"): WindowInfo;
  };
  data: {
    tables(): Promise<TableInfo[]>;
    schema(): Promise<{ tables: DataSchema["tables"]; errors: string[] }>;
    setSchema(
      schema: DataSchema,
      renames?: Renames
    ): Promise<{ steps: string[] }>;
    list(table: string, options?: QueryOptions): Promise<QueryResult>;
    get(table: string, id: RowId): Promise<Row | null>;
    insert(table: string, row: Row): Promise<Row>;
    update(table: string, id: RowId, patch: Row): Promise<Row>;
    delete(
      table: string,
      id: RowId,
      onReferences?: "block" | "nullify" | "cascade"
    ): Promise<{
      deleted: boolean;
      affected: { table: string; column: string; count: number }[];
    }>;
    bindings(
      table?: string
    ): Promise<
      Pick<BindingIndex, "bindings" | "sources" | "unusedTables" | "broken">
    >;
    open(table?: string, kind?: "data" | "schema" | "connections"): WindowInfo;
  };
  flow: {
    connect(
      fromWindowId: string,
      toWindowId: string,
      label?: string
    ): FlowRecord;
    disconnect(id: string, toWindowId?: string): { removed: number };
    list(): FlowRecord[];
  };
  sections: {
    create(title: string, windowIds: string[]): SectionRecord;
    list(): SectionRecord[];
  };
  map: {
    generate(): Promise<MapRecord>;
    regenerate(): Promise<MapRecord>;
  };
  boards: {
    list(): Promise<BoardRecord[]>;
    open(
      name: string,
      options?: { origin?: { x: number; y: number } }
    ): Promise<BoardOpenRecord>;
    save(name: string, title?: string): Promise<BoardRecord>;
    play(name?: string, step?: number): Promise<TourRecord | null>;
    step(delta?: number): TourRecord | null;
    stop(): { stopped: boolean };
  };
  lineage: {
    graph(page?: string | null): Promise<LineageGraph>;
    open(options?: { page?: string | null }): Promise<LineageOpenRecord>;
    focus(page?: string | null): Promise<LineageFocusRecord>;
  };
  browser: {
    open(options?: { url?: string; title?: string }): BrowserInfo;
    navigate(url: string, id?: string): BrowserInfo;
    back(id?: string): BrowserInfo;
    forward(id?: string): BrowserInfo;
    reload(id?: string): BrowserInfo;
    tabs(id?: string): BrowserInfo[];
    bookmarks(): Promise<Bookmark[]>;
    bookmark(bookmark: {
      url: string;
      title?: string;
      remove?: boolean;
    }): Promise<Bookmark[]>;
  };
  terminal: {
    open(options?: { title?: string; run?: string[] }): TerminalInfo;
    run(
      command: string,
      id?: string
    ): Promise<{ output: string; error: boolean; prompt: string }>;
    write(data: string, id?: string): Promise<{ ok: true }>;
    onOutput(
      callback: (text: string, kind: string) => void,
      id?: string
    ): () => void;
    list(): TerminalInfo[];
  };
  collab: {
    create(options?: RoomApiOptions & { id?: string }): Promise<RoomState>;
    join(room: string, options?: RoomApiOptions): Promise<RoomState>;
    leave(): { left: boolean };
    status(): RoomState;
    participants(): Participant[];
    setName(name: string): { id: string; name: string; color: string };
  };
  preview: {
    reload(): { reloaded: number };
    setEntry(path: string): { entry: string };
  };
  console: {
    log(text: string, level?: string): { ok: true };
    clear(): { ok: true };
  };
  commands: {
    list(): { id: string; title: string; group: string; shortcut?: string }[];
    run(id: string, args?: Record<string, unknown>): Promise<{ ran: boolean }>;
  };
  canvas: {
    camera(): Camera;
    setCamera(camera: Partial<Camera>): Camera;
    zoomTo(ids?: string[]): Camera;
    screenshot(options?: {
      ids?: string[];
      scale?: number;
    }): Promise<{ dataUrl: string; width: number; height: number }>;
  };
  events: {
    on(
      name: EventName | "*",
      callback: (event: CanvasEvent) => void
    ): () => void;
    list(): string[];
    poll(since?: number): { events: CanvasEvent[]; cursor: number };
  };
}

export const WINDOW_MIN_SIZE = { w: 240, h: 160 };

const CONSOLE_LEVELS = ["log", "info", "warn", "error", "debug", "system"];
const ON_REFERENCES = ["block", "nullify", "cascade"] as const;
const DATA_KINDS = ["data", "schema", "connections"] as const;

function fail(message: string): never {
  throw new Error(message);
}

function expectString(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0)
    fail(`${what} must be a non-empty string`);
  return value;
}

function expectNumber(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    fail(`${what} must be a finite number`);
  return value;
}

/** Accepts ids with or without tldraw's "shape:" prefix. */
export function normalizeWindowId(id: unknown): string {
  const s = expectString(id, "id");
  return s.startsWith("shape:") ? s : `shape:${s}`;
}

export function createCanvasApi(host: CanvasHost, events: EventBus): CanvasApi {
  const info = (w: WindowRecord): WindowInfo => ({
    ...w,
    focused: host.windows.focusedId() === w.id,
  });

  const requireWindow = (id: unknown): WindowRecord => {
    const nid = normalizeWindowId(id);
    return host.windows.get(nid) ?? fail(`No window with id "${nid}"`);
  };

  const layoutState = (): LayoutState => {
    const root = host.layout.root();
    return {
      preset: host.layout.preset(),
      root,
      region: host.layout.region(),
      tiled: collectWindowIds(root),
    };
  };

  const workspaceInfo = (id: string): WorkspaceInfo => {
    const ws =
      host.workspaces.list().find((w) => w.id === id) ??
      fail(`No workspace with id "${id}"`);
    return {
      id: ws.id,
      name: ws.name,
      preset: ws.preset,
      windowCount: ws.windowIds.length,
      active: host.workspaces.activeId() === ws.id,
    };
  };

  const projectInfo = (id: string): ProjectInfo => {
    const p =
      host.projects.list().find((x) => x.id === id) ??
      fail(`No project with id "${id}"`);
    return { ...p, active: host.projects.activeId() === p.id };
  };

  const browserInfo = (id: string): BrowserInfo => {
    const state = host.browser.state(id);
    return {
      id,
      title: host.windows.get(id)?.title ?? tabTitle(activeTab(state)),
      tabs: describeTabs(state),
    };
  };

  /** The Browser window `id` names (any window id form), else the focused / first one; null when none. */
  const resolveBrowser = (id: unknown): string | null => {
    if (id === undefined || id === null) return host.browser.resolve();
    const w = requireWindow(id);
    if (w.kind !== "browser") fail(`Window "${w.id}" is not a Browser window`);
    return w.id;
  };

  const requireBrowser = (id: unknown): string =>
    resolveBrowser(id) ??
    fail("No Browser window is open (browser.open creates one)");

  const roomOptions = (v: unknown): RoomOptions & { id?: string } => {
    if (v === undefined) return {};
    const o = expectObject(v, "options");
    const out: RoomOptions & { id?: string } = {};
    if (o.password !== undefined)
      out.password = expectString(o.password, "password");
    if (o.transport !== undefined || o.url !== undefined) {
      const kind =
        o.transport === undefined
          ? undefined
          : expectString(o.transport, "transport");
      if (kind !== undefined && kind !== "webrtc" && kind !== "websocket")
        fail(`transport must be "webrtc" or "websocket", got "${kind}"`);
      const url = o.url === undefined ? undefined : expectString(o.url, "url");
      if (url !== undefined && !/^wss?:\/\//.test(url))
        fail("url must start with ws:// or wss://");
      out.transport = { kind, url };
    }
    if (o.id !== undefined) out.id = expectString(o.id, "id");
    return out;
  };

  const terminalInfo = (id: string): TerminalInfo => ({
    id,
    title: host.windows.get(id)?.title ?? "Terminal",
    ...host.terminal.info(id),
  });

  const resolveTerminal = (id: unknown): string | null => {
    if (id === undefined || id === null) return host.terminal.resolve();
    const w = requireWindow(id);
    if (w.kind !== "terminal")
      fail(`Window "${w.id}" is not a Terminal window`);
    return w.id;
  };

  const requireTerminal = (id: unknown): string =>
    resolveTerminal(id) ??
    fail("No Terminal window is open (terminal.open creates one)");

  const requireProject = (): string =>
    host.projects.activeId() ??
    fail("No project is open. Use projects.open('sample') first.");

  const cleanPath = (p: unknown, what = "path"): string => {
    const n = normalizePath(expectString(p, what));
    return n || fail(`${what} must not be empty`);
  };

  const expectObject = (v: unknown, what: string): Record<string, unknown> => {
    if (typeof v !== "object" || v === null || Array.isArray(v))
      fail(`${what} must be an object`);
    return v as Record<string, unknown>;
  };

  /** `pages/home.json`, `home.json` or `home` -> `home`. */
  const expectPageName = (v: unknown): string => {
    const s = expectString(v, "page")
      .replace(/^pages\//, "")
      .replace(/\.json$/, "");
    if (!s) fail("page must not be empty");
    return s;
  };
  const expectBoardName = (v: unknown): string => {
    const n = expectString(v, "name")
      .replace(/^boards\//, "")
      .replace(/\.json$/, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(n))
      fail(`"${n}" is not a board name (letters, digits, - and _)`);
    return n;
  };

  const expectId = (v: unknown): RowId => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.length > 0) return v;
    return fail("id must be a non-empty string or a number");
  };

  const api: CanvasApi = {
    version: 1,

    windows: {
      list: () => host.windows.list().map(info),
      get(id) {
        const w = host.windows.get(normalizeWindowId(id));
        return w ? info(w) : null;
      },
      create(options) {
        if (!options || typeof options !== "object")
          fail("windows.create needs an options object, e.g. {kind: 'note'}");
        const kind = expectString(options.kind, "kind");
        const kinds = host.windows.kinds();
        if (!kinds.includes(kind))
          fail(`Unknown window kind "${kind}". Known: ${kinds.join(", ")}`);
        const rect = options.rect;
        const at =
          rect && typeof rect.x === "number" && typeof rect.y === "number"
            ? { x: rect.x, y: rect.y }
            : undefined;
        const size =
          rect && typeof rect.w === "number" && typeof rect.h === "number"
            ? {
                w: Math.max(WINDOW_MIN_SIZE.w, rect.w),
                h: Math.max(WINDOW_MIN_SIZE.h, rect.h),
              }
            : undefined;
        const id = host.windows.create({
          kind,
          title: options.title,
          content: options.content,
          at,
          size,
        });
        if (options.tiled) host.layout.tile(id);
        return info(requireWindow(id));
      },
      update(id, patch) {
        const w = requireWindow(id);
        if (!patch || typeof patch !== "object")
          fail("patch must be an object");
        const clean: { title?: string; content?: string } = {};
        if (patch.title !== undefined)
          clean.title = expectString(patch.title, "title");
        if (patch.content !== undefined) {
          if (typeof patch.content !== "string")
            fail("content must be a string");
          clean.content = patch.content;
        }
        host.windows.update(w.id, clean);
        return info(requireWindow(w.id));
      },
      close(id) {
        const w = host.windows.get(normalizeWindowId(id));
        if (!w) return { closed: false };
        host.windows.close(w.id);
        return { closed: true };
      },
      focus(id) {
        const w = requireWindow(id);
        host.windows.focus(w.id);
        return info(requireWindow(w.id));
      },
      move(id, x, y) {
        const w = requireWindow(id);
        const nx = expectNumber(x, "x");
        const ny = expectNumber(y, "y");
        if (w.tiled) host.layout.float(w.id);
        host.windows.update(w.id, { x: nx, y: ny });
        return info(requireWindow(w.id));
      },
      resize(id, w, h) {
        const win = requireWindow(id);
        const nw = Math.max(WINDOW_MIN_SIZE.w, expectNumber(w, "w"));
        const nh = Math.max(WINDOW_MIN_SIZE.h, expectNumber(h, "h"));
        if (win.tiled) host.layout.float(win.id);
        host.windows.update(win.id, { w: nw, h: nh });
        return info(requireWindow(win.id));
      },
    },

    layout: {
      apply(preset) {
        if (!(LAYOUT_PRESETS as readonly string[]).includes(preset))
          fail(
            `Unknown preset "${preset}". Known: ${LAYOUT_PRESETS.join(", ")}`
          );
        host.layout.applyPreset(preset);
        return layoutState();
      },
      tile(ids) {
        if (ids === undefined) {
          host.layout.tileAll();
        } else {
          if (!Array.isArray(ids)) fail("ids must be an array of window ids");
          for (const id of ids) host.layout.tile(requireWindow(id).id);
        }
        return layoutState();
      },
      untile(ids) {
        if (ids === undefined) {
          host.layout.untileAll();
        } else {
          if (!Array.isArray(ids)) fail("ids must be an array of window ids");
          for (const id of ids) host.layout.float(requireWindow(id).id);
        }
        return layoutState();
      },
      split(id, side, windowId) {
        const target = requireWindow(id);
        if (!(SIDES as readonly string[]).includes(side))
          fail(`side must be one of ${SIDES.join(", ")}`);
        const other =
          windowId === undefined
            ? host.windows.create({ kind: "note" })
            : requireWindow(windowId).id;
        if (other === target.id)
          fail("A window cannot be split next to itself");
        if (!target.tiled) host.layout.tile(target.id);
        host.layout.tile(other, side, target.id);
        return layoutState();
      },
      swap(a, b) {
        const wa = requireWindow(a);
        const wb = requireWindow(b);
        if (!wa.tiled || !wb.tiled)
          fail("Both windows must be tiled to swap them");
        host.layout.swap(wa.id, wb.id);
        return layoutState();
      },
      getTree: layoutState,
    },

    workspaces: {
      list: () => host.workspaces.list().map((w) => workspaceInfo(w.id)),
      save(name) {
        const ws = host.workspaces.save(expectString(name, "name").trim());
        return workspaceInfo(ws.id);
      },
      switch(idOrName) {
        const key = expectString(idOrName, "idOrName");
        const ws =
          host.workspaces.list().find((w) => w.id === key) ??
          host.workspaces
            .list()
            .find((w) => w.name.toLowerCase() === key.toLowerCase()) ??
          fail(`No workspace "${key}"`);
        host.workspaces.apply(ws.id);
        return workspaceInfo(ws.id);
      },
      rename(id, name) {
        const ws = workspaceInfo(expectString(id, "id"));
        host.workspaces.rename(ws.id, expectString(name, "name").trim());
        return workspaceInfo(ws.id);
      },
      delete(id) {
        const key = expectString(id, "id");
        if (!host.workspaces.list().some((w) => w.id === key))
          return { deleted: false };
        host.workspaces.remove(key);
        return { deleted: true };
      },
    },

    projects: {
      list: () => host.projects.list().map((p) => projectInfo(p.id)),
      async open(source) {
        const s = expectString(source, "source").trim();
        if (isSampleTemplate(s)) {
          const meta = await host.projects.openSample(s);
          return projectInfo(meta.id);
        }
        if (/github\.com\//i.test(s)) {
          const meta = await host.projects.importGithub(s);
          return projectInfo(meta.id);
        }
        const known =
          host.projects.list().find((p) => p.id === s) ??
          host.projects
            .list()
            .find((p) => p.name.toLowerCase() === s.toLowerCase()) ??
          fail(
            `No project "${s}". Use 'sample', 'saas', a github.com URL, or one of: ${host.projects
              .list()
              .map((p) => p.name)
              .join(", ")}`
          );
        await host.projects.setActive(known.id);
        return projectInfo(known.id);
      },
      current() {
        const id = host.projects.activeId();
        return id ? projectInfo(id) : null;
      },
    },

    files: {
      async list() {
        return host.files.list(requireProject());
      },
      async read(path) {
        const p = cleanPath(path);
        return { path: p, text: await host.files.read(requireProject(), p) };
      },
      async write(path, text) {
        const p = cleanPath(path);
        if (typeof text !== "string") fail("text must be a string");
        await host.files.write(requireProject(), p, text);
        return { path: p, size: text.length };
      },
      async create(path, text = "") {
        const p = cleanPath(path);
        if (typeof text !== "string") fail("text must be a string");
        await host.files.create(requireProject(), p, text);
        return { path: p };
      },
      async delete(path) {
        const p = cleanPath(path);
        await host.files.remove(requireProject(), p);
        return { deleted: true };
      },
      async rename(from, to) {
        const f = cleanPath(from, "from");
        const t = cleanPath(to, "to");
        await host.files.rename(requireProject(), f, t);
        return { path: t };
      },
      open(path, kind = "editor") {
        const p = cleanPath(path);
        if (kind !== "editor" && kind !== "markdown")
          fail("kind must be 'editor' or 'markdown'");
        const id = host.files.open(requireProject(), p, kind);
        return info(requireWindow(id));
      },
    },

    data: {
      tables: async () => host.data.tables(requireProject()),
      schema: async () => host.data.schema(requireProject()),
      async setSchema(schema, renames) {
        const s = expectObject(schema, "schema");
        if (!Array.isArray(s.tables)) fail("schema.tables must be an array");
        if (renames !== undefined) expectObject(renames, "renames");
        const steps = await host.data.setSchema(
          requireProject(),
          s as unknown as DataSchema,
          renames
        );
        return { steps };
      },
      async list(table, options = {}) {
        const t = expectString(table, "table");
        const o = expectObject(options, "options");
        return host.data.list(requireProject(), t, o as QueryOptions);
      },
      async get(table, id) {
        return host.data.get(
          requireProject(),
          expectString(table, "table"),
          expectId(id)
        );
      },
      async insert(table, row) {
        return host.data.insert(
          requireProject(),
          expectString(table, "table"),
          expectObject(row, "row")
        );
      },
      async update(table, id, patch) {
        return host.data.update(
          requireProject(),
          expectString(table, "table"),
          expectId(id),
          expectObject(patch, "patch")
        );
      },
      async delete(table, id, onReferences) {
        if (
          onReferences !== undefined &&
          !(ON_REFERENCES as readonly string[]).includes(onReferences)
        )
          fail(`onReferences must be one of ${ON_REFERENCES.join(", ")}`);
        return host.data.remove(
          requireProject(),
          expectString(table, "table"),
          expectId(id),
          onReferences
        );
      },
      async bindings(table) {
        const index = await host.data.bindings(requireProject());
        if (table === undefined)
          return {
            bindings: index.bindings,
            sources: index.sources,
            unusedTables: index.unusedTables,
            broken: index.broken,
          };
        const t = expectString(table, "table");
        return {
          bindings: index.bindings.filter((b) => b.table === t),
          sources: index.sources.filter(
            (s) => s.tables.includes(t) || s.indirect.some((i) => i.table === t)
          ),
          unusedTables: index.unusedTables.filter((u) => u === t),
          broken: index.broken.filter((p) => p.binding.table === t),
        };
      },
      open(table, kind = "data") {
        if (!(DATA_KINDS as readonly string[]).includes(kind))
          fail(`kind must be one of ${DATA_KINDS.join(", ")}`);
        const t =
          table === undefined ? undefined : expectString(table, "table");
        const id = host.data.open(requireProject(), t, kind);
        return info(requireWindow(id));
      },
    },

    flow: {
      connect(fromWindowId, toWindowId, label) {
        const from = requireWindow(fromWindowId);
        const to = requireWindow(toWindowId);
        if (from.id === to.id) fail("A window cannot be connected to itself");
        if (label !== undefined && typeof label !== "string")
          fail("label must be a string");
        return host.flow.connect(from.id, to.id, label);
      },
      disconnect(id, toWindowId) {
        const a = expectString(id, "id");
        const first = a.startsWith("shape:") ? a : `shape:${a}`;
        if (toWindowId === undefined)
          return { removed: host.flow.disconnect(first) };
        return {
          removed: host.flow.disconnect(
            requireWindow(first).id,
            requireWindow(toWindowId).id
          ),
        };
      },
      list: () => host.flow.list(),
    },

    sections: {
      create(title, windowIds) {
        const t = expectString(title, "title").trim();
        if (!Array.isArray(windowIds) || windowIds.length === 0)
          fail("windowIds must be a non-empty array of window ids");
        return host.sections.create(
          t,
          windowIds.map((id) => requireWindow(id).id)
        );
      },
      list: () => host.sections.list(),
    },

    map: {
      async generate() {
        return host.map.generate(requireProject(), false);
      },
      async regenerate() {
        return host.map.generate(requireProject(), true);
      },
    },

    boards: {
      async list() {
        return host.boards.list(requireProject());
      },
      async open(name, options = {}) {
        const n = expectBoardName(name);
        if (options !== null && typeof options !== "object")
          fail("options must be an object");
        const o = options.origin;
        const origin =
          o === undefined
            ? undefined
            : {
                x: expectNumber(o.x, "origin.x"),
                y: expectNumber(o.y, "origin.y"),
              };
        const result = await host.boards.open(requireProject(), n, origin);
        events.emit("board.opened", {
          name: result.name,
          sections: result.sections,
          windows: result.windows,
        });
        return result;
      },
      async save(name, title) {
        const n = expectBoardName(name);
        if (title !== undefined) expectString(title, "title");
        return host.boards.save(requireProject(), n, title);
      },
      async play(name, step = 0) {
        const n = name === undefined ? undefined : expectBoardName(name);
        return host.boards.play(
          requireProject(),
          n,
          Math.trunc(expectNumber(step, "step"))
        );
      },
      step(delta = 1) {
        return host.boards.step(Math.trunc(expectNumber(delta, "delta")));
      },
      stop: () => ({ stopped: host.boards.stop() }),
    },

    lineage: {
      async graph(page = null) {
        const graph = await host.lineage.graph(requireProject());
        if (page === null) return graph;
        const n = expectPageName(page);
        if (!graph.pages.some((p) => p.name === n))
          fail(
            `No page "${n}". Pages: ${graph.pages.map((p) => p.name).join(", ")}`
          );
        return lineageForPage(graph, n);
      },
      async open(options = {}) {
        if (options === null || typeof options !== "object")
          fail("options must be an object");
        const page =
          options.page === undefined || options.page === null
            ? null
            : expectPageName(options.page);
        const result = await host.lineage.open(requireProject(), page);
        events.emit("board.opened", {
          name: result.name,
          sections: result.sections,
          windows: result.windows,
        });
        return result;
      },
      async focus(page = null) {
        return host.lineage.focus(
          requireProject(),
          page === null ? null : expectPageName(page)
        );
      },
    },

    browser: {
      open(options = {}) {
        if (typeof options !== "object" || options === null)
          fail("options must be an object");
        const url =
          options.url === undefined
            ? "paperos://preview/"
            : expectString(options.url, "url");
        const title =
          options.title === undefined
            ? undefined
            : expectString(options.title, "title");
        const id = host.browser.open(createState(url), title);
        return browserInfo(id);
      },
      navigate(url, id) {
        const u = expectString(url, "url");
        const wid = resolveBrowser(id);
        if (!wid) return browserInfo(host.browser.open(createState(u)));
        host.browser.setState(wid, navigateTab(host.browser.state(wid), u));
        return browserInfo(wid);
      },
      back(id) {
        const wid = requireBrowser(id);
        host.browser.setState(wid, goBack(host.browser.state(wid)));
        return browserInfo(wid);
      },
      forward(id) {
        const wid = requireBrowser(id);
        host.browser.setState(wid, goForward(host.browser.state(wid)));
        return browserInfo(wid);
      },
      reload(id) {
        const wid = requireBrowser(id);
        host.browser.setState(wid, reloadTab(host.browser.state(wid)));
        return browserInfo(wid);
      },
      tabs(id) {
        if (id === undefined) return host.browser.list().map(browserInfo);
        return [browserInfo(requireBrowser(id))];
      },
      bookmarks: () => host.browser.bookmarks(requireProject()),
      async bookmark(bookmark) {
        if (typeof bookmark !== "object" || bookmark === null)
          fail("bookmark must be an object");
        const url = expectString(bookmark.url, "url");
        const project = requireProject();
        const list = await host.browser.bookmarks(project);
        const next = bookmark.remove
          ? removeBookmark(list, url)
          : addBookmark(list, {
              url,
              title: typeof bookmark.title === "string" ? bookmark.title : "",
            });
        await host.browser.setBookmarks(project, next);
        return next;
      },
    },

    terminal: {
      open(options = {}) {
        if (typeof options !== "object" || options === null)
          fail("options must be an object");
        const title =
          options.title === undefined
            ? undefined
            : expectString(options.title, "title");
        if (
          options.run !== undefined &&
          (!Array.isArray(options.run) ||
            options.run.some((r) => typeof r !== "string"))
        )
          fail("run must be an array of strings");
        const content = JSON.stringify({
          backend: "project",
          ...(options.run ? { run: options.run } : {}),
        });
        return terminalInfo(host.terminal.open(content, title));
      },
      async run(command, id) {
        const line = expectString(command, "command");
        const tid =
          resolveTerminal(id) ??
          host.terminal.open(JSON.stringify({ backend: "project" }));
        const result = await host.terminal.run(tid, line);
        return { ...result, prompt: host.terminal.info(tid).prompt };
      },
      async write(data, id) {
        if (typeof data !== "string") fail("data must be a string");
        await host.terminal.write(requireTerminal(id), data);
        return { ok: true };
      },
      onOutput(callback, id) {
        if (typeof callback !== "function") fail("callback must be a function");
        return host.terminal.onOutput(requireTerminal(id), callback);
      },
      list: () => host.terminal.list().map(terminalInfo),
    },

    collab: {
      async create(options) {
        return host.collab.create(roomOptions(options));
      },
      async join(room, options) {
        const r = expectString(room, "room").trim();
        if (!r) fail("room must not be empty");
        return host.collab.join(r, roomOptions(options));
      },
      leave: () => ({ left: host.collab.leave() }),
      status: () => host.collab.status(),
      participants: () => host.collab.participants(),
      setName(name) {
        const n = expectString(name, "name").trim();
        if (!n) fail("name must not be empty");
        if (n.length > 40) fail("name must be at most 40 characters");
        return host.collab.setName(n);
      },
    },

    preview: {
      reload: () => ({ reloaded: host.preview.reload() }),
      setEntry(path) {
        const p = cleanPath(path);
        host.preview.setEntry(p);
        return { entry: p };
      },
    },

    console: {
      log(text, level = "log") {
        if (!CONSOLE_LEVELS.includes(level))
          fail(`level must be one of ${CONSOLE_LEVELS.join(", ")}`);
        host.console.log(level, typeof text === "string" ? text : String(text));
        return { ok: true };
      },
      clear() {
        host.console.clear();
        return { ok: true };
      },
    },

    commands: {
      list: () => host.commands.list(),
      async run(id, args) {
        const cid = expectString(id, "id");
        if (args !== undefined && (typeof args !== "object" || args === null))
          fail("args must be an object");
        return { ran: await host.commands.run(cid, args) };
      },
    },

    canvas: {
      camera: () => ({ ...host.canvas.camera() }),
      setCamera(camera) {
        if (!camera || typeof camera !== "object")
          fail("camera must be an object");
        const current = host.canvas.camera();
        const next = {
          x: camera.x === undefined ? current.x : expectNumber(camera.x, "x"),
          y: camera.y === undefined ? current.y : expectNumber(camera.y, "y"),
          z: camera.z === undefined ? current.z : expectNumber(camera.z, "z"),
        };
        if (next.z <= 0) fail("z (zoom) must be positive");
        host.canvas.setCamera(next);
        return { ...host.canvas.camera() };
      },
      zoomTo(ids) {
        const list =
          ids === undefined
            ? host.windows.list().map((w) => w.id)
            : (Array.isArray(ids) ? ids : fail("ids must be an array")).map(
                (id) => requireWindow(id).id
              );
        if (list.length) host.canvas.zoomTo(list);
        return { ...host.canvas.camera() };
      },
      async screenshot(options = {}) {
        const ids =
          options.ids === undefined
            ? host.windows.list().map((w) => w.id)
            : options.ids.map((id) => requireWindow(id).id);
        if (ids.length === 0) fail("Nothing to capture: there are no windows");
        const scale =
          options.scale === undefined
            ? 0.5
            : expectNumber(options.scale, "scale");
        if (scale <= 0 || scale > 4) fail("scale must be between 0 and 4");
        return host.canvas.screenshot(ids, scale);
      },
    },

    events: {
      on(name, callback) {
        if (typeof callback !== "function") fail("callback must be a function");
        return events.on(name, callback);
      },
      list: () => events.names(),
      poll(since = 0) {
        return events.poll(expectNumber(since, "since"));
      },
    },
  };
  return api;
}
