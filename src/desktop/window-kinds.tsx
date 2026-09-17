import { lazy, type ComponentType } from "react";
import type { Editor } from "tldraw";
import { signal } from "@/ide/signal";
import type { WindowShape, WindowShapeProps } from "./window-shape";
import { NoteWindow } from "./kinds/note";
import { AboutWindow } from "./kinds/about";
import { FilesWindow } from "./kinds/files";
import { EditorWindow } from "./kinds/editor";
import { PreviewWindow } from "./kinds/preview";
import { ConsoleWindow } from "./kinds/console";

/**
 * Heavy kinds load on demand (each is its own chunk), so the first paint of
 * /app carries only the desktop, Files, the editor shell, the preview and
 * the console. The window frame shows a placeholder while a chunk loads.
 */
const lazyKind = (
  loader: () => Promise<ComponentType<WindowKindProps>>
): ComponentType<WindowKindProps> =>
  lazy(() =>
    loader().then((C) => ({ default: C }))
  ) as unknown as ComponentType<WindowKindProps>;

const MarkdownWindow = lazyKind(() =>
  import("./kinds/markdown").then((m) => m.MarkdownWindow)
);
const ScriptWindow = lazyKind(() =>
  import("./kinds/script").then((m) => m.ScriptWindow)
);
const PluginsWindow = lazyKind(() =>
  import("./kinds/plugins").then((m) => m.PluginsWindow)
);
const AgentWindow = lazyKind(() =>
  import("./kinds/agent").then((m) => m.AgentWindow)
);
const DataWindow = lazyKind(() =>
  import("./kinds/data").then((m) => m.DataWindow)
);
const SchemaWindow = lazyKind(() =>
  import("./kinds/schema").then((m) => m.SchemaWindow)
);
const ConnectionsWindow = lazyKind(() =>
  import("./kinds/connections").then((m) => m.ConnectionsWindow)
);
const DesignWindow = lazyKind(() =>
  import("./kinds/design").then((m) => m.DesignWindow)
);
const PagesWindow = lazyKind(() =>
  import("./kinds/pages").then((m) => m.PagesWindow)
);
const CardWindow = lazyKind(() =>
  import("./kinds/card").then((m) => m.CardWindow)
);
const LineageWindow = lazyKind(() =>
  import("./kinds/lineage").then((m) => m.LineageWindow)
);
const BrowserWindow = lazyKind(() =>
  import("./kinds/browser").then((m) => m.BrowserWindow)
);
const TerminalWindow = lazyKind(() =>
  import("./kinds/terminal").then((m) => m.TerminalWindow)
);
const ShareWindow = lazyKind(() =>
  import("./kinds/share").then((m) => m.ShareWindow)
);
const KeysWindow = lazyKind(() =>
  import("./kinds/keys").then((m) => m.KeysWindow)
);

/** What a window kind's component receives. */
export interface WindowKindProps {
  shape: WindowShape;
  editor: Editor;
  /** Patch this window's props (persisted in the tldraw store). */
  update: (patch: Partial<WindowShapeProps>) => void;
}

export interface WindowKind {
  id: string;
  label: string;
  defaultTitle: string;
  /** Small glyph shown in the title bar and menus (text, no icon font). */
  icon?: string;
  defaultSize?: { w: number; h: number };
  /** Hidden from "New window" menus (opened through other means). */
  hidden?: boolean;
  /**
   * Expensive to render (iframes, CodeMirror, big grids): the window shows a
   * placeholder while it is far off screen or the canvas is zoomed far out.
   */
  heavy?: boolean;
  Component: ComponentType<WindowKindProps>;
}

const registry = new Map<string, WindowKind>();

/** Bumps when kinds are registered or removed (plugins), so menus and windows re-render. */
export const windowKindsChanged = signal(0);

export function registerWindowKind(kind: WindowKind): void {
  registry.set(kind.id, kind);
  windowKindsChanged.update((n) => n + 1);
}

export function unregisterWindowKind(id: string): void {
  if (registry.delete(id)) windowKindsChanged.update((n) => n + 1);
}

export function getWindowKind(id: string): WindowKind | undefined {
  return registry.get(id);
}

export function listWindowKinds(): WindowKind[] {
  return [...registry.values()];
}

// Built-in kinds: the IDE tools first, then note and about.
registerWindowKind({
  id: "files",
  label: "Files",
  defaultTitle: "Files",
  icon: "\u{1F5C2}",
  defaultSize: { w: 300, h: 520 },
  Component: FilesWindow,
});

