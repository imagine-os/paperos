import type { ComponentType } from "react";
import type { Editor } from "tldraw";
import type { WindowShape, WindowShapeProps } from "./window-shape";
import { NoteWindow } from "./kinds/note";
import { AboutWindow } from "./kinds/about";

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

// Built-in kinds. Later milestones add file tree, editor, preview, console...
registerWindowKind({
  id: "note",
  label: "Note",
  defaultTitle: "Note",
  Component: NoteWindow,
});

registerWindowKind({
  id: "about",
  label: "About PaperOS",
  defaultTitle: "About PaperOS",
  Component: AboutWindow,
});
