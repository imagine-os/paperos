/**
 * The Canvas API: a typed facade over the desktop for scripts, plugins and
 * agents. Every method returns plain JSON-serializable data and throws an
 * `Error` with a readable message on bad input. The surface is described in
 * `schema.ts`; keep the two in step (the docs and the MCP tools come from
 * the schema).
 */
import type { BindingIndex } from "@/data/bindings";
import type { Renames } from "@/data/migrate";
import type { QueryOptions, QueryResult } from "@/data/query";
import type { DataSchema, Row, RowId } from "@/data/schema";
import type { TableInfo } from "@/data/store";
import { normalizePath } from "@/ide/project/paths";
import { collectWindowIds } from "@/wm/tree";
import type { LayoutNode, LayoutPreset, Rect, Side } from "@/wm/types";
import type { CanvasEvent, EventBus } from "./events";
import type {
  CanvasHost,
  FlowRecord,
  MapRecord,
  SectionRecord,
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
        if (s === "sample") {
          const meta = await host.projects.openSample();
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
            `No project "${s}". Use 'sample', a github.com URL, or one of: ${host.projects
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
