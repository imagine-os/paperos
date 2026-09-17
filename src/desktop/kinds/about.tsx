"use client";

import { stopEventPropagation } from "tldraw";
import { openKindWindow } from "./data-common";
import { startWelcomeTour } from "../welcome-tour";
import type { WindowKindProps } from "../window-kinds";

/** What PaperOS v2 is, with the ways in: the tour and the keyboard map. */
export function AboutWindow({ editor }: WindowKindProps) {
  return (
    <div
      className="pos-about"
      data-testid="about-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <h2>PaperOS v2</h2>
      <p>
        A zoomable canvas that behaves like an OS desktop. Windows are the one
        primitive: everything you open lives in a window you can move, resize
        and arrange.
      </p>
      <div className="pos-about__actions">
        <button
          type="button"
          className="pos-button pos-button--small pos-button--primary"
          data-testid="about-take-tour"
          onClick={() => void startWelcomeTour(editor)}
        >
          Take the tour
        </button>
        <button
          type="button"
          className="pos-button pos-button--small"
          data-testid="about-keyboard"
          onClick={() => openKindWindow(editor, "keys", "", { reuse: true })}
        >
          Keyboard shortcuts <kbd>?</kbd>
        </button>
      </div>
      <ul>
        <li>
          Press <kbd>w</kbd> and click the canvas, or use New window, to open a
          window. Windows created on the same spot cascade.
        </li>
        <li>Drag the title bar to move. Drag the corners to resize.</li>
        <li>The canvas is saved in this browser and survives refresh.</li>
        <li>
          <strong>Open</strong> loads a project: a folder (Chromium), the sample
          site, a ZIP or a public GitHub repository. Files, Editor, Preview,
          Console and Markdown windows work on it.
        </li>
        <li>
          <kbd>Ctrl+K</kbd> opens the command palette.
        </li>
        <li>
          <strong>Script</strong> windows run JavaScript against the Canvas API
          (<code>paperos</code>, also in the devtools); <strong>Plugins</strong>{" "}
          add commands and window kinds; the <strong>Agent bridge</strong> lets
          an MCP agent drive the canvas.
        </li>
        <li>
          <strong>Share</strong> opens a live room: cursors, shared windows and
          files, no account.
        </li>
      </ul>
      <p className="pos-about__muted">
        Local-first: projects, documents and the canvas live in this browser.
        The plan and every decision are in the repository&apos;s docs.
      </p>
    </div>
  );
}
