/**
 * Places a board: each section becomes a frame whose windows are arranged
 * by its grid (the window manager's engine for the tiled presets, own sizes
 * for `row` / `stack` / `single` / `free`); sections that share a column
 * stack vertically, columns run left to right, and every column is centered
 * on the tallest one so the board reads as a flowchart. No overlaps by
 * construction. Pure.
 */
import { layout } from "@/wm/layout-engine";
import { buildPreset } from "@/wm/presets";
import { leaf, split } from "@/wm/tree";
import type { LayoutNode, Point, Rect, Size } from "@/wm/types";
import type { BoardDef, BoardSectionSpec } from "./model";

export interface BoardLayoutOptions {
  /** Where the first column starts (page units). */
  origin: Point;
  /** Space between section columns. */
  sectionGap: number;
  /** Space between stacked sections in one column. */
  rowGap: number;
  /** Space between a frame's edge and its windows. */
  padding: number;
  /** Extra room under a frame's top edge for the title. */
  header: number;
  /** Default cell for the tiled grids. */
  cell: Size;
  /** Space between windows. */
  gap: number;
}

export const DEFAULT_BOARD_LAYOUT: BoardLayoutOptions = {
  origin: { x: 0, y: 0 },
  sectionGap: 180,
  rowGap: 80,
  padding: 24,
  header: 16,
  cell: { w: 560, h: 400 },
  gap: 16,
};

export interface PlacedBoardWindow extends Rect {
  id: string;
  section: string;
}

export interface PlacedBoardSection extends Rect {
  id: string;
  title: string;
  column: number;
}

export interface BoardLayout {
  sections: PlacedBoardSection[];
  windows: PlacedBoardWindow[];
  bounds: Rect;
}

interface InnerLayout {
  size: Size;
  windows: { id: string; rect: Rect }[];
}

const MIN = { w: 240, h: 160 };

/** Windows of one section at the origin, plus the inner size they need. */
export function layoutSection(
  section: BoardSectionSpec,
  o: BoardLayoutOptions
): InnerLayout {
  const wins = section.windows;
  const gap = o.gap;
  if (!wins.length) return { size: { w: o.cell.w, h: o.cell.h }, windows: [] };
  const sizeOf = (w: BoardSectionSpec["windows"][number]): Size =>
    w.size ?? section.cell ?? o.cell;

  switch (section.grid) {
    case "single": {
      const s = sizeOf(wins[0]);
      return {
        size: s,
        windows: wins.slice(0, 1).map((w) => ({
          id: w.id,
          rect: { x: 0, y: 0, ...s },
        })),
      };
    }
    case "row": {
      let x = 0;
      let h = 0;
      const out = wins.map((w) => {
        const s = sizeOf(w);
        const rect = { x, y: 0, w: s.w, h: s.h };
        x += s.w + gap;
        h = Math.max(h, s.h);
        return { id: w.id, rect };
      });
      return { size: { w: x - gap, h }, windows: out };
    }
    case "stack": {
      let y = 0;
      let w = 0;
      const out = wins.map((win) => {
        const s = sizeOf(win);
        const rect = { x: 0, y, w: s.w, h: s.h };
        y += s.h + gap;
        w = Math.max(w, s.w);
        return { id: win.id, rect };
      });
      return { size: { w, h: y - gap }, windows: out };
    }
    case "free": {
      const out = wins.map((w) => {
        const s = sizeOf(w);
        const at = w.at ?? { x: 0, y: 0 };
        return { id: w.id, rect: { x: at.x, y: at.y, w: s.w, h: s.h } };
      });
      const maxX = Math.max(...out.map((p) => p.rect.x + p.rect.w));
      const maxY = Math.max(...out.map((p) => p.rect.y + p.rect.h));
      return { size: { w: maxX, h: maxY }, windows: out };
    }
    default: {
      // Tiled presets: equal cells (the largest requested size), the engine places them.
      const cell = wins.reduce<Size>((acc, w) => {
        const s = sizeOf(w);
        return { w: Math.max(acc.w, s.w), h: Math.max(acc.h, s.h) };
      }, section.cell ?? o.cell);
      const n = wins.length;
      let cols: number;
      let rows: number;
      let tree: LayoutNode | null;
      const ids = wins.map((w) => w.id);
      if (section.grid === "rows") {
        cols = 1;
        rows = n;
        tree = n === 1 ? leaf(ids[0]) : split("vertical", ids.map(leaf));
      } else if (section.grid === "grid") {
        cols = Math.max(
          1,
          Math.min(n, section.columns ?? Math.ceil(Math.sqrt(n)))
        );
        rows = Math.ceil(n / cols);
        tree =
          n === 1
            ? leaf(ids[0])
            : {
                type: "grid",
                id: `g-${section.id}`,
                cols,
                rows,
                children: ids.map(leaf),
              };
      } else if (section.grid === "columns") {
        cols = n;
        rows = 1;
        tree = buildPreset("columns", ids);
      } else {
        // Bento shapes: two by two cells, more windows share the last slot.
        cols = 2;
        rows = 2;
        tree = buildPreset(section.grid, ids);
      }
      const size: Size = {
        w: cols * cell.w + (cols - 1) * gap,
        h: rows * cell.h + (rows - 1) * gap,
      };
      const frames = layout(
        tree,
        { x: 0, y: 0, ...size },
        { gap, padding: 0, minSize: MIN }
      );
      return {
        size,
        windows: ids.map((id) => {
          const r = frames.windows.get(id) ?? { x: 0, y: 0, ...cell };
          return {
            id,
            rect: {
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.w),
              h: Math.round(r.h),
            },
          };
        }),
      };
    }
  }
}

