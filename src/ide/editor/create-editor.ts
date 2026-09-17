/**
 * CodeMirror 6 setup for the editor window. Loaded on demand (this module
 * pulls in codemirror, y-codemirror.next and the language registry), so the
 * desktop bundle stays small until the first editor opens.
 */
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import {
  Compartment,
  EditorSelection,
  type Extension,
} from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { yCollab } from "y-codemirror.next";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { basename } from "../project/paths";
import { baseTheme, lightTheme } from "./themes";

export interface CreateEditorOptions {
  parent: HTMLElement;
  text: Y.Text;
  /** Room awareness: remote cursors and selections of the other peers. */
  awareness?: Awareness | null;
  path: string;
  dark: boolean;
  onSave: () => void;
  onFormat: () => void;
}

export interface EditorHandle {
  view: EditorView;
  setDark(dark: boolean): void;
  /** Puts the cursor on a 1-based line and scrolls it into view. */
  gotoLine(line: number): void;
  destroy(): void;
}

/** Language description for a file name, or null for plain text. */
export function languageFor(path: string): LanguageDescription | null {
  return LanguageDescription.matchFilename(languages, basename(path));
}

export async function createEditor(
  options: CreateEditorOptions
): Promise<EditorHandle> {
  const theme = new Compartment();
  const language = new Compartment();
  const desc = languageFor(options.path);
  const langExt: Extension = desc ? await desc.load() : [];

  const view = new EditorView({
    parent: options.parent,
    // y-codemirror.next syncs changes but does not seed the initial state.
    doc: options.text.toString(),
    extensions: [
      basicSetup,
      baseTheme,
      theme.of(options.dark ? oneDark : lightTheme),
      language.of(langExt),
      keymap.of([
        {
          key: "Mod-s",
          run: () => {
            options.onSave();
            return true;
          },
        },
        {
          key: "Shift-Alt-f",
          run: () => {
            options.onFormat();
            return true;
          },
        },
        indentWithTab,
        ...defaultKeymap,
      ]),
      yCollab(options.text, options.awareness ?? null),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        "aria-label": `Editor: ${options.path}`,
        tabindex: "0",
      }),
    ],
  });

  return {
    view,
    setDark(dark) {
      view.dispatch({
        effects: theme.reconfigure(dark ? oneDark : lightTheme),
      });
    },
    gotoLine(line) {
      const n = Math.max(1, Math.min(line, view.state.doc.lines));
      const pos = view.state.doc.line(n).from;
      view.dispatch({
        selection: EditorSelection.cursor(pos),
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
      view.focus();
    },
    destroy() {
      view.destroy();
    },
  };
}
