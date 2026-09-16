/**
 * Loads, activates and deactivates plugins and remembers which are enabled
 * (`paperos-v2:plugins` in localStorage). Registration with the desktop goes
 * through `PluginHooks`, so the manager itself has no React or tldraw
 * dependency and is tested with fakes.
 */
import type { CanvasApi } from "@/api/canvas-api";
import type { EventBus } from "@/api/events";
import { signal, type Signal } from "@/ide/signal";
import {
  createJsonStore,
  type JsonStore,
  type StorageLike,
} from "@/wm/storage";
import {
  describeSource,
  isPluginPath,
  pluginIdFor,
  type PluginApi,
  type PluginCommandSpec,
  type PluginEntry,
  type PluginModule,
  type PluginSource,
  type PluginWindowKindSpec,
} from "./types";

export const PLUGINS_KEY = "paperos-v2:plugins";

export interface PluginHooks {
  registerCommand(cmd: PluginCommandSpec): () => void;
  registerWindowKind(kind: PluginWindowKindSpec, pluginId: string): () => void;
  log(level: "system" | "error", text: string): void;
  /** Fetches and evaluates the module for a source. */
  loadModule(source: PluginSource): Promise<PluginModule>;
}

interface PluginState {
  version: 1;
  enabled: string[];
  /** Plugins added by URL (built-ins and project plugins are discovered). */
  urls: string[];
}

export function parsePluginState(raw: unknown): PluginState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (s.version !== 1) return null;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return { version: 1, enabled: strings(s.enabled), urls: strings(s.urls) };
}

interface Active {
  dispose: (() => void)[];
}

export class PluginManager {
  readonly entries: Signal<PluginEntry[]> = signal<PluginEntry[]>([]);
  private active = new Map<string, Active>();
  private store: JsonStore<PluginState>;
  private builtins = new Map<string, PluginModule>();

  constructor(
    private readonly api: CanvasApi,
    private readonly events: EventBus,
    private readonly hooks: PluginHooks,
    storage: StorageLike | null
  ) {
    this.store = createJsonStore<PluginState>(
      storage,
      PLUGINS_KEY,
      () => ({ version: 1, enabled: [], urls: [] }),
      parsePluginState
    );
  }

  /** Adds the shipped plugins and restores what was enabled. */
  async init(builtins: Record<string, PluginModule>): Promise<void> {
    for (const [id, mod] of Object.entries(builtins)) {
      this.builtins.set(id, mod);
      this.add({ type: "builtin", id }, mod.name ?? id, mod.description);
    }
    for (const url of this.store.get().urls)
      this.add({ type: "url", url }, url);
    await this.restoreEnabled();
  }

  list(): PluginEntry[] {
    return this.entries.get();
  }

  get(id: string): PluginEntry | undefined {
    return this.list().find((p) => p.id === id);
  }

  private patch(id: string, fn: (p: PluginEntry) => PluginEntry) {
    this.entries.update((list) => list.map((p) => (p.id === id ? fn(p) : p)));
  }

  private add(
    source: PluginSource,
    name: string,
    description?: string
  ): PluginEntry {
    const id = pluginIdFor(source);
    const existing = this.get(id);
    if (existing) return existing;
    const entry: PluginEntry = {
      id,
      name,
      description,
      source,
      enabled: this.store.get().enabled.includes(id),
      status: "inactive",
      kinds: [],
      commands: [],
    };
    this.entries.update((list) => [...list, entry]);
    return entry;
  }

  private async restoreEnabled() {
    for (const p of this.list()) {
      if (p.enabled && p.status === "inactive") await this.activate(p.id);
    }
  }

  // ----- sources ---------------------------------------------------------------

