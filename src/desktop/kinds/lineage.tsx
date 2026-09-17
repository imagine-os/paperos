"use client";

import { useEffect, useState } from "react";
import { stopEventPropagation, useValue } from "tldraw";
import {
  focusLineage,
  lineageFocusPage,
  lineagePages,
  openLineage,
} from "@/lineage/open";
import { getProjectStore } from "@/ide/project";
import { useSignal } from "@/ide/use-signal";
import type { WindowKindProps } from "../window-kinds";

/**
 * The controls of a Data lineage board: pick a page to dim everything that
 * does not feed it, open one page's lineage next to its Page Builder, and
 * the legend for the arrows.
 */
export function LineageWindow({ editor }: WindowKindProps) {
  const projects = getProjectStore();
  const state = useSignal(projects.state);
  const changes = useSignal(projects.changes);
  const project = state.activeId;
  const focus = useValue(lineageFocusPage);
  const [pages, setPages] = useState<{ name: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!project) return;
    void lineagePages(project).then((list) => {
      if (!cancelled) setPages(list);
    });
    return () => {
      cancelled = true;
    };
  }, [project, changes]);

  const pick = async (page: string | null) => {
    setBusy(true);
    try {
      await focusLineage(editor, page);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="pos-lineage"
      data-testid="lineage-window"
      onPointerDown={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      <p className="pos-lineage__text">
        Tables on the left, the components that bind them in the middle, the
        pages they render on at the right. Arrows say which fields each
        component reads or writes.
      </p>
      <label className="pos-lineage__row">
        <span>Focus page</span>
        <select
          className="pos-select"
          value={focus ?? ""}
          disabled={busy}
          data-testid="lineage-page"
          onChange={(e) => void pick(e.target.value || null)}
        >
          <option value="">All pages</option>
          {pages.map((p) => (
            <option key={p.name} value={p.name}>
              {p.title} ({p.name})
            </option>
          ))}
        </select>
      </label>
      <div className="pos-lineage__actions">
        <button
          type="button"
          className="pos-button pos-button--small"
          disabled={!focus}
          data-testid="lineage-open-page"
          onClick={() => focus && void openLineage(editor, { page: focus })}
        >
          Open lineage for this page
        </button>
      </div>
      <ul className="pos-lineage__legend">
        <li>
          <span className="pos-lineage__swatch" data-tone="read" /> table →
          component: fields read (and filter)
        </li>
        <li>
          <span className="pos-lineage__swatch" data-tone="write" /> a write
        </li>
        <li>
          <span className="pos-lineage__swatch" data-tone="usage" /> component →
          page: rendered on
        </li>
      </ul>
      <p className="pos-lineage__hint">
        Hover a badge in a Preview with &quot;Data sources&quot; on to outline
        its table here.
      </p>
    </div>
  );
}
