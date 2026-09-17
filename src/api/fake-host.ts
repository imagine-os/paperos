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
import { layoutBoard } from "@/boards/layout";
import {
  boardFromPath,
  boardPath,
  parseBoard,
  serializeBoard,
  type BoardDef,
} from "@/boards/model";
import {
  describeStep as describeTourStep,
  moveTour,
  startTour,
  type TourState,
} from "@/boards/tour";
import {
  buildLineage,
  LINEAGE_BOARD,
  lineageBoard,
  lineageFocus,
  lineageForPage,
  lineagePageBoard,
  type LineageInput,
} from "@/lineage/model";
import type {
  BoardOpenRecord,
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
    tour: { board: BoardDef; state: TourState } | null;
    /** Board name per section id, for boards drawn on the fake canvas. */
    boardOf: Map<string, string>;
    lineageFocus: string | null;
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
    tour: null,
    boardOf: new Map(),
    lineageFocus: null,
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

  /** Draws a board on the fake canvas (shared by boards.open and lineage.open). */
  const drawBoard = (
    board: BoardDef,
    origin?: { x: number; y: number }
  ): BoardOpenRecord => {
        // Replace an earlier copy.
        const old = [...state.boardOf.entries()]
          .filter(([, b]) => b === board.name)
          .map(([id]) => id);
        for (const id of old) {
          const sec = state.sections.find((s) => s.id === id);
          if (sec) {
            for (const w of sec.windowIds) host.windows.close(w);
            state.sections = state.sections.filter((s) => s.id !== id);
          }
          state.boardOf.delete(id);
        }
        const layout = layoutBoard(board, { origin: origin ?? { x: 0, y: 0 } });
        const ids = new Map<string, string>();
        for (const s of layout.sections) {
          const id = `shape:board${++counter}`;
          ids.set(s.id, id);
          state.boardOf.set(id, board.name);
          state.sections.push({
            id,
            title: s.title,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
            windowIds: [],
          });
        }
        for (const w of layout.windows) {
          const spec = board.sections
            .flatMap((s) => s.windows)
            .find((x) => x.id === w.id)!;
          const id = host.windows.create({
            kind: spec.kind,
            title: spec.title ?? spec.kind,
            content:
              typeof spec.content === "string"
                ? spec.content
                : JSON.stringify(spec.content ?? ""),
            at: { x: w.x, y: w.y },
            size: { w: w.w, h: w.h },
          });
          const sectionId = ids.get(w.section)!;
          win(id)!.section = sectionId;
          state.sections.find((s) => s.id === sectionId)!.windowIds.push(id);
          ids.set(w.id, id);
        }
        let arrows = 0;
        for (const a of board.arrows) {
          const from = ids.get(a.from);
          const to = ids.get(a.to);
          if (!from || !to) continue;
          state.flows.push({
            id: `shape:board${++counter}`,
            from,
            to,
            label: a.label ?? "",
          });
          arrows++;
        }
        state.camera = { x: -layout.bounds.x, y: -layout.bounds.y, z: 0.25 };
        const ws = host.workspaces.save(`Board: ${board.title}`);
        return {
          name: board.name,
          title: board.title,
          sections: layout.sections.length,
          windows: layout.windows.length,
          arrows,
          bounds: layout.bounds,
          workspace: { id: ws.id, name: ws.name },
        };
        };

  const lineageInput = async (p: string): Promise<LineageInput> => {
    const all = [...files(p)].filter(([, t]) => t !== null) as [
      string,
      string,
    ][];
    const schema = await dataStore(p).schema();
    const rowCounts: Record<string, number> = {};
    for (const t of schema.tables)
      rowCounts[t.name] = (await dataStore(p).rows(t.name)).length;
    return {
      schema,
      rowCounts,
      bindings: scanBindings(
        all
          .filter(([path]) => !path.startsWith("data/"))
          .map(([path, text]) => ({ path, text })),
        schema
      ),
      components: parseComponents(all.map(([path, text]) => ({ path, text })))
        .components,
      pages: all
        .filter(([path]) => /^pages\/.*\.json$/.test(path))
        .map(([path, text]) => parsePage(text, path).page)
        .filter((pg): pg is NonNullable<typeof pg> => pg !== null),
    };
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
    boards: {
      async list(p) {
        const out = [];
        for (const [path, text] of files(p)) {
          if (!boardFromPath(path) || text === null) continue;
          const { board } = parseBoard(text, path);
          if (!board) continue;
          out.push({
            name: board.name,
            title: board.title,
            path,
            sections: board.sections.length,
            windows: board.sections.reduce((n, s) => n + s.windows.length, 0),
            onCanvas: [...state.boardOf.values()].includes(board.name),
          });
        }
        return out;
      },
      async open(p, name, origin) {
        const text = files(p).get(boardPath(name));
        if (text === null || text === undefined)
          throw new Error(`No board "${name}" (${boardPath(name)})`);
        const { board } = parseBoard(text, boardPath(name));
        if (!board) throw new Error(`Cannot read ${boardPath(name)}`);
        return drawBoard(board, origin);
      },
      async save(p, name, title) {
        const board: BoardDef = {
          name,
          title: title ?? name,
          sections: state.sections.map((s) => ({
            id: s.id.replace("shape:", ""),
            title: s.title,
            grid: "free" as const,
            windows: s.windowIds.map((id) => {
              const w = win(id)!;
              return {
                id: id.replace("shape:", ""),
                kind: w.kind,
                title: w.title,
                content: w.content,
                size: { w: w.w, h: w.h },
                at: { x: w.x - s.x, y: w.y - s.y },
              };
            }),
          })),
          arrows: state.flows
            .filter((f) => f.from && f.to)
            .map((f) => ({
              from: f.from!.replace("shape:", ""),
              to: f.to!.replace("shape:", ""),
              label: f.label,
            })),
          steps: [],
        };
        files(p).set(boardPath(name), serializeBoard(board));
        return {
          name,
          title: board.title,
          path: boardPath(name),
          sections: board.sections.length,
          windows: board.sections.reduce((n, s) => n + s.windows.length, 0),
          onCanvas: true,
        };
      },
      async play(p, name, step) {
        const target = name ?? [...state.boardOf.values()][0];
        if (!target) throw new Error("No board on the canvas");
        const text = files(p).get(boardPath(target));
        if (!text) throw new Error(`No board "${target}"`);
        const board = parseBoard(text, boardPath(target)).board!;
        if (![...state.boardOf.values()].includes(target))
          await host.boards.open(p, target);
        const st = startTour(board, step);
        if (!st) return null;
        state.tour = { board, state: st };
        state.log.push(`tour:${target}:${st.step}`);
        return describeTourStep(board, st);
      },
      step(delta) {
        if (!state.tour) return null;
        const next = moveTour(state.tour.state, delta);
        if (!next) {
          state.tour = null;
          return null;
        }
        state.tour.state = next;
        state.log.push(`tour:${next.board}:${next.step}`);
        return describeTourStep(state.tour.board, next);
      },
      stop() {
        const was = state.tour !== null;
        state.tour = null;
        return was;
      },
      current: () =>
        state.tour
          ? describeTourStep(state.tour.board, state.tour.state)
          : null,
    },
    lineage: {
      graph: async (p) => buildLineage(await lineageInput(p)),
      async open(p, page) {
        const graph = buildLineage(await lineageInput(p));
        if (page && !graph.pages.some((x) => x.name === page))
          throw new Error(`No page "${page}"`);
        const board = page ? lineagePageBoard(graph, page) : lineageBoard(graph);
        const result = drawBoard(board);
        state.lineageFocus = null;
        const sub = page ? lineageForPage(graph, page) : graph;
        return {
          ...result,
          page,
          tables: sub.tables.length,
          components: sub.components.length,
          pages: sub.pages.length,
          edges: sub.edges.length,
        };
      },
      async focus(p, page) {
        if (![...state.boardOf.values()].includes(LINEAGE_BOARD))
          throw new Error("The Data lineage board is not open");
        const graph = buildLineage(await lineageInput(p));
        if (page && !graph.pages.some((x) => x.name === page))
          throw new Error(`No page "${page}"`);
        const focus = lineageFocus(graph, page);
        const cards = state.windows.filter((w) => w.kind === "card");
        const keyOf = (id: string) =>
          String(JSON.parse(win(id)?.content || "{}").key ?? "");
        let dimmed = 0;
        for (const c of cards) if (!focus.nodes.has(keyOf(c.id))) dimmed++;
        for (const f of state.flows) {
          if (!f.from || !f.to) continue;
          const from = keyOf(f.from);
          const to = keyOf(f.to);
          if (!from || !to) continue;
          if (![...focus.edges].some((k) => k.startsWith(`${from}>${to}>`)))
            dimmed++;
        }
        state.lineageFocus = page;
        state.log.push(`lineage:${page ?? "all"}`);
        return { page, dimmed, kept: cards.length + state.flows.length - dimmed };
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
