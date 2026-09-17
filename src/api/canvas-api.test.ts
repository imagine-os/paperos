import { describe, expect, it } from "vitest";
import { createCanvasApi, normalizeWindowId } from "./canvas-api";
import { createEventBus } from "./events";
import { fakeHost } from "./fake-host";
import { invokeTool } from "./invoke";
import { TOOLS } from "./schema";

function setup() {
  const host = fakeHost();
  const events = createEventBus(() => 1000);
  const api = createCanvasApi(host, events);
  return { host, events, api };
}

const isPlainJson = (v: unknown) =>
  expect(JSON.parse(JSON.stringify(v ?? null))).toEqual(v ?? null);

describe("windows", () => {
  it("creates, lists, gets, updates, moves, resizes and closes", () => {
    const { api } = setup();
    const w = api.windows.create({ kind: "note", title: "A", content: "hi" });
    expect(w).toMatchObject({
      kind: "note",
      title: "A",
      content: "hi",
      focused: true,
      tiled: false,
    });
    isPlainJson(w);
    expect(api.windows.list()).toHaveLength(1);
    expect(api.windows.get(w.id)?.id).toBe(w.id);
    expect(api.windows.get("shape:nope")).toBeNull();

    expect(api.windows.update(w.id, { title: "B" }).title).toBe("B");
    expect(api.windows.move(w.id, 10, 20)).toMatchObject({ x: 10, y: 20 });
    expect(api.windows.resize(w.id, 100, 100)).toMatchObject({
      w: 240,
      h: 160,
    });
    expect(api.windows.close(w.id)).toEqual({ closed: true });
    expect(api.windows.close(w.id)).toEqual({ closed: false });
    expect(api.windows.list()).toHaveLength(0);
  });

  it("accepts ids without the shape: prefix", () => {
    const { api } = setup();
    const w = api.windows.create({ kind: "note" });
    expect(normalizeWindowId("w1")).toBe("shape:w1");
    expect(api.windows.get(w.id.replace("shape:", ""))?.id).toBe(w.id);
  });

  it("creates with a rect and optionally tiled", () => {
    const { api } = setup();
    const w = api.windows.create({
      kind: "note",
      rect: { x: 5, y: 6, w: 300, h: 200 },
    });
    expect(w).toMatchObject({ x: 5, y: 6, w: 300, h: 200, tiled: false });
    const t = api.windows.create({ kind: "note", tiled: true });
    expect(t.tiled).toBe(true);
    expect(api.layout.getTree().tiled).toEqual([t.id]);
  });

  it("rejects bad input with readable errors", () => {
    const { api } = setup();
    expect(() => api.windows.create({ kind: "bogus" })).toThrow(
      /Unknown window kind "bogus"/
    );
    expect(() => api.windows.focus("shape:x")).toThrow(/No window with id/);
    expect(() => api.windows.move("shape:x", 1, 1)).toThrow(/No window/);
    const w = api.windows.create({ kind: "note" });
    expect(() => api.windows.move(w.id, Number.NaN, 0)).toThrow(
      /x must be a finite number/
    );
    // @ts-expect-error bad patch
    expect(() => api.windows.update(w.id, null)).toThrow(
      /patch must be an object/
    );
  });

  it("floats a tiled window before moving it", () => {
    const { api } = setup();
    const a = api.windows.create({ kind: "note" });
    api.windows.create({ kind: "note" });
    api.layout.apply("columns");
    expect(api.windows.get(a.id)?.tiled).toBe(true);
    const moved = api.windows.move(a.id, 0, 0);
    expect(moved.tiled).toBe(false);
    expect(api.layout.getTree().tiled).not.toContain(a.id);
  });
});