  /** Registers a plugin served from a URL (an ES module) and enables it. */
  async addUrl(url: string): Promise<PluginEntry> {
    const clean = url.trim();
    if (!/^https?:\/\//i.test(clean) && !clean.startsWith("/"))
      throw new Error("Plugin URLs must start with http://, https:// or /");
    this.store.update((s) => ({
      ...s,
      urls: s.urls.includes(clean) ? s.urls : [...s.urls, clean],
    }));
    const entry = this.add({ type: "url", url: clean }, clean);
    await this.enable(entry.id);
    return this.get(entry.id)!;
  }

  /**
   * Discovers `plugins/*.js` in a project. Entries for files that are gone
   * disappear (after being disabled); enabled ones that appear activate.
   */
  async scanProject(project: string | null, paths: string[]): Promise<void> {
    const found = new Set<string>();
    if (project) {
      for (const path of paths.filter(isPluginPath)) {
        const source: PluginSource = { type: "project", project, path };
        found.add(pluginIdFor(source));
        this.add(source, path.replace(/^plugins\//, ""));
      }
    }
    for (const p of this.list()) {
      if (p.source.type === "project" && !found.has(p.id)) {
        if (p.status === "active") this.deactivate(p.id);
        this.entries.update((list) => list.filter((x) => x.id !== p.id));
      }
    }
    await this.restoreEnabled();
  }

  /** Forgets a URL plugin (built-ins and project plugins cannot be removed). */
  remove(id: string): void {
    const p = this.get(id);
    if (!p || p.source.type !== "url") return;
    this.deactivate(id);
    const url = p.source.url;
    this.store.update((s) => ({
      ...s,
      urls: s.urls.filter((u) => u !== url),
      enabled: s.enabled.filter((e) => e !== id),
    }));
    this.entries.update((list) => list.filter((x) => x.id !== id));
  }

  // ----- enabling --------------------------------------------------------------

  async enable(id: string): Promise<void> {
    if (!this.get(id)) throw new Error(`No plugin "${id}"`);
    this.store.update((s) => ({
      ...s,
      enabled: s.enabled.includes(id) ? s.enabled : [...s.enabled, id],
    }));
    this.patch(id, (p) => ({ ...p, enabled: true }));
    await this.activate(id);
  }

  disable(id: string): void {
    if (!this.get(id)) return;
    this.store.update((s) => ({
      ...s,
      enabled: s.enabled.filter((e) => e !== id),
    }));
    this.deactivate(id);
    this.patch(id, (p) => ({
      ...p,
      enabled: false,
      status: "inactive",
      error: undefined,
    }));
  }

  async toggle(id: string): Promise<void> {
    const p = this.get(id);
    if (!p) return;
    if (p.enabled) this.disable(id);
    else await this.enable(id);
  }

  /** Disables and enables again (picks up a changed project file). */
  async reload(id: string): Promise<void> {
    this.deactivate(id);
    await this.activate(id);
  }

  private async activate(id: string): Promise<void> {
    const p = this.get(id);
    if (!p || this.active.has(id)) return;
    this.patch(id, (x) => ({ ...x, status: "loading", error: undefined }));
    const dispose: (() => void)[] = [];
    this.active.set(id, { dispose });
    try {
      const mod =
        p.source.type === "builtin"
          ? (this.builtins.get(p.source.id) ??
            (() => {
              throw new Error(`Unknown built-in plugin "${p.source.id}"`);
            })())
          : await this.hooks.loadModule(p.source);
      if (typeof mod.activate !== "function")
        throw new Error("The module does not export activate(api)");
      const pluginApi = this.makeApi(id, dispose);
      const off = await mod.activate(pluginApi);
      if (typeof off === "function") dispose.push(off);
      if (!this.active.has(id)) {
        // Disabled while loading.
        dispose.forEach((f) => f());
        return;
      }
      this.patch(id, (x) => ({
        ...x,
        status: "active",
        name: mod.name ?? x.name,
        description: mod.description ?? x.description,
      }));
      this.hooks.log("system", `Plugin "${mod.name ?? p.name}" activated`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      dispose.forEach((f) => f());
      this.active.delete(id);
      this.patch(id, (x) => ({ ...x, status: "error", error: message }));
      this.hooks.log("error", `Plugin "${p.name}" failed: ${message}`);
    }
  }

  private deactivate(id: string): void {
    const a = this.active.get(id);
    if (!a) return;
    this.active.delete(id);
    for (const f of a.dispose.reverse()) {
      try {
        f();
      } catch (e) {
        this.hooks.log(
          "error",
          `Plugin "${id}" failed to clean up: ${String(e)}`
        );
      }
    }
    this.patch(id, (p) => ({ ...p, kinds: [], commands: [] }));
  }

  private makeApi(id: string, dispose: (() => void)[]): PluginApi {
    const track = (off: () => void) => {
      dispose.push(off);
      return () => {
        off();
        const i = dispose.indexOf(off);
        if (i >= 0) dispose.splice(i, 1);
      };
    };
    const plugin: Omit<PluginApi, keyof CanvasApi> = {
      pluginId: id,
      registerCommand: (spec) => {
        const off = this.hooks.registerCommand(spec);
        this.patch(id, (p) => ({ ...p, commands: [...p.commands, spec.id] }));
        return track(() => {
          off();
          this.patch(id, (p) => ({
            ...p,
            commands: p.commands.filter((c) => c !== spec.id),
          }));
        });
      },
      registerWindowKind: (spec) => {
        const off = this.hooks.registerWindowKind(spec, id);
        const offCmd = this.hooks.registerCommand({
          id: `window.new.${spec.id}`,
          title: `New ${spec.label} window`,
          group: "Window",
          keywords: "open create plugin",
          run: () => void this.api.windows.create({ kind: spec.id }),
        });
        this.patch(id, (p) => ({ ...p, kinds: [...p.kinds, spec.id] }));
        return track(() => {
          offCmd();
          off();
          this.patch(id, (p) => ({
            ...p,
            kinds: p.kinds.filter((k) => k !== spec.id),
          }));
        });
      },
      on: (name, listener) => track(this.events.on(name, listener)),
      log: (text) =>
        this.hooks.log(
          "system",
          `[${describeSource(this.get(id)!.source)}] ${text}`
        ),
    };
    // The Canvas API namespaces are shared; only the helpers are per plugin.
    return Object.assign(Object.create(this.api) as CanvasApi, plugin);
  }
}
