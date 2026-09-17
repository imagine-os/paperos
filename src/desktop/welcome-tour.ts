/**
 * The welcome tour: eight steps over the IDE workspace, the top bar, a
 * board and the Data lineage, ending on the Small Business SaaS sample. It
 * rides on the boards' tour machinery (`src/boards/tour-controller.ts`):
 * steps frame top-bar elements (`target`), run palette commands (`run`) and
 * point at sections of other boards (`board`). Shown once per browser;
 * "Take the tour" (About, palette, Start here) replays it.
 */
import type { Editor } from "tldraw";
import type { BoardDef } from "@/boards/model";
import { getTourController } from "@/boards/tour-controller";
import { LINEAGE_BOARD } from "@/lineage/model";
import { applyIdeWorkspace } from "./ide-workspace";

export const WELCOME_KEY = "paperos-v2:welcome-seen";
export const WELCOME_TOUR = "welcome";

export function welcomeTour(): BoardDef {
  return {
    name: WELCOME_TOUR,
    title: "Welcome to PaperOS",
    sections: [],
    arrows: [],
    steps: [
      {
        section: "desktop",
        target: ".pos-canvas",
        title: "Everything is a window",
        caption:
          "Files, an editor, the live preview and a console are windows tiled into the IDE workspace. Drag a title bar to float a window, drop it back to re-tile, and pan or zoom the canvas like a whiteboard.",
      },
      {
        section: "open",
        target: '[data-testid="open-menu"]',
        title: "Open a project",
        caption:
          "A folder from your disk (Chromium), the sample site, a ZIP or a public GitHub repository. Projects stay in this browser; nothing is uploaded.",
      },
      {
        section: "layout",
        target: '[data-testid="layout-menu"]',
        title: "Layouts and workspaces",
        caption:
          "Columns, grid, bento and a split tree (Alt+1 to Alt+5) tile the windows you have; Alt+arrows move the focus. Workspaces remember an arrangement.",
      },
      {
        section: "windows",
        target: '[data-testid="new-window-menu"]',
        title: "New window and Commands",
        caption:
          "Every tool is a window kind: Data, Schema, Design, Page Builder, Browser, Terminal, Script and more. Ctrl+K opens the command palette; ? lists every shortcut.",
      },
      {
        section: "share",
        target: '[data-testid="share-button"]',
        title: "Share and the Agent bridge",
        caption:
          "Share opens a live room (peer to peer, no account) with cursors and shared files. Agent bridge connects this tab to a local MCP server so an agent can drive the canvas.",
      },
      {
        section: "data",
        board: "build-product",
        run: "board.open.build-product",
        title: "Boards tell a story",
        caption:
          "A board lays sections out left to right: tables, schema, design, the Page Builder, previews at three sizes, a script. Boards > Play tours it with the arrow keys.",
      },
      {
        section: "tables",
        board: LINEAGE_BOARD,
        run: "lineage.open",
        title: "Data lineage",
        caption:
          "Tables, the components that bind them and the pages they render on, drawn from the project's bindings. Pick a page in the controls to dim everything that does not feed it.",
      },
      {
        section: "finish",
        title: "Try the full sample",
        caption:
          "The Small Business SaaS sample has fifteen tables, twenty pages in four apps and a showcase board with its own tour. Or keep this small site and explore on your own.",
        action: {
          label: "Open the Small Business SaaS sample",
          command: "project.open-saas",
        },
      },
    ],
  };
}

export function welcomeSeen(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_KEY) !== null;
  } catch {
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the tour would come back next time, which is fine.
  }
}

/**
 * Starts the welcome tour. An empty canvas gets the IDE workspace first so
 * the first step has windows to show.
 */
export async function startWelcomeTour(editor: Editor): Promise<void> {
  markWelcomeSeen();
  const hasWindows = editor
    .getCurrentPageShapes()
    .some((s) => s.type === "window");
  if (!hasWindows) await applyIdeWorkspace(editor);
  getTourController(editor).play(welcomeTour());
}

/** True when the URL carries a room, board or bridge request (no tour then). */
export function urlHasIntent(search = window.location.search): boolean {
  const q = new URLSearchParams(search);
  return q.has("room") || q.has("board") || q.has("bridge");
}
