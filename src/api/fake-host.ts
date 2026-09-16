/**
 * An in-memory `CanvasHost` for tests: windows are plain records, the layout
 * is a real tree from the pure engine, files live in a Map.
 */
import { buildPreset } from "@/wm/presets";
import { insertWindow, removeWindow, swapWindows } from "@/wm/operations";
import { collectWindowIds, findLeaf } from "@/wm/tree";
import type { LayoutNode, LayoutPreset, Rect } from "@/wm/types";
import type {
  CanvasHost,
  CommandRecord,
  ProjectRecord,
  WindowRecord,
  WorkspaceRecord,
} from "./host";

export interface FakeHost extends CanvasHost {
  state: {
    windows: WindowRecord[];
    focused: string | null;
    preset: LayoutPreset;
    root: LayoutNode | null;
    region: Rect | null;
    workspaces: WorkspaceRecord[];
    activeWorkspace: string | null;
    projects: ProjectRecord[];
    activeProject: string | null;
    files: Map<string, Map<string, string | null>>;
    console: { level: string; text: string }[];
    commands: CommandRecord[];
    ran: { id: string; args?: Record<string, unknown> }[];
    camera: { x: number; y: number; z: number };
    previewReloads: number;
    previewEntry: string | null;
    opened: { project: string; path: string; kind: string }[];
    log: string[];
  };
}