describe("layout", () => {
  it("applies presets, tiles, untiles, splits and swaps", () => {
    const { api } = setup();
    const a = api.windows.create({ kind: "note", title: "a" });
    const b = api.windows.create({ kind: "note", title: "b" });
    const c = api.windows.create({ kind: "note", title: "c" });

    const grid = api.layout.apply("grid");
    expect(grid.preset).toBe("grid");
    expect(grid.tiled.sort()).toEqual([a.id, b.id, c.id].sort());
    isPlainJson(grid);

    expect(api.layout.untile([c.id]).tiled).toEqual([a.id, b.id]);
    expect(api.layout.tile([c.id]).tiled).toHaveLength(3);
    expect(api.layout.untile().tiled).toEqual([]);
    expect(api.layout.getTree().preset).toBe("free");

    expect(api.layout.tile().tiled).toHaveLength(3);
    expect(api.layout.getTree().preset).toBe("columns");

    const swapped = api.layout.swap(a.id, b.id);
    expect(swapped.tiled.indexOf(b.id)).toBeLessThan(
      swapped.tiled.indexOf(a.id)
    );

    const before = api.windows.list().length;
    const split = api.layout.split(a.id, "bottom");
    expect(api.windows.list().length).toBe(before + 1);
    expect(split.preset).toBe("split-tree");
    expect(split.tiled).toHaveLength(4);
  });

  it("validates presets and sides", () => {
    const { api } = setup();
    const a = api.windows.create({ kind: "note" });
    // @ts-expect-error bad preset
    expect(() => api.layout.apply("diagonal")).toThrow(/Unknown preset/);
    // @ts-expect-error bad side
    expect(() => api.layout.split(a.id, "middle")).toThrow(
      /side must be one of/
    );
    expect(() => api.layout.split(a.id, "left", a.id)).toThrow(
      /next to itself/
    );
    expect(() => api.layout.swap(a.id, a.id)).toThrow(/must be tiled/);
  });
});

describe("workspaces, projects and files", () => {
  it("saves, switches by name, renames and deletes workspaces", () => {
    const { api, host } = setup();
    api.windows.create({ kind: "note" });
    api.layout.apply("columns");
    const ws = api.workspaces.save("Mine");
    expect(ws).toMatchObject({
      name: "Mine",
      preset: "columns",
      windowCount: 1,
      active: true,
    });
    expect(api.workspaces.save("mine").id).toBe(ws.id);
    expect(api.workspaces.list().map((w) => w.name)).toEqual(["Desk", "Mine"]);
    expect(api.workspaces.switch("desk").id).toBe("ws_desk");
    expect(host.state.log).toContain("apply-workspace:ws_desk");
    expect(api.workspaces.rename(ws.id, "Ours").name).toBe("Ours");
    expect(api.workspaces.delete(ws.id)).toEqual({ deleted: true });
    expect(api.workspaces.delete(ws.id)).toEqual({ deleted: false });
    expect(() => api.workspaces.switch("nope")).toThrow(/No workspace/);
  });

  it("opens projects by 'sample', GitHub URL or name", async () => {
    const { api } = setup();
    expect(api.projects.current()?.name).toBe("Sample site");
    const sample = await api.projects.open("sample");
    expect(sample.active).toBe(true);
    const gh = await api.projects.open("https://github.com/o/r");
    expect(gh.source).toBe("github:https://github.com/o/r");
    const back = await api.projects.open("prj_1");
    expect(back.id).toBe("prj_1");
    await expect(api.projects.open("nothing")).rejects.toThrow(
      /No project "nothing"/
    );
    expect(api.projects.list().filter((p) => p.active)).toHaveLength(1);
  });

  it("lists, reads, writes, creates, renames, deletes and opens files", async () => {
    const { api, host } = setup();
    expect(await api.files.list()).toContainEqual({
      path: "docs",
      type: "dir",
    });
    expect(await api.files.read("/index.html")).toEqual({
      path: "index.html",
      text: "<h1>Hi</h1>",
    });
    expect(await api.files.write("index.html", "<h1>Yo</h1>")).toEqual({
      path: "index.html",
      size: 11,
    });
    expect(host.state.log).toContain("write:index.html");
    expect(await api.files.create("new.txt")).toEqual({ path: "new.txt" });
    expect(await api.files.rename("new.txt", "old.txt")).toEqual({
      path: "old.txt",
    });
    expect((await api.files.read("old.txt")).text).toBe("");
    expect(await api.files.delete("old.txt")).toEqual({ deleted: true });
    await expect(api.files.read("old.txt")).rejects.toThrow(/No file/);
    await expect(api.files.read("")).rejects.toThrow(/non-empty/);

    const w = api.files.open("app.js");
    expect(w.kind).toBe("editor");
    expect(host.state.opened).toEqual([
      { project: "prj_1", path: "app.js", kind: "editor" },
    ]);
    // @ts-expect-error bad kind
    expect(() => api.files.open("app.js", "pdf")).toThrow(/kind must be/);

    host.state.activeProject = null;
    await expect(api.files.list()).rejects.toThrow(/No project is open/);
  });
});

