"use client";

import { stopEventPropagation } from "tldraw";
import { openFile } from "@/ide/open-file";
import { getProjectStore } from "@/ide/project";
import type { WindowKindProps } from "../window-kinds";
import { openDataWindow, parseContent } from "./data-common";
import { openDesignWindow, openPagesWindow } from "./design-common";

/** What a project-map node points at. */
export type CardTarget =
  | { type: "table"; table: string }
  | { type: "file"; path: string }
  | { type: "component"; name: string }
  | { type: "page"; name: string }
  | { type: "tokens" }
  | { type: "folder"; path: string }
  | { type: "none" };

/** What a Card window keeps in `content`. */
export interface CardContent {
  /** Stable key (`table:users`, `file:app.js`, ...) so map regeneration keeps positions. */
  key?: string;
  subtitle?: string;
  icon?: string;
  /** Section the card belongs to (for styling). */
  section?: string;
  /** Small facts shown under the subtitle. */
  facts?: string[];
  target?: CardTarget;
}

const SECTION_TONES: Record<string, string> = {
  data: "data",
  code: "code",
  components: "components",
  pages: "pages",
  design: "design",
  flows: "flows",
};

/** A light node for the project map: title, subtitle, a few facts, and a click that opens the real thing. */
export function CardWindow({ shape, editor }: WindowKindProps) {
  const content = parseContent<CardContent>(shape.props.content);
  const tone = SECTION_TONES[content.section ?? ""] ?? "plain";

  const open = () => {
    const project = getProjectStore().getActiveId();
    const t = content.target;
    if (!t || t.type === "none") return;
    switch (t.type) {
      case "table":
        openDataWindow(editor, { table: t.table });
        return;
      case "file":
      case "folder":
        if (project)
          openFile(editor, { project, path: t.path }, { nearId: shape.id });
        return;
      case "component":
        openDesignWindow(editor, { tab: "components", component: t.name });
        return;
      case "page":
        openPagesWindow(editor, { page: t.name });
        return;
      case "tokens":
        openDesignWindow(editor, { tab: "tokens" });
        return;
    }
  };

  const canOpen =
    content.target &&
    content.target.type !== "none" &&
    content.target.type !== "folder";

  return (
    <div
      className={`pos-card pos-card--${tone}`}
      data-testid="card-window"
      data-key={content.key}
      onPointerDown={stopEventPropagation}
    >
      <div className="pos-card__body">
        {content.icon && (
          <div className="pos-card__icon" aria-hidden="true">
            {content.icon}
          </div>
        )}
        <div className="pos-card__text">
          {content.subtitle && (
            <div className="pos-card__subtitle">{content.subtitle}</div>
          )}
          {content.facts && content.facts.length > 0 && (
            <ul className="pos-card__facts">
              {content.facts.slice(0, 6).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {canOpen && (
        <button
          type="button"
          className="pos-button pos-button--small pos-card__open"
          data-testid="card-open"
          onClick={open}
        >
          Open
        </button>
      )}
    </div>
  );
}
