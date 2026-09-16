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
      </ul>
      <p className="pos-about__muted">
        Coming next: a tiling engine, IDE tools inside windows, and a Canvas API
        that makes the desktop programmable.
      </p>
    </div>
  );
}