describe("data", () => {
  it("lists tables, queries, inserts, updates and deletes rows with validation", async () => {
    const { api, host } = setup();
    const tables = await api.data.tables();
    expect(tables.map((t) => [t.name, t.rowCount])).toEqual([
      ["roles", 1],
      ["menu_items", 1],
    ]);
    isPlainJson(tables);
    const schema = await api.data.schema();
    expect(schema.tables[1].columns.map((c) => c.name)).toEqual([
      "id",
      "label",
      "required_role",
    ]);
    expect(schema.errors).toEqual([]);

    const row = await api.data.insert("menu_items", {
      label: "Docs",
      required_role: "1",
    });
    expect(row).toEqual({ id: 2, label: "Docs", required_role: 1 });
    await expect(
      api.data.insert("menu_items", { label: "X", required_role: 9 })
    ).rejects.toThrow(/no roles row/);
    await expect(api.data.insert("menu_items", {})).rejects.toThrow(
      /label is required/
    );
    // @ts-expect-error bad row
    await expect(api.data.insert("menu_items", "nope")).rejects.toThrow(
      /row must be an object/
    );

    const list = await api.data.list("menu_items", {
      filter: "label:doc",
      sort: "-id",
    });
    expect(list).toMatchObject({ total: 1, page: 1, pageCount: 1 });
    expect(list.rows[0].label).toBe("Docs");
    expect((await api.data.list("menu_items")).total).toBe(2);
    expect((await api.data.get("menu_items", "2"))?.label).toBe("Docs");
    expect(await api.data.get("menu_items", 99)).toBeNull();
    await expect(api.data.get("nope", 1)).rejects.toThrow(/No table "nope"/);
    // @ts-expect-error bad id
    await expect(api.data.get("roles", null)).rejects.toThrow(/id must be/);

    expect(
      (await api.data.update("menu_items", 2, { label: "Guides" })).label
    ).toBe("Guides");
    await expect(api.data.delete("roles", 1)).rejects.toThrow(/referenced by/);
    // @ts-expect-error bad mode
    await expect(api.data.delete("roles", 1, "explode")).rejects.toThrow(
      /onReferences must be/
    );
    const del = await api.data.delete("roles", 1, "nullify");
    expect(del).toEqual({
      deleted: true,
      affected: [{ table: "menu_items", column: "required_role", count: 2 }],
    });
    expect((await api.data.get("menu_items", 1))?.required_role).toBeNull();
    expect(
      JSON.parse(host.state.files.get("prj_1")!.get("data/roles.json")!)
    ).toEqual([]);

    host.state.activeProject = null;
    await expect(api.data.tables()).rejects.toThrow(/No project is open/);
  });

  it("changes the schema with a described plan and reports bindings", async () => {
    const { api, host } = setup();
    const { tables } = await api.data.schema();
    const next = JSON.parse(JSON.stringify(tables)) as typeof tables;
    next[1].columns.push({ name: "icon", type: "string", default: "dot" });
    next.push({
      name: "pages",
      primaryKey: "id",
      columns: [{ name: "id", type: "number" }],
    });
    const r = await api.data.setSchema({ tables: next });
    expect(r.steps).toEqual([
      'Add column menu_items.icon with default "dot"',
      "Create table pages (new empty data/pages.json)",
    ]);
    expect((await api.data.get("menu_items", 1))?.icon).toBe("dot");
    expect(host.state.files.get("prj_1")!.get("data/pages.json")).toBe("[]\n");
    // @ts-expect-error bad schema
    await expect(api.data.setSchema({ tables: "x" })).rejects.toThrow(
      /tables must be an array/
    );

    const all = await api.data.bindings();
    expect(all.bindings.map((b) => [b.table, b.path, b.line, b.kind])).toEqual([
      ["menu_items", "components/menu.json", 1, "component"],
    ]);
    expect(all.unusedTables).toEqual(["roles", "pages"]);
    expect(all.broken.map((p) => p.message)).toEqual([
      'column "nope" is not in menu_items',
    ]);
    const one = await api.data.bindings("roles");
    expect(one.bindings).toEqual([]);
    expect(one.unusedTables).toEqual(["roles"]);
    isPlainJson(all);

    const w = api.data.open("menu_items");
    expect(w.kind).toBe("data");
    expect(api.data.open(undefined, "schema").kind).toBe("schema");
    // @ts-expect-error bad kind
    expect(() => api.data.open("roles", "chart")).toThrow(
      /kind must be one of/
    );
  });
});

