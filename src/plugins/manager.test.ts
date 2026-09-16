import { describe, expect, it } from "vitest";
import { createCanvasApi } from "@/api/canvas-api";
import { createEventBus } from "@/api/events";
import { fakeHost } from "@/api/fake-host";
import { memoryStorage } from "@/wm/storage";
import { BUILTIN_PLUGINS } from "./builtin";
import {
  parsePluginState,
  PluginManager,
  PLUGINS_KEY,
  type PluginHooks,
} from "./manager";
import {
  isPluginPath,
  pluginIdFor,
  type PluginModule,
  type PluginWindowKindSpec,
} from "./types";

function setup(modules: Record<string, PluginModule> = {}, stored?: unknown) {
  const host = fakeHost();
  const events = createEventBus();
  const api = createCanvasApi(host, events);
  const storage = memoryStorage();
  if (stored) storage.setItem(PLUGINS_KEY, JSON.stringify(stored));
  const commands = new Map<string, { title: string }>();
  const kinds = new Map<string, PluginWindowKindSpec>();
  const log: string[] = [];
  const hooks: PluginHooks = {
    registerCommand(cmd) {
      commands.set(cmd.id, cmd);
      return () => void commands.delete(cmd.id);
    },
    registerWindowKind(spec) {
      kinds.set(spec.id, spec);
      host.windows.kinds = () => ["note", ...kinds.keys()];
      return () => void kinds.delete(spec.id);
    },
    log: (level, text) => void log.push(`${level}:${text}`),
    async loadModule(source) {
      const key =
        source.type === "url"
          ? source.url
          : source.type === "project"
            ? source.path
            : source.id;
      const mod = modules[key];
      if (!mod) throw new Error(`fetch failed: ${key}`);
      return mod;
    },
  };
  const manager = new PluginManager(api, events, hooks, storage);
  return { manager, api, host, events, storage, commands, kinds, log };
}

describe("plugin manager", () => {
  it("lists built-ins disabled, enables and disables them with full cleanup", async () => {
    const { manager, commands, kinds, storage, log } = setup();
    await manager.init(BUILTIN_PLUGINS);
    expect(manager.list().map((p) => [p.id, p.enabled, p.status])).toEqual([
      ["builtin:clock", false, "inactive"],
      ["builtin:auto-tile", false, "inactive"],
    ]);

    await manager.enable("builtin:clock");
    const clock = manager.get("builtin:clock")!;
    expect(clock.status).toBe("active");
    expect(clock.kinds).toEqual(["clock"]);
    expect(clock.commands).toEqual([]);
    expect(kinds.has("clock")).toBe(true);
    expect(commands.has("window.new.clock")).toBe(true);
    expect(JSON.parse(storage.getItem(PLUGINS_KEY)!)).toEqual({
      version: 1,
      enabled: ["builtin:clock"],
      urls: [],
    });
    expect(log).toContain('system:Plugin "Clock" activated');

    manager.disable("builtin:clock");
    expect(manager.get("builtin:clock")).toMatchObject({
      enabled: false,
      status: "inactive",
      kinds: [],
    });
    expect(kinds.has("clock")).toBe(false);
    expect(commands.has("window.new.clock")).toBe(false);
    expect(JSON.parse(storage.getItem(PLUGINS_KEY)!).enabled).toEqual([]);
  });

  it("restores enabled plugins from storage on init", async () => {
    const { manager } = setup(
      {},
      { version: 1, enabled: ["builtin:auto-tile"], urls: [] }
    );
    await manager.init(BUILTIN_PLUGINS);
    expect(manager.get("builtin:auto-tile")?.status).toBe("active");
    expect(manager.get("builtin:clock")?.status).toBe("inactive");
  });

  it("auto-tile adds new windows to an active layout", async () => {
    const { manager, api, events } = setup();
    await manager.init(BUILTIN_PLUGINS);
    await manager.enable("builtin:auto-tile");
    const a = api.windows.create({ kind: "note" });
    api.layout.apply("columns");
    const b = api.windows.create({ kind: "note" });
    events.emit("window.created", { id: b.id, kind: "note", title: "Note" });
    await new Promise((r) => setTimeout(r, 5));
    expect(api.layout.getTree().tiled).toEqual([a.id, b.id]);
  });

  it("loads URL plugins, reports failures and removes them", async () => {
    const seen: string[] = [];
    const { manager, commands, storage } = setup({
      "https://example.test/p.js": {
        name: "Remote",
        activate(api) {
          api.registerCommand({ id: "remote.hi", title: "Hi", run: () => {} });
          api.on("window.created", (e) => seen.push(String(e.payload.id)));
          return () => seen.push("disposed");
        },
      },
    });
    await manager.init({});
    await expect(manager.addUrl("ftp://x")).rejects.toThrow(/must start with/);
    const p = await manager.addUrl("https://example.test/p.js");
    expect(p).toMatchObject({
      name: "Remote",
      status: "active",
      commands: ["remote.hi"],
    });
    expect(commands.has("remote.hi")).toBe(true);
    expect(JSON.parse(storage.getItem(PLUGINS_KEY)!).urls).toEqual([
      "https://example.test/p.js",
    ]);

    const broken = await manager.addUrl("https://example.test/missing.js");
    expect(broken.status).toBe("error");
    expect(broken.error).toMatch(/fetch failed/);

    manager.remove(p.id);
    expect(seen).toEqual(["disposed"]);
    expect(commands.has("remote.hi")).toBe(false);
    expect(manager.get(p.id)).toBeUndefined();
    expect(JSON.parse(storage.getItem(PLUGINS_KEY)!).urls).toEqual([
      "https://example.test/missing.js",
    ]);
  });

  it("discovers project plugins and drops the ones that disappear", async () => {
    const { manager, commands } = setup({
      "plugins/hello.js": {
        activate: (api) =>
          void api.registerCommand({ id: "hello", title: "Hello", run() {} }),
      },
    });
    await manager.init({});
    await manager.scanProject("prj_1", [
      "index.html",
      "plugins/hello.js",
      "plugins/readme.md",
    ]);
    expect(manager.list().map((p) => p.id)).toEqual([
      "project:prj_1/plugins/hello.js",
    ]);
    expect(manager.get("project:prj_1/plugins/hello.js")?.name).toBe(
      "hello.js"
    );
    await manager.enable("project:prj_1/plugins/hello.js");
    expect(commands.has("hello")).toBe(true);
    await manager.scanProject("prj_1", ["index.html"]);
    expect(manager.list()).toEqual([]);
    expect(commands.has("hello")).toBe(false);
  });

  it("rejects modules without activate and validates ids", async () => {
    const { manager } = setup({ "https://x.test/a.js": {} as PluginModule });
    await manager.init({});
    const p = await manager.addUrl("https://x.test/a.js");
    expect(p.error).toMatch(/does not export activate/);
    await expect(manager.enable("nope")).rejects.toThrow(/No plugin/);
    expect(isPluginPath("plugins/a.js")).toBe(true);
    expect(isPluginPath("plugins/sub/a.js")).toBe(false);
    expect(isPluginPath("src/plugins/a.js")).toBe(false);
    expect(
      pluginIdFor({ type: "project", project: "p", path: "plugins/a.js" })
    ).toBe("project:p/plugins/a.js");
    expect(parsePluginState({ version: 2 })).toBeNull();
    expect(
      parsePluginState({ version: 1, enabled: ["a", 1], urls: null })
    ).toEqual({
      version: 1,
      enabled: ["a"],
      urls: [],
    });
  });
});
