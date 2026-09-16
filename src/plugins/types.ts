/**
 * Plugin contract. A plugin is an ES module exporting `activate(api)`; it
 * may also export `name` and `description`. `activate` receives the Canvas
 * API plus registration helpers and may return a disposer. Everything a
 * plugin registers is removed when it is disabled.
 *
 * Plugins run inside the page with the page's privileges (there is no
 * sandbox); the manager says so and only loads what the user enables.
 */
import type { CanvasApi } from "@/api/canvas-api";
import type { CanvasEvent } from "@/api/events";
import type { EventName } from "@/api/schema";

export interface PluginWindowContext {
  /** The window this instance renders into (id, title, content). */
  readonly window: { id: string; title: string; content: string };
  /** Changes the window's title or content (persisted). */
  update(patch: { title?: string; content?: string }): void;
  api: CanvasApi;
  /** Aborted when the window unmounts; clean timers up on it (or return a disposer). */
  signal: AbortSignal;
}

export interface PluginWindowKindSpec {
  id: string;
  label: string;
  icon?: string;
  defaultTitle?: string;
  defaultSize?: { w: number; h: number };
  /** Draws into the element; return a disposer if needed. Called once per mount. */
  render?(el: HTMLElement, ctx: PluginWindowContext): void | (() => void);
  /** Or: HTML for the body, re-rendered when title or content change. */
  html?(ctx: PluginWindowContext): string;
}

export interface PluginCommandSpec {
  id: string;
  title: string;
  group?: string;
  keywords?: string;
  shortcut?: string;
  run(args?: Record<string, unknown>): void | Promise<void>;
}

export interface PluginApi extends CanvasApi {
  /** The plugin's id (built-in name, URL or project path). */
  readonly pluginId: string;
  registerCommand(spec: PluginCommandSpec): () => void;
  registerWindowKind(spec: PluginWindowKindSpec): () => void;
  /** Subscribe to Canvas API events; removed with the plugin. */
  on(name: EventName | "*", listener: (event: CanvasEvent) => void): () => void;
  /** Writes to the Console windows, prefixed with the plugin id. */
  log(text: string): void;
}

export interface PluginModule {
  name?: string;
  description?: string;
  activate(api: PluginApi): void | (() => void) | Promise<void | (() => void)>;
}

export type PluginSource =
  | { type: "builtin"; id: string }
  | { type: "url"; url: string }
  | { type: "project"; project: string; path: string };

export type PluginStatus = "inactive" | "loading" | "active" | "error";

export interface PluginEntry {
  id: string;
  name: string;
  description?: string;
  source: PluginSource;
  enabled: boolean;
  status: PluginStatus;
  error?: string;
  /** What the plugin registered while active. */
  kinds: string[];
  commands: string[];
}

/** Stable id for a source: `builtin:clock`, `url:https://...`, `project:<project>/<path>`. */
export function pluginIdFor(source: PluginSource): string {
  switch (source.type) {
    case "builtin":
      return `builtin:${source.id}`;
    case "url":
      return `url:${source.url}`;
    case "project":
      return `project:${source.project}/${source.path}`;
  }
}

export function describeSource(source: PluginSource): string {
  switch (source.type) {
    case "builtin":
      return "built-in";
    case "url":
      return source.url;
    case "project":
      return source.path;
  }
}

/** Project files that count as plugins: `plugins/*.js` at the project root. */
export function isPluginPath(path: string): boolean {
  return /^plugins\/[^/]+\.(js|mjs)$/.test(path);
}