describe("flow, sections and map", () => {
  it("connects windows with labeled arrows, lists and disconnects them", () => {
    const { api, host } = setup();
    const a = api.windows.create({ kind: "note", title: "A" });
    const b = api.windows.create({ kind: "note", title: "B" });
    const f = api.flow.connect(a.id, b.id, "reads");
    expect(f).toMatchObject({ from: a.id, to: b.id, label: "reads" });
    isPlainJson(f);
    expect(api.flow.list()).toHaveLength(1);
    // The shape: prefix is optional.
    api.flow.connect(a.id.slice(6), b.id);
    expect(api.flow.list()).toHaveLength(2);
    expect(() => api.flow.connect(a.id, a.id)).toThrow(/itself/);
    expect(() => api.flow.connect(a.id, "shape:nope")).toThrow(/No window/);
    expect(api.flow.disconnect(a.id, b.id)).toEqual({ removed: 2 });
    const g = api.flow.connect(b.id, a.id);
    expect(api.flow.disconnect(g.id)).toEqual({ removed: 1 });
    expect(host.state.flows).toEqual([]);
    // Closing a window drops its arrows.
    api.flow.connect(a.id, b.id);
    api.windows.close(b.id);
    expect(api.flow.list()).toEqual([]);
  });

  it("groups windows into sections", () => {
    const { api } = setup();
    const a = api.windows.create({
      kind: "note",
      rect: { x: 100, y: 100, w: 300, h: 200 },
    });
    const b = api.windows.create({
      kind: "note",
      rect: { x: 500, y: 150, w: 300, h: 200 },
    });
    const s = api.sections.create("Backend", [a.id, b.id]);
    expect(s).toMatchObject({ title: "Backend", windowIds: [a.id, b.id] });
    expect(s.x).toBeLessThan(100);
    expect(s.x + s.w).toBeGreaterThan(800);
    expect(api.sections.list()).toHaveLength(1);
    expect(api.windows.get(a.id)?.section).toBe(s.id);
    expect(() => api.sections.create("", [a.id])).toThrow(/title/);
    expect(() => api.sections.create("Empty", [])).toThrow(/windowIds/);
  });

  it("generates and regenerates the project map from the project's content", async () => {
    const { api, host } = setup();
    const r = await api.map.generate();
    isPlainJson(r);
    // Two tables, two code files (index.html, app.js, docs/README.md) and one component declaration.
    expect(r.sections).toBe(3);
    expect(r.nodes).toBe(6);
    expect(r.edges).toBe(1);
    expect(r.workspace?.name).toBe("Map");
    expect(api.windows.list().filter((w) => w.kind === "card")).toHaveLength(6);
    expect(api.sections.list().map((s) => s.title)).toEqual([
      "Data",
      "Code",
      "Components",
    ]);
    expect(api.flow.list()).toHaveLength(1);
    // Move a card, add a table, regenerate: the moved card stays, the new table appears.
    const card = api.windows.list().find((w) => w.title === "roles")!;
    api.windows.move(card.id, 5000, 5000);
    host.state.files.get("prj_1")!.set(
      "data/schema.json",
      JSON.stringify({
        tables: [
          { name: "roles", columns: [{ name: "id", type: "number" }] },
          { name: "menu_items", columns: [{ name: "id", type: "number" }] },
          { name: "orders", columns: [{ name: "id", type: "number" }] },
        ],
      })
    );
    const again = await api.map.regenerate();
    expect(again.nodes).toBe(7);
    expect(again.kept).toBe(6);
    const moved = api.windows.list().find((w) => w.title === "roles")!;
    expect([moved.x, moved.y]).toEqual([5000, 5000]);
    expect(api.windows.list().some((w) => w.title === "orders")).toBe(true);
    host.state.activeProject = null;
    await expect(api.map.generate()).rejects.toThrow(/No project/);
  });
});

