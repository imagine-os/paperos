"use client";

import { useState } from "react";
import { useValue, type Editor } from "tldraw";
import { listBoards, openBoard, readBoard } from "@/boards/build";
import { getTourController } from "@/boards/tour-controller";
import { getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import { applyIdeWorkspace } from "./ide-workspace";
import { openSampleProject } from "./project-actions";
import { startWelcomeTour } from "./welcome-tour";

/** Opens the sample project (when none is active) and tiles the IDE workspace. */
export async function openSampleHere(editor: Editor): Promise<void> {
  const store = getProjectStore();
  await store.init();
  if (!store.getActiveId()) await openSampleProject();
  await applyIdeWorkspace(editor);
}

/**
 * Plays the first board of the active project ("Build a product" when it is
 * there), opening the sample first when no project is active. Returns the
 * board played, or null when the project has no boards.
 */
export async function playFirstBoard(editor: Editor): Promise<string | null> {
  const store = getProjectStore();
  await store.init();
  let project = store.getActiveId();
  if (!project) project = (await openSampleProject()).id;
  const boards = await listBoards(project, editor);
  const pick =
    boards.find((b) => b.name === "build-product") ??
    boards.find((b) => b.name === "showcase") ??
    boards[0];
  if (!pick) return null;
  const board = await readBoard(project, pick.name);
  openBoard(editor, board, { project });
  getTourController(editor).play(board);
  return pick.name;
}

/**
 * The card an empty canvas shows: three ways in. Hidden as soon as a window
 * exists on the page or a tour is playing.
 */
export function StartHere({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return <StartHereCard editor={editor} />;
}

function StartHereCard({ editor }: { editor: Editor }) {
  const projects = getProjectStore();
  const state = useSignal(projects.state);
  const empty = useValue(
    "canvas has no windows",
    () => !editor.getCurrentPageShapes().some((s) => s.type === "window"),
    [editor]
  );
  const touring = useValue(
    "tour playing",
    () => getTourController(editor).state.get() !== null,
    [editor]
  );
  const [busy, setBusy] = useState<string | null>(null);
  if (!empty || touring || state.status === "loading") return null;

  const run = (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    void fn()
      .catch((e) => window.alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };

  return (
    <div className="pos-start" data-testid="start-here">
      <div className="pos-start__card" role="region" aria-label="Start here">
        <span className="pos-start__kicker">Start here</span>
        <h2 className="pos-start__title">An empty canvas</h2>
        <p className="pos-start__text">
          Windows are the one primitive: files, editors, previews, data, pages
          and boards all live in windows you tile and arrange.
        </p>
        <div className="pos-start__actions">
          <button
            type="button"
            className="pos-button pos-button--primary"
            disabled={busy !== null}
            data-testid="start-sample"
            onClick={() => run("sample", () => openSampleHere(editor))}
          >
            Open sample
          </button>
          <button
            type="button"
            className="pos-button"
            disabled={busy !== null}
            data-testid="start-board"
            onClick={() =>
              run("board", async () => {
                const name = await playFirstBoard(editor);
                if (!name)
                  window.alert(
                    "This project has no boards/*.json. Open the sample to see one."
                  );
              })
            }
          >
            Play a board
          </button>
          <button
            type="button"
            className="pos-button"
            disabled={busy !== null}
            data-testid="start-tour"
            onClick={() => run("tour", () => startWelcomeTour(editor))}
          >
            Watch the tour
          </button>
        </div>
        <p className="pos-start__hint">
          Or press <kbd>w</kbd> and click to place a window, drop a folder or
          ZIP here, or open <strong>New window</strong> above.
        </p>
      </div>
    </div>
  );
}
