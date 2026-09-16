/**
 * CodeMirror 6 for the script console: a plain JavaScript buffer (no Yjs),
 * an onChange callback and Ctrl+Enter to run. Loaded on demand.
 */
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { baseTheme, lightTheme } from "./themes";

export interface PlainEditorOptions {
  parent: HTMLElement;
  doc: string;
  dark: boolean;
  onChange: (doc: string) => void;
  onRun: () => void;
}

export interface PlainEditorHandle {
  view: EditorView;
  getDoc(): string;
  setDoc(doc: string): void;
  setDark(dark: boolean): void;
  destroy(): void;
}

export function createPlainEditor(
  options: PlainEditorOptions
): PlainEditorHandle {
  const theme = new Compartment();
  const view = new EditorView({
    parent: options.parent,
    doc: options.doc,
    extensions: [
      basicSetup,
      history(),
      baseTheme,
      theme.of(options.dark ? oneDark : lightTheme),
      javascript(),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            options.onRun();
            return true;
          },
        },
        indentWithTab,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) options.onChange(u.state.doc.toString());
      }),
    ],
  });
  return {
    view,
    getDoc: () => view.state.doc.toString(),
    setDoc(doc) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: doc },
      });
    },
    setDark(dark) {
      view.dispatch({
        effects: theme.reconfigure(dark ? oneDark : lightTheme),
      });
    },
    destroy: () => view.destroy(),
  };
}
