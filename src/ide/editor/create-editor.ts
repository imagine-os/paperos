/**
 * CodeMirror 6 setup for the editor window. Loaded on demand (this module
 * pulls in codemirror, y-codemirror.next and the language registry), so the
 * desktop bundle stays small until the first editor opens.
 */
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Compartment, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { yCollab } from "y-codemirror.next";
import type * as Y from "yjs";
import { basename } from "../project/paths";
import { baseTheme, lightTheme } from "./themes";

export interface CreateEditorOptions {
  parent: HTMLElement;
  text: Y.Text;
  path: string;
  dark: boolean;
  onSave: () => void;
  onFormat: () => void;
}

export interface EditorHandle {
  view: EditorView;
  setDark(dark: boolean): void;
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
      yCollab(options.text, null),
      EditorView.lineWrapping,
    ],
  });

  return {
    view,
    setDark(dark) {
      view.dispatch({
        effects: theme.reconfigure(dark ? oneDark : lightTheme),
      });
    },
    destroy() {
      view.destroy();
    },
  };
}