export function layoutBoard(
  board: BoardDef,
  options: Partial<BoardLayoutOptions> = {}
): BoardLayout {
  const o: BoardLayoutOptions = {
    ...DEFAULT_BOARD_LAYOUT,
    ...options,
    ...(board.gap !== undefined && options.sectionGap === undefined
      ? { sectionGap: board.gap }
      : {}),
  };
  // Frames at the origin, grouped by column.
  const inner = board.sections.map((s) => ({
    section: s,
    ...layoutSection(s, o),
  }));
  const frameSize = (i: (typeof inner)[number]): Size => ({
    w: i.size.w + o.padding * 2,
    h: i.size.h + o.padding * 2 + o.header,
  });
  const columns = new Map<number, number[]>();
  inner.forEach((entry, i) => {
    const col = entry.section.column ?? i;
    const list = columns.get(col) ?? [];
    list.push(i);
    columns.set(col, list);
  });
  const orderedColumns = [...columns.entries()].sort((a, b) => a[0] - b[0]);
  const columnHeights = orderedColumns.map(([, idx]) =>
    idx.reduce((h, i, k) => h + frameSize(inner[i]).h + (k ? o.rowGap : 0), 0)
  );
  const tallest = Math.max(0, ...columnHeights);

  const sections: PlacedBoardSection[] = [];
  const windows: PlacedBoardWindow[] = [];
  let cursorX = o.origin.x;
  orderedColumns.forEach(([col, idx], c) => {
    const width = Math.max(...idx.map((i) => frameSize(inner[i]).w));
    let y = o.origin.y + (tallest - columnHeights[c]) / 2;
    for (const i of idx) {
      const entry = inner[i];
      const fs = frameSize(entry);
      // Center narrower frames in their column.
      const x = cursorX + (width - fs.w) / 2;
      const frame: PlacedBoardSection = {
        id: entry.section.id,
        title: entry.section.title,
        column: col,
        x: Math.round(x),
        y: Math.round(y),
        w: fs.w,
        h: fs.h,
      };
      sections.push(frame);
      for (const w of entry.windows)
        windows.push({
          id: w.id,
          section: entry.section.id,
          x: frame.x + o.padding + w.rect.x,
          y: frame.y + o.padding + o.header + w.rect.y,
          w: w.rect.w,
          h: w.rect.h,
        });
      y += fs.h + o.rowGap;
    }
    cursorX += width + o.sectionGap;
  });

  const bounds: Rect = sections.length
    ? {
        x: Math.min(...sections.map((s) => s.x)),
        y: Math.min(...sections.map((s) => s.y)),
        w: 0,
        h: 0,
      }
    : { x: o.origin.x, y: o.origin.y, w: 0, h: 0 };
  if (sections.length) {
    bounds.w = Math.max(...sections.map((s) => s.x + s.w)) - bounds.x;
    bounds.h = Math.max(...sections.map((s) => s.y + s.h)) - bounds.y;
  }
  return { sections, windows, bounds };
}

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