export function fakeHost(): FakeHost {
  let counter = 0;
  const state: FakeHost["state"] = {
    windows: [],
    focused: null,
    preset: "free",
    root: null,
    region: null,
    workspaces: [
      { id: "ws_desk", name: "Desk", preset: "free", windowIds: [] },
    ],
    activeWorkspace: null,
    projects: [
      { id: "prj_1", name: "Sample site", source: "sample", backend: "memory" },
    ],
    activeProject: "prj_1",
    files: new Map([
      [
        "prj_1",
        new Map<string, string | null>([
          ["index.html", "<h1>Hi</h1>"],
          ["app.js", "console.log(1)"],
          ["docs", null],
          ["docs/README.md", "# Readme"],
        ]),
      ],
    ]),
    console: [],
    commands: [
      { id: "view.toggle-theme", title: "Toggle theme", group: "View" },
    ],
    ran: [],
    camera: { x: 0, y: 0, z: 1 },
    previewReloads: 0,
    previewEntry: null,
    opened: [],
    log: [],
  };

  const win = (id: string) => state.windows.find((w) => w.id === id);
  const applyTiled = () => {
    const tiled = new Set(collectWindowIds(state.root));
    for (const w of state.windows) w.tiled = tiled.has(w.id);
  };
  const rebuild = (ids: string[]) => {
    const preset = state.preset === "free" ? "columns" : state.preset;
    state.preset = preset;
    state.root = buildPreset(preset, ids);
    if (!state.region) state.region = { x: 0, y: 0, w: 1200, h: 800 };
    applyTiled();
  };
  const files = (p: string) => {
    const m = state.files.get(p);
    if (!m) throw new Error("Project is not accessible");
    return m;
  };

  const host: FakeHost = {
    state,
    windows: {
      list: () => [...state.windows],
      get: (id) => win(id),
      kinds: () => ["note", "editor", "files", "preview", "script"],
      create(o) {
        const id = `shape:w${++counter}`;
        state.windows.push({
          id,
          kind: o.kind,
          title: o.title ?? o.kind,
          content: o.content ?? "",
          x: o.at?.x ?? 100 * counter,
          y: o.at?.y ?? 100 * counter,
          w: o.size?.w ?? 480,
          h: o.size?.h ?? 320,
          tiled: false,
        });
        state.focused = id;
        return id;
      },
      update(id, patch) {
        Object.assign(win(id)!, patch);
      },
      close(id) {
        state.windows = state.windows.filter((w) => w.id !== id);
        state.root = removeWindow(state.root, id);
        if (state.focused === id) state.focused = null;
        applyTiled();
      },
      focus(id) {
        state.focused = id;
        const i = state.windows.findIndex((w) => w.id === id);
        state.windows.push(...state.windows.splice(i, 1));
      },
      focusedId: () => state.focused,
    },
    layout: {
      preset: () => state.preset,
      root: () => state.root,
      region: () => state.region,
      applyPreset(p) {
        state.preset = p;
        state.root =
          p === "free"
            ? null
            : buildPreset(
                p,
                state.windows.map((w) => w.id)
              );
        if (state.root && !state.region)
          state.region = { x: 0, y: 0, w: 1200, h: 800 };
        applyTiled();
      },
      tile(id, side, target) {
        if (!side) {
          if (findLeaf(state.root, id)) return;
          rebuild([...collectWindowIds(state.root), id]);
          return;
        }
        const t = target ? (findLeaf(state.root, target)?.id ?? null) : null;
        state.root = insertWindow(state.root, id, t, side);
        state.preset = "split-tree";
        applyTiled();
      },
      tileAll: () => rebuild(state.windows.map((w) => w.id)),
      float(id) {
        state.root = removeWindow(state.root, id);
        applyTiled();
      },
      untileAll() {
        state.preset = "free";
        state.root = null;
        applyTiled();
      },
      swap(a, b) {
        state.root = swapWindows(state.root, a, b);
      },
    },
    workspaces: {
      list: () => [...state.workspaces],
      activeId: () => state.activeWorkspace,
      save(name) {
        const existing = state.workspaces.find(
          (w) => w.name.toLowerCase() === name.toLowerCase()
        );
        const ws: WorkspaceRecord = {
          id: existing?.id ?? `ws_${++counter}`,
          name,
          preset: state.preset,
          windowIds: collectWindowIds(state.root),
        };
        if (existing) Object.assign(existing, { ...ws, name: existing.name });
        else state.workspaces.push(ws);
        state.activeWorkspace = ws.id;
        return existing ?? ws;
      },
      apply(id) {
        state.activeWorkspace = id;
        state.log.push(`apply-workspace:${id}`);
      },
      rename(id, name) {
        state.workspaces.find((w) => w.id === id)!.name = name;
      },
      remove(id) {
        state.workspaces = state.workspaces.filter((w) => w.id !== id);
      },
    },
    projects: {
      list: () => [...state.projects],
      activeId: () => state.activeProject,
      async setActive(id) {
        state.activeProject = id;
      },
      async openSample() {
        const p = {
          id: `prj_n${++counter}`,
          name: "Sample site",
          source: "sample",
          backend: "memory",
        };
        state.projects.push(p);
        state.files.set(p.id, new Map([["index.html", "<h1>Sample</h1>"]]));
        state.activeProject = p.id;
        return p;
      },
      async importGithub(url) {
        const p = {
          id: `prj_n${++counter}`,
          name: url,
          source: `github:${url}`,
          backend: "memory",
        };
        state.projects.push(p);
        state.files.set(p.id, new Map());
        state.activeProject = p.id;
        return p;
      },
    },
    files: {
      async list(p) {
        return [...files(p)].map(([path, text]) => ({
          path,
          type: text === null ? ("dir" as const) : ("file" as const),
        }));
      },
      async read(p, path) {
        const t = files(p).get(path);
        if (t === undefined || t === null) throw new Error(`No file ${path}`);
        return t;
      },
      async write(p, path, text) {
        files(p).set(path, text);
        state.log.push(`write:${path}`);
      },
      async create(p, path, text) {
        files(p).set(path, text);
      },
      async remove(p, path) {
        files(p).delete(path);
      },
      async rename(p, from, to) {
        const m = files(p);
        m.set(to, m.get(from) ?? "");
        m.delete(from);
      },
      open(p, path, kind) {
        state.opened.push({ project: p, path, kind });
        return host.windows.create({
          kind,
          title: path,
          content: JSON.stringify({ project: p, path }),
        });
      },
    },
    preview: {
      reload() {
        state.previewReloads++;
        return state.windows.filter((w) => w.kind === "preview").length;
      },
      setEntry(path) {
        state.previewEntry = path;
        return 1;
      },
    },
    console: {
      log: (level, text) => void state.console.push({ level, text }),
      clear: () => void (state.console = []),
    },
    commands: {
      list: () => [...state.commands],
      async run(id, args) {
        if (!state.commands.some((c) => c.id === id)) return false;
        state.ran.push({ id, args });
        return true;
      },
    },
    canvas: {
      camera: () => ({ ...state.camera }),
      setCamera(c) {
        state.camera = { ...c };
      },
      zoomTo(ids) {
        state.log.push(`zoom:${ids.join(",")}`);
        state.camera = { x: -1, y: -1, z: 0.5 };
      },
      async screenshot(ids, scale) {
        return {
          dataUrl: `data:image/png;base64,${ids.length}x${scale}`,
          width: 10,
          height: 10,
        };
      },
    },
  };
  return host;
}