describe("boards", () => {
  const boardFile = JSON.stringify({
    name: "demo",
    title: "Demo board",
    sections: [
      {
        id: "a",
        title: "A",
        grid: "columns",
        windows: [
          { id: "n1", kind: "note", content: "one" },
          { id: "n2", kind: "note", content: "two" },
        ],
      },
      {
        id: "b",
        title: "B",
        grid: "single",
        windows: [{ id: "d", kind: "data", content: { table: "roles" } }],
      },
    ],
    arrows: [{ from: "n2", to: "d", label: "feeds" }],
    steps: [
      { section: "a", title: "First", caption: "Two notes." },
      { section: "b", caption: "One table." },
    ],
  });

  it("lists, opens, saves and plays boards", async () => {
    const { api, host, events } = setup();
    host.state.files.get("prj_1")!.set("boards/demo.json", boardFile);
    const list = await api.boards.list();
    expect(list).toEqual([
      {
        name: "demo",
        title: "Demo board",
        path: "boards/demo.json",
        sections: 2,
        windows: 3,
        onCanvas: false,
      },
    ]);
    const seen: string[] = [];
    events.on("board.opened", (e) => seen.push(String(e.payload.name)));
    const opened = await api.boards.open("boards/demo.json", {
      origin: { x: 100, y: 100 },
    });
    isPlainJson(opened);
    expect(opened).toMatchObject({
      name: "demo",
      sections: 2,
      windows: 3,
      arrows: 1,
      workspace: { name: "Board: Demo board" },
    });
    expect(opened.bounds.x).toBe(100);
    expect(api.windows.list()).toHaveLength(3);
    expect(api.sections.list().map((s) => s.title)).toEqual(["A", "B"]);
    expect(api.flow.list()[0].label).toBe("feeds");
    expect(seen).toEqual(["demo"]);
    expect((await api.boards.list())[0].onCanvas).toBe(true);
    // Opening again replaces the earlier copy.
    await api.boards.open("demo");
    expect(api.windows.list()).toHaveLength(3);
    expect(api.sections.list()).toHaveLength(2);

    // The tour walks the steps and stops after the last one.
    const t0 = await api.boards.play("demo");
    expect(t0).toMatchObject({
      board: "demo",
      step: 0,
      total: 2,
      section: "a",
      stepTitle: "First",
      caption: "Two notes.",
      first: true,
      last: false,
    });
    const t1 = api.boards.step();
    expect(t1).toMatchObject({ step: 1, section: "b", last: true });
    expect(api.boards.step(-1)?.step).toBe(0);
    expect(api.boards.step(5)).toBeNull();
    expect(api.boards.stop()).toEqual({ stopped: false });
    await api.boards.play("demo", 1);
    expect(api.boards.stop()).toEqual({ stopped: true });

    // Saving captures what is on the canvas.
    const saved = await api.boards.save("snapshot", "My snapshot");
    expect(saved).toMatchObject({
      name: "snapshot",
      title: "My snapshot",
      path: "boards/snapshot.json",
      sections: 2,
      windows: 3,
    });
    expect(
      host.state.files.get("prj_1")!.get("boards/snapshot.json")
    ).toContain('"grid": "free"');
    expect((await api.boards.list()).map((b) => b.name)).toEqual([
      "demo",
      "snapshot",
    ]);
  });

  it("validates names and needs a project", async () => {
    const { api, host } = setup();
    await expect(api.boards.open("no such")).rejects.toThrow(
      /not a board name/
    );
    await expect(api.boards.open("missing")).rejects.toThrow(/No board/);
    await expect(api.boards.play()).rejects.toThrow(/No board on the canvas/);
    // @ts-expect-error bad delta
    expect(() => api.boards.step("x")).toThrow(/delta must be a finite number/);
    host.state.activeProject = null;
    await expect(api.boards.list()).rejects.toThrow(/No project/);
  });
});

