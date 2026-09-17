import { resetLocalData } from "./reset";

/** Asks, then wipes PaperOS's local data and reloads into a first run. */
export async function confirmReset(): Promise<boolean> {
  const ok = window.confirm(
    "Reset local data?\n\nEvery project, document, workspace, board and the canvas stored in this browser will be deleted. Folder projects on disk are not touched. PaperOS then reloads as a first run."
  );
  if (!ok) return false;
  await resetLocalData();
  return true;
}
