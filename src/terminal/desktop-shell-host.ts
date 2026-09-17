/**
 * The project shell's PaperOS commands, bound to the desktop: editors, the
 * preview, Data windows, boards, layouts and the Canvas API.
 */
import type { Editor } from "tldraw";
import { getCanvasApi } from "@/api/install";
import { openDataWindow, openKindWindow } from "@/desktop/kinds/data-common";
import { openBoard, readBoard } from "@/boards/build";
import { openFile } from "@/ide/open-file";
import { getWindowManager } from "@/wm/window-manager";
import type { LayoutPreset } from "@/wm/types";
import type { ShellHost } from "./shell";

const API_NAMESPACES = [
  "windows",
  "layout",
  "workspaces",
  "projects",
  "files",
  "data",
  "flow",
  "sections",
  "map",
  "boards",
  "lineage",
  "browser",
  "terminal",
  "preview",
  "console",
  "commands",
  "canvas",
  "events",
  "version",
];

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<unknown>;

/** Evaluates JavaScript with `paperos` in scope; an expression's value is returned, statements run as a body. */
export async function evalWithApi(code: string): Promise<unknown> {
  const api = getCanvasApi();
  if (!api) throw new Error("The Canvas API is not installed yet");
  let fn: (...values: unknown[]) => Promise<unknown>;
  try {
    fn = new AsyncFunction("paperos", `return (${code}\n);`);
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    fn = new AsyncFunction("paperos", code);
  }
  return await fn(api);
}

/** `windows.list()` -> `paperos.windows.list()`; anything else is left alone. */
export function prefixApiExpression(expression: string): string {
  const head = /^([A-Za-z_$][\w$]*)/.exec(expression.trim())?.[1];
  return head && API_NAMESPACES.includes(head)
    ? `paperos.${expression.trim()}`
    : expression;
}

export function desktopShellHost(editor: Editor, project: string): ShellHost {
  return {
    openFile: (path) => void openFile(editor, { project, path }),
    preview(entry) {
      const api = getCanvasApi();
      if (api && api.windows.list().some((w) => w.kind === "preview")) {
        api.preview.setEntry(entry);
        return;
      }
      openKindWindow(editor, "preview", entry, { title: `Preview: ${entry}` });
    },
    openData: (table) => void openDataWindow(editor, { table }),
    async openBoard(name) {
      openBoard(editor, await readBoard(project, name), { project });
    },
    layout: (preset) =>
      getWindowManager(editor).applyPreset(preset as LayoutPreset),
    api: (expression) => evalWithApi(prefixApiExpression(expression)),
    evalJs: (code) => evalWithApi(code),
  };
}
