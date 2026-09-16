/** CodeMirror themes shared by the file editor and the script console. */
import { EditorView } from "@codemirror/view";

/** Light theme on the app's tokens; dark is One Dark. */
export const lightTheme = EditorView.theme(
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

export const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: "var(--pos-mono)", lineHeight: "1.55" },
  ".cm-content": { padding: "8px 0" },
  "&.cm-focused": { outline: "none" },
});
