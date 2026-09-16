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