describe("preview, console, commands, canvas", () => {
  it("covers the small namespaces", async () => {
    const { api, host } = setup();
    api.windows.create({ kind: "preview" });
    expect(api.preview.reload()).toEqual({ reloaded: 1 });
    expect(api.preview.setEntry("/about.html")).toEqual({
      entry: "about.html",
    });

    expect(api.console.log("hello")).toEqual({ ok: true });
    expect(api.console.log("careful", "warn")).toEqual({ ok: true });
    expect(host.state.console).toEqual([
      { level: "log", text: "hello" },
      { level: "warn", text: "careful" },
    ]);
    expect(() => api.console.log("x", "loud")).toThrow(/level must be/);
    api.console.clear();
    expect(host.state.console).toEqual([]);

    expect(api.commands.list()).toEqual([
      { id: "view.toggle-theme", title: "Toggle theme", group: "View" },
    ]);
    expect(await api.commands.run("view.toggle-theme", { a: 1 })).toEqual({
      ran: true,
    });
    expect(await api.commands.run("nope")).toEqual({ ran: false });
    expect(host.state.ran[0]).toEqual({
      id: "view.toggle-theme",
      args: { a: 1 },
    });

    expect(api.canvas.camera()).toEqual({ x: 0, y: 0, z: 1 });
    expect(api.canvas.setCamera({ z: 2 })).toEqual({ x: 0, y: 0, z: 2 });
    expect(() => api.canvas.setCamera({ z: 0 })).toThrow(/positive/);
    expect(api.canvas.zoomTo()).toEqual({ x: -1, y: -1, z: 0.5 });
    expect(host.state.log.at(-1)).toMatch(/^zoom:shape:w1$/);
    const shot = await api.canvas.screenshot();
    expect(shot.dataUrl).toBe("data:image/png;base64,1x0.5");
    expect(() => api.canvas.zoomTo(["shape:zzz"])).toThrow(/No window/);
    await expect(api.canvas.screenshot({ scale: 9 })).rejects.toThrow(/scale/);
  });
});

describe("events", () => {
  it("subscribes, lists and polls", () => {
    const { api, events } = setup();
    const seen: string[] = [];
    const off = api.events.on("window.created", (e) => seen.push(e.name));
    events.emit("window.created", { id: "shape:1" });
    events.emit("layout.changed", { preset: "grid" });
    expect(seen).toEqual(["window.created"]);
    off();
    events.emit("window.created", { id: "shape:2" });
    expect(seen).toHaveLength(1);
    expect(api.events.list()).toContain("file.changed");
    const poll = api.events.poll();
    expect(poll.events.map((e) => e.name)).toEqual([
      "window.created",
      "layout.changed",
      "window.created",
    ]);
    expect(api.events.poll(poll.cursor).events).toEqual([]);
    // @ts-expect-error unknown event
    expect(() => api.events.on("nope", () => {})).toThrow(/Unknown event/);
  });
});

describe("schema and invokeTool", () => {
  it("every schema tool exists on the API with the same arity or less", () => {
    const { api } = setup();
    for (const tool of TOOLS) {
      const [ns, method] = tool.name.split(".");
      const fn = (api as unknown as Record<string, Record<string, unknown>>)[
        ns
      ]?.[method];
      expect(typeof fn, tool.name).toBe("function");
      expect((fn as () => void).length, tool.name).toBeLessThanOrEqual(
        tool.params.length
      );
    }
  });

  it("maps object args onto positional parameters", async () => {
    const { api, host } = setup();
    const w = (await invokeTool(api, "windows.create", {
      kind: "note",
      title: "T",
    })) as { id: string };
    expect(w.id).toBe("shape:w1");
    const moved = (await invokeTool(api, "windows.move", {
      id: w.id,
      x: 1,
      y: 2,
    })) as { x: number };
    expect(moved.x).toBe(1);
    await expect(invokeTool(api, "windows.move", { id: w.id })).rejects.toThrow(
      /missing required arguments x, y/
    );
    await expect(invokeTool(api, "nope.nothing", {})).rejects.toThrow(
      /Unknown tool/
    );
    await expect(invokeTool(api, "events.on", {})).rejects.toThrow(
      /only be called from a script/
    );
    expect(
      await invokeTool(api, "layout.apply", { preset: "grid" })
    ).toMatchObject({ preset: "grid" });
    expect(await invokeTool(api, "console.log", { text: "x" })).toEqual({
      ok: true,
    });
    expect(host.state.console).toEqual([{ level: "log", text: "x" }]);
    expect(await invokeTool(api, "windows.list", undefined)).toHaveLength(1);
  });
});

