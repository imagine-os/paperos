/**
 * Wires the plugin manager into the desktop: commands go to the command
 * registry, window kinds to the kinds registry (wrapped in a React host),
 * modules load from built-ins, URLs or project files, and the active
 * project is scanned for `plugins/*.js`.
 */
import type { CanvasApi } from "@/api/canvas-api";
import type { EventBus } from "@/api/events";
import { registerCommand } from "@/ide/commands";
import { pushConsole } from "@/ide/console-store";
import { readLiveText } from "@/ide/docs";
import { getProjectStore } from "@/ide/project/store";
import {
  registerWindowKind,
  unregisterWindowKind,
} from "@/desktop/window-kinds";
import { browserStorage } from "@/wm/storage";
import { BUILTIN_PLUGINS } from "./builtin";
import { PluginManager, type PluginHooks } from "./manager";
import { createPluginWindowComponent } from "./plugin-window";
import type { PluginModule, PluginSource } from "./types";

let manager: PluginManager | null = null;

export function getPluginManager(): PluginManager | null {
  return manager;
}

async function importModule(url: string): Promise<PluginModule> {
  // webpackIgnore: the URL is only known at runtime (user-provided or a blob).
  const mod = (await import(/* webpackIgnore: true */ url)) as Record<
    string,
    unknown
  >;
  const candidate = (mod.default ?? mod) as PluginModule;
  return candidate;
}

async function loadModule(source: PluginSource): Promise<PluginModule> {
  switch (source.type) {
    case "url":
      return importModule(source.url);
    case "project": {
      const text = await readLiveText(source.project, source.path);
      if (text === null) throw new Error(`Cannot read ${source.path}`);
      const blob = new Blob([text], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      try {
        return await importModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    case "builtin":
      throw new Error("built-ins are resolved by the manager");
  }
}

export function installPlugins(api: CanvasApi, events: EventBus): () => void {
  const hooks: PluginHooks = {
    registerCommand: (cmd) =>
      registerCommand({
        id: cmd.id,
        title: cmd.title,
        group: cmd.group ?? "Plugin",
        keywords: cmd.keywords,
        shortcut: cmd.shortcut,
        run: cmd.run,
      }),
    registerWindowKind(spec) {
      registerWindowKind({
        id: spec.id,
        label: spec.label,
        defaultTitle: spec.defaultTitle ?? spec.label,
        icon: spec.icon ?? "\u{1F9E9}",
        defaultSize: spec.defaultSize,
        Component: createPluginWindowComponent(spec, api),
      });
      return () => unregisterWindowKind(spec.id);
    },
    log: (level, text) => pushConsole(level, text),
    loadModule,
  };
  const m = new PluginManager(api, events, hooks, browserStorage());
  manager = m;

  const projects = getProjectStore();
  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  const scan = () => {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(async () => {
      scanTimer = null;
      const id = projects.getActiveId();
      const session = id ? await projects.session(id) : null;
      const paths = session?.files.get().map((f) => f.path) ?? [];
      await m.scanProject(id, paths);
    }, 150);
  };

  void m.init(BUILTIN_PLUGINS).then(scan);
  const offs = [
    events.on("project.changed", scan),
    events.on("file.changed", (e) => {
      const path = String(e.payload.path ?? "");
      const to = String(e.payload.to ?? "");
      if (/^plugins\//.test(path) || /^plugins\//.test(to)) scan();
    }),
    projects.state.subscribe(scan),
  ];
  return () => {
    offs.forEach((f) => f());
    if (scanTimer) clearTimeout(scanTimer);
    for (const p of m.list()) if (p.status === "active") m.disable(p.id);
    if (manager === m) manager = null;
  };
}
