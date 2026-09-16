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

/** Light theme on the app's tokens; dark is One Dark. */
const lightTheme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--pos-surface)", color: "var(--pos-text)" },
    ".cm-gutters": {
      backgroundColor: "var(--pos-surface-2)",
      color: "var(--pos-text-muted)",
      borderRight: "1px solid var(--pos-border)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--pos-accent) 6%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--pos-accent) 10%, transparent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor:
        "color-mix(in srgb, var(--pos-accent) 22%, transparent) !important",
    },
    ".cm-cursor": { borderLeftColor: "var(--pos-text)" },
  },
  { dark: false }
);

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: "var(--pos-mono)", lineHeight: "1.55" },
  ".cm-content": { padding: "8px 0" },
  "&.cm-focused": { outline: "none" },
});

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
