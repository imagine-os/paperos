/**
 * An in-memory `CanvasHost` for tests: windows are plain records, the layout
 * is a real tree from the pure engine, files live in a Map.
 */
import { scanBindings } from "@/data/bindings";
import { describeStep } from "@/data/migrate";
import { DataStore, type DataFs } from "@/data/store";
import { buildPreset } from "@/wm/presets";
import { insertWindow, removeWindow, swapWindows } from "@/wm/operations";
import { collectWindowIds, findLeaf } from "@/wm/tree";
import type { LayoutNode, LayoutPreset, Rect } from "@/wm/types";
import { parseComponents } from "@/design/components";
import { parsePage } from "@/design/pages";
import { parseTokens } from "@/design/tokens";
import { layoutMap } from "@/map/layout";
import { buildProjectMap } from "@/map/model";
import type {
  CanvasHost,
  CommandRecord,
  FlowRecord,
  ProjectRecord,
  SectionRecord,
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
    flows: FlowRecord[];
    sections: SectionRecord[];
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
          [
            "data/schema.json",
            JSON.stringify({
              tables: [
                {
                  name: "roles",
                  columns: [
                    { name: "id", type: "number" },
                    { name: "name", type: "string", required: true },
                  ],
                },
                {
                  name: "menu_items",
                  display: "label",
                  columns: [
                    { name: "id", type: "number" },
                    { name: "label", type: "string", required: true },
                    { name: "required_role", type: "ref", ref: "roles" },
                  ],
                },
              ],
            }),
          ],
          ["data/roles.json", JSON.stringify([{ id: 1, name: "Admin" }])],
          [
            "data/menu_items.json",
            JSON.stringify([{ id: 1, label: "Home", required_role: 1 }]),
          ],
          [
            "components/menu.json",
            JSON.stringify({
              bindings: [{ table: "menu_items", fields: ["label", "nope"] }],
            }),
          ],
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
    flows: [],
    sections: [],
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
  const dataStores = new Map<string, DataStore>();
  const dataStore = (p: string) => {
    let s = dataStores.get(p);
    if (!s) {
      const fs: DataFs = {
        list: async () => [...files(p).keys()],
        read: async (path) => files(p).get(path) ?? null,
        write: async (path, text) => void files(p).set(path, text),
        remove: async (path) => void files(p).delete(path),
        rename: async (from, to) => {
          const m = files(p);
          m.set(to, m.get(from) ?? "");
          m.delete(from);
        },
        onChange: () => () => {},
      };
      s = new DataStore(fs);
      dataStores.set(p, s);
    }
    return s;
  };

  const host: FakeHost = {
    state,
    windows: {
      list: () => [...state.windows],
      get: (id) => win(id),
      kinds: () => [
        "note",
        "editor",
        "files",
        "preview",
        "script",
        "data",
        "schema",
        "connections",
        "card",
        "design",
        "pages",
      ],
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
        state.flows = state.flows.filter((f) => f.from !== id && f.to !== id);
        for (const s of state.sections)
          s.windowIds = s.windowIds.filter((w) => w !== id);
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
    data: {
      tables: (p) => dataStore(p).tables(),
      schema: async (p) => ({
        tables: (await dataStore(p).schema()).tables,
        errors: await dataStore(p).schemaErrors(),
      }),
      setSchema: async (p, schema, renames) =>
        (await dataStore(p).setSchema(schema, renames)).map(describeStep),
      list: (p, table, options) => dataStore(p).query(table, options),
      get: (p, table, id) => dataStore(p).get(table, id),
      insert: (p, table, row) => dataStore(p).insert(table, row),
      update: (p, table, id, patch) => dataStore(p).update(table, id, patch),
      remove: (p, table, id, onReferences) =>
        dataStore(p).remove(table, id, { onReferences }),
      async bindings(p) {
        const list = [...files(p)]
          .filter(([path, text]) => text !== null && !path.startsWith("data/"))
          .map(([path, text]) => ({ path, text: text as string }));
        return scanBindings(list, await dataStore(p).schema());
      },
      open(p, table, kind) {
        state.opened.push({ project: p, path: table ?? "", kind });
        return host.windows.create({
          kind,
          title: table ?? kind,
          content: table ?? "",
        });
      },
    },
    flow: {
      connect(from, to, label) {
        const f: FlowRecord = {
          id: `shape:arrow${++counter}`,
          from,
          to,
          label: label ?? "",
        };
        state.flows.push(f);
        return f;
      },
      disconnect(a, b) {
        const before = state.flows.length;
        state.flows = state.flows.filter((f) =>
          b
            ? !((f.from === a && f.to === b) || (f.from === b && f.to === a))
            : f.id !== a
        );
        return before - state.flows.length;
      },
      list: () => [...state.flows],
    },
    sections: {
      create(title, windowIds) {
        const ws = windowIds.map((id) => win(id)!);
        const x = Math.min(...ws.map((w) => w.x)) - 24;
        const y = Math.min(...ws.map((w) => w.y)) - 40;
        const s: SectionRecord = {
          id: `shape:frame${++counter}`,
          title,
          x,
          y,
          w: Math.max(...ws.map((w) => w.x + w.w)) + 24 - x,
          h: Math.max(...ws.map((w) => w.y + w.h)) + 24 - y,
          windowIds: [...windowIds],
        };
        for (const w of ws) w.section = s.id;
        state.sections.push(s);
        return s;
      },
      list: () => state.sections.map((s) => ({ ...s })),
    },
    map: {
      async generate(p, regenerate) {
        const all = [...files(p)].filter(([, t]) => t !== null) as [
          string,
          string,
        ][];
        const schema = await dataStore(p).schema();
        const rowCounts: Record<string, number> = {};
        for (const t of schema.tables)
          rowCounts[t.name] = (await dataStore(p).rows(t.name)).length;
        const tokensText = files(p).get("design/tokens.json");
        const graph = buildProjectMap({
          files: all.map(([path]) => path),
          schema,
          rowCounts,
          bindings: scanBindings(
            all
              .filter(([path]) => !path.startsWith("data/"))
              .map(([path, text]) => ({ path, text })),
            schema
          ),
          components: parseComponents(
            all.map(([path, text]) => ({ path, text }))
          ).components,
          pages: all
            .filter(([path]) => /^pages\/.*\.json$/.test(path))
            .map(([path, text]) => parsePage(text, path).page)
            .filter((pg): pg is NonNullable<typeof pg> => pg !== null),
          tokens: tokensText ? parseTokens(tokensText).tokens : null,
        });
        const cards = state.windows.filter((w) => w.kind === "card");
        const keep: Record<string, { x: number; y: number }> = {};
        if (regenerate)
          for (const c of cards)
            keep[JSON.parse(c.content).key] = { x: c.x, y: c.y };
        state.windows = state.windows.filter((w) => w.kind !== "card");
        state.flows = state.flows.filter((f) => !f.id.startsWith("shape:map"));
        state.sections = state.sections.filter(
          (s) => !s.id.startsWith("shape:map")
        );
        const layout = layoutMap(graph, keep);
        const ids = new Map<string, string>();
        for (const n of layout.nodes) {
          const node = graph.nodes.find((g) => g.key === n.key)!;
          const id = `shape:map${++counter}`;
          ids.set(n.key, id);
          state.windows.push({
            id,
            kind: "card",
            title: node.title,
            content: JSON.stringify({ key: node.key, target: node.target }),
            x: n.x,
            y: n.y,
            w: n.w,
            h: n.h,
            tiled: false,
          });
        }
        for (const s of layout.sections)
          state.sections.push({
            id: `shape:map${++counter}`,
            title: s.title,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
            windowIds: layout.nodes
              .filter((n) => n.section === s.id)
              .map((n) => ids.get(n.key)!),
          });
        for (const e of graph.edges)
          state.flows.push({
            id: `shape:map${++counter}`,
            from: ids.get(e.from)!,
            to: ids.get(e.to)!,
            label: e.label ?? "",
          });
        const ws = host.workspaces.save("Map");
        return {
          sections: layout.sections.length,
          nodes: layout.nodes.length,
          edges: graph.edges.length,
          kept: Object.keys(keep).length,
          bounds: layout.bounds,
          workspace: { id: ws.id, name: ws.name },
        };
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