registerWindowKind({
  id: "editor",
  heavy: true,
  label: "Editor",
  defaultTitle: "Editor",
  icon: "✎",
  defaultSize: { w: 640, h: 480 },
  Component: EditorWindow,
});

registerWindowKind({
  id: "preview",
  heavy: true,
  label: "Preview",
  defaultTitle: "Preview",
  icon: "▶",
  defaultSize: { w: 520, h: 420 },
  Component: PreviewWindow,
});

registerWindowKind({
  id: "browser",
  heavy: true,
  label: "Browser",
  defaultTitle: "Browser",
  icon: "\u{1F310}",
  defaultSize: { w: 720, h: 520 },
  Component: BrowserWindow,
});

registerWindowKind({
  id: "terminal",
  label: "Terminal",
  defaultTitle: "Terminal",
  icon: "\u{2328}",
  defaultSize: { w: 640, h: 380 },
  Component: TerminalWindow,
});

registerWindowKind({
  id: "console",
  label: "Console",
  defaultTitle: "Console",
  icon: "☰",
  defaultSize: { w: 520, h: 240 },
  Component: ConsoleWindow,
});

registerWindowKind({
  id: "markdown",
  heavy: true,
  label: "Markdown",
  defaultTitle: "Markdown",
  icon: "\u{1F4C4}",
  defaultSize: { w: 520, h: 480 },
  Component: MarkdownWindow,
});

registerWindowKind({
  id: "data",
  heavy: true,
  label: "Data",
  defaultTitle: "Data",
  icon: "\u{1F5C3}",
  defaultSize: { w: 640, h: 420 },
  Component: DataWindow,
});

registerWindowKind({
  id: "schema",
  heavy: true,
  label: "Schema",
  defaultTitle: "Schema",
  icon: "\u{1F5FA}",
  defaultSize: { w: 560, h: 440 },
  Component: SchemaWindow,
});

registerWindowKind({
  id: "connections",
  heavy: true,
  label: "Connections",
  defaultTitle: "Connections",
  icon: "\u{1F517}",
  defaultSize: { w: 560, h: 480 },
  Component: ConnectionsWindow,
});

registerWindowKind({
  id: "design",
  heavy: true,
  label: "Design",
  defaultTitle: "Design system",
  icon: "\u{1F3A8}",
  defaultSize: { w: 900, h: 560 },
  Component: DesignWindow,
});

registerWindowKind({
  id: "pages",
  heavy: true,
  label: "Page Builder",
  defaultTitle: "Page Builder",
  icon: "\u{1F4D0}",
  defaultSize: { w: 1080, h: 620 },
  Component: PagesWindow,
});

registerWindowKind({
  id: "script",
  label: "Script",
  defaultTitle: "Script",
  icon: "⚡",
  defaultSize: { w: 560, h: 520 },
  Component: ScriptWindow,
});

registerWindowKind({
  id: "plugins",
  label: "Plugins",
  defaultTitle: "Plugins",
  icon: "\u{1F9E9}",
  defaultSize: { w: 460, h: 480 },
  Component: PluginsWindow,
});

registerWindowKind({
  id: "agent",
  label: "Agent",
  defaultTitle: "Agent",
  icon: "\u{1F916}",
  defaultSize: { w: 460, h: 400 },
  Component: AgentWindow,
});

registerWindowKind({
  id: "share",
  label: "Share",
  defaultTitle: "Share",
  icon: "\u{1F465}",
  defaultSize: { w: 420, h: 520 },
  Component: ShareWindow,
});

registerWindowKind({
  id: "note",
  label: "Note",
  defaultTitle: "Note",
  icon: "\u{1F5D2}",
  Component: NoteWindow,
});

registerWindowKind({
  id: "card",
  label: "Card",
  defaultTitle: "Card",
  icon: "\u{25A3}",
  defaultSize: { w: 240, h: 120 },
  hidden: true,
  Component: CardWindow,
});

registerWindowKind({
  id: "lineage",
  label: "Data lineage",
  defaultTitle: "Data lineage",
  icon: "\u{1F517}",
  defaultSize: { w: 300, h: 260 },
  hidden: true,
  Component: LineageWindow,
});

registerWindowKind({
  id: "keys",
  label: "Keyboard shortcuts",
  defaultTitle: "Keyboard shortcuts",
  icon: "\u{2328}",
  defaultSize: { w: 520, h: 560 },
  Component: KeysWindow,
});

registerWindowKind({
  id: "about",
  label: "About PaperOS",
  defaultTitle: "About PaperOS",
  icon: "ⓘ",
  hidden: true,
  Component: AboutWindow,
});
