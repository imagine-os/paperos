import type { ComponentType } from "react";
import type { Editor } from "tldraw";
import type { WindowShape, WindowShapeProps } from "./window-shape";
import { NoteWindow } from "./kinds/note";
import { AboutWindow } from "./kinds/about";
import { FilesWindow } from "./kinds/files";
import { EditorWindow } from "./kinds/editor";
import { PreviewWindow } from "./kinds/preview";
import { ConsoleWindow } from "./kinds/console";
import { MarkdownWindow } from "./kinds/markdown";

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
  Component: ComponentType<WindowKindProps>;
}

const registry = new Map<string, WindowKind>();

export function registerWindowKind(kind: WindowKind): void {
  registry.set(kind.id, kind);
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
  label: "Editor",
  defaultTitle: "Editor",
  icon: "✎",
  defaultSize: { w: 640, h: 480 },
  Component: EditorWindow,
});

registerWindowKind({
  id: "preview",
  label: "Preview",
  defaultTitle: "Preview",
  icon: "▶",
  defaultSize: { w: 520, h: 420 },
  Component: PreviewWindow,
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
  label: "Markdown",
  defaultTitle: "Markdown",
  icon: "\u{1F4C4}",
  defaultSize: { w: 520, h: 480 },
  Component: MarkdownWindow,
});

registerWindowKind({
  id: "note",
  label: "Note",
  defaultTitle: "Note",
  icon: "\u{1F5D2}",
  Component: NoteWindow,
});

registerWindowKind({
  id: "about",
  label: "About PaperOS",
  defaultTitle: "About PaperOS",
  icon: "ⓘ",
  hidden: true,
  Component: AboutWindow,
});
