"use client";

import { stopEventPropagation } from "tldraw";
import { openFile } from "@/ide/open-file";
import { getProjectStore } from "@/ide/project";
import { focusLineage } from "@/lineage/open";
import type { CardContent } from "@/map/model";
import type { WindowKindProps } from "../window-kinds";
import { openDataWindow, parseContent } from "./data-common";
import { openDesignWindow, openPagesWindow } from "./design-common";

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
  const content = parseContent<CardContent & { focusPage?: string }>(
    shape.props.content
  );
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

  const canOpen = content.target && content.target.type !== "none";

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
      {(canOpen || content.focusPage) && (
        <div className="pos-card__actions">
          {content.focusPage && (
            <button
              type="button"
              className="pos-button pos-button--small pos-card__open"
              data-testid="card-focus"
              title="Dim everything that does not feed this page"
              onClick={() => void focusLineage(editor, content.focusPage!)}
            >
              Focus
            </button>
          )}
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
      )}
    </div>
  );
}
