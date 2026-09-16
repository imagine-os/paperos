"use client";

/** Static description of PaperOS v2. */
export function AboutWindow() {
  return (
    <div className="pos-about">
      <h2>PaperOS v2</h2>
      <p>
        A zoomable canvas that behaves like an OS desktop. Windows are the one
        primitive: everything you open lives in a window you can move, resize
        and arrange.
      </p>
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
      </ul>
      <p className="pos-about__muted">
        Coming next: collaboration (shared canvas, cursors, shared documents).
      </p>
    </div>
  );
}
