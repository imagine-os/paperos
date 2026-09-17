/**
 * `/app?board=<name>` deep links: opens that board of the active project
 * (creating the sample on a fresh browser) and plays nothing; the camera
 * ends on the whole board. Unknown boards fall back to the sample's
 * "build-product" so a landing-page link never lands on an empty canvas.
 */
import type { Editor } from "tldraw";
import { listBoards, openBoard, readBoard } from "@/boards/build";
import { pushConsole } from "@/ide/console-store";
import { getProjectStore } from "@/ide/project";
import { openSampleProject } from "./project-actions";

export async function openBoardFromUrl(
  editor: Editor,
  name: string
): Promise<string | null> {
  const store = getProjectStore();
  await store.init();
  let project = store.getActiveId();
  if (!project) project = (await openSampleProject()).id;
  let boards = await listBoards(project, editor);
  let pick = boards.find((b) => b.name === name);
  if (!pick && boards.length === 0) {
    // The active project has no boards: the sample does.
    project = (await openSampleProject()).id;
    boards = await listBoards(project, editor);
    pick = boards.find((b) => b.name === name);
  }
  if (!pick) {
    pushConsole(
      "system",
      `No board "${name}" in this project; opening ${boards[0]?.title ?? "nothing"}.`
    );
    pick = boards[0];
  }
  if (!pick) return null;
  const board = await readBoard(project, pick.name);
  openBoard(editor, board, { project });
  // Drop the parameter so a reload does not reopen the board over edits.
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("board");
    window.history.replaceState(null, "", url.toString());
  } catch {
    // Not in a browser.
  }
  return pick.name;
}
