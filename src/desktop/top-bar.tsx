"use client";

import Link from "next/link";
import type { Editor } from "tldraw";
import { createWindow } from "./create-window";

export function TopBar({ editor }: { editor: Editor | null }) {
  return (
    <header className="pos-topbar" data-testid="topbar">
      <div className="pos-topbar__brand">
        <span className="pos-topbar__name">PaperOS</span>
        <span className="pos-topbar__badge">v2 preview</span>
      </div>
      <div className="pos-topbar__actions">
        <button
          type="button"
          className="pos-button pos-button--primary"
          disabled={!editor}
          onClick={() => editor && createWindow(editor, { kind: "note" })}
        >
          New window
        </button>
        <button
          type="button"
          className="pos-button"
          disabled={!editor}
          onClick={() => editor && createWindow(editor, { kind: "about" })}
        >
          About
        </button>
        <Link className="pos-topbar__link" href="/legacy">
          Legacy prototype
        </Link>
      </div>
    </header>
  );
}