describe("lineage", () => {
  const seed = (files: Map<string, string | null>) => {
    // The fake project ships a menu declaration; this test wants a known graph.
    files.delete("components/menu.json");
    files.set(
      "data/schema.json",
      JSON.stringify({
        tables: [
          {
            name: "users",
            columns: [
              { name: "id", type: "number" },
              { name: "name", type: "string" },
            ],
          },
          { name: "orphan", columns: [{ name: "id", type: "number" }] },
        ],
      })
    );
    files.set("data/users.json", JSON.stringify([{ id: 1, name: "Ada" }]));
    files.set(
      "design/components/Table.json",
      JSON.stringify({
        name: "Table",
        props: [{ name: "table", type: "table" }],
        template: "<table></table>",
      })
    );
    files.set(
      "pages/admin.json",
      JSON.stringify({
        name: "admin",
        title: "Admin",
        route: "/admin",
        components: [
          {
            id: "users-table",
            name: "Table",
            bindings: [{ table: "users", fields: ["name"] }],
          },
        ],
      })
    );
    files.set(
      "pages/home.json",
      JSON.stringify({
        name: "home",
        title: "Home",
        route: "/",
        components: [{ id: "hero", name: "Hero" }],
      })
    );
  };

  it("builds the graph, draws it as a board and focuses a page", async () => {
    const { api, host, events } = setup();
    seed(host.state.files.get("prj_1")!);
    const graph = await api.lineage.graph();
    isPlainJson(graph);
    expect(graph.tables.map((t) => t.name)).toEqual(["users", "orphan"]);
    expect(graph.tables[0].rows).toBe(1);
    expect(graph.components.map((c) => c.name)).toEqual(["Table"]);
    expect(graph.pages.map((p) => p.name)).toEqual(["admin", "home"]);
    expect(graph.edges.map((e) => `${e.from}>${e.to}:${e.label}`)).toEqual([
      "table:users>component:Table:name",
      "component:Table>page:admin:users-table",
    ]);
    const forHome = await api.lineage.graph("pages/home.json");
    expect(forHome.tables).toEqual([]);
    expect(forHome.pages).toHaveLength(1);
    await expect(api.lineage.graph("nope")).rejects.toThrow(/No page "nope"/);

    const seen: string[] = [];
    events.on("board.opened", (e) => seen.push(String(e.payload.name)));
    const opened = await api.lineage.open();
    isPlainJson(opened);
    expect(opened).toMatchObject({
      name: "data-lineage",
      page: null,
      sections: 4,
      windows: 1 + 2 + 1 + 2,
      arrows: 2,
      tables: 2,
      components: 1,
      pages: 2,
      edges: 2,
    });
    expect(seen).toEqual(["data-lineage"]);
    expect(api.sections.list().map((s) => s.title)).toEqual([
      "Data lineage",
      "Tables (data/schema.json)",
      "Components that bind data",
      "Pages",
    ]);
    // Focusing home keeps the page card and dims the rest; null restores all.
    expect(await api.lineage.focus("home")).toEqual({
      page: "home",
      dimmed: 4 + 2,
      kept: 1,
    });
    expect(host.state.lineageFocus).toBe("home");
    expect(await api.lineage.focus()).toEqual({ page: null, dimmed: 0, kept: 7 });
    await expect(api.lineage.focus("nope")).rejects.toThrow(/No page/);

    // One page's lineage puts the Page Builder and a Preview with the overlay on the right.
    const single = await api.lineage.open({ page: "admin" });
    expect(single).toMatchObject({
      name: "data-lineage-admin",
      page: "admin",
      tables: 1,
      components: 1,
      pages: 1,
      edges: 2,
    });
    const kinds = api.windows.list().map((w) => w.kind);
    expect(kinds).toContain("pages");
    expect(kinds).toContain("preview");
    expect(
      api.windows.list().find((w) => w.kind === "preview")?.content
    ).toBe("pages/admin.json?sources=1");
    await expect(api.lineage.open({ page: "nope" })).rejects.toThrow(/No page/);
  });
});
