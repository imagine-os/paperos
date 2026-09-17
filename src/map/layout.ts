/**
 * Places a project map: sections as columns left to right, nodes stacked in
 * a small grid inside each section, no overlaps. Nodes whose position is
 * passed in `keep` stay where they are (the user moved them); new nodes take
 * free slots and the section frame grows to cover everything. Pure.
 */
import type { Rect } from "@/wm/types";
import type { MapGraph, MapSectionId } from "./model";

export interface MapLayoutOptions {
  /** Default card size (page units). */
  card: { w: number; h: number };
  /** Space between cards. */
  gapX: number;
  gapY: number;
  /** Space between section frames. */
  sectionGap: number;
  /** Space between a frame's edge and its cards. */
  padding: number;
  /** Extra room under a frame's top edge for the title. */
  header: number;
  /** Cards per row inside a section (more rows than this stack into another column). */
  columns: (count: number) => number;
  /** Where the first section's frame starts. */
  origin: { x: number; y: number };
}

export const DEFAULT_MAP_LAYOUT: MapLayoutOptions = {
  card: { w: 240, h: 120 },
  gapX: 28,
  gapY: 22,
  sectionGap: 140,
  padding: 24,
  header: 16,
  columns: (count) => (count <= 8 ? 1 : count <= 20 ? 2 : 3),
  origin: { x: 0, y: 0 },
};

export interface PlacedNode extends Rect {
  key: string;
  section: MapSectionId;
}

export interface PlacedSection extends Rect {
  id: MapSectionId;
  title: string;
}

export interface MapLayout {
  sections: PlacedSection[];
  nodes: PlacedNode[];
  bounds: Rect;
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function layoutMap(
  graph: MapGraph,
  keep: Record<string, { x: number; y: number }> = {},
  options: Partial<MapLayoutOptions> = {}
): MapLayout {
  const o = { ...DEFAULT_MAP_LAYOUT, ...options };
  const sections: PlacedSection[] = [];
  const nodes: PlacedNode[] = [];
  let cursorX = o.origin.x;

  for (const section of graph.sections) {
    const list = graph.nodes.filter((n) => n.section === section.id);
    if (!list.length) continue;
    const placed: PlacedNode[] = [];
    const size = (n: (typeof list)[number]) => n.size ?? o.card;

    // Kept nodes first: they anchor the section.
    for (const n of list) {
      const k = keep[n.key];
      if (k)
        placed.push({
          key: n.key,
          section: section.id,
          x: k.x,
          y: k.y,
          ...size(n),
        });
    }
    const fresh = list.filter((n) => !keep[n.key]);
    const cols = section.horizontal
      ? Math.max(1, fresh.length)
      : o.columns(fresh.length);
    // A row of cards carries arrows between neighbors: leave room for their labels.
    const gapX = section.horizontal ? o.gapX * 4 : o.gapX;
    const colW = Math.max(...list.map((n) => size(n).w), o.card.w);
    // New nodes go under the kept ones (or at the section's top when nothing is kept).
    const anchorX = placed.length
      ? Math.min(...placed.map((p) => p.x))
      : cursorX + o.padding;
    const startY = placed.length
      ? Math.max(...placed.map((p) => p.y + p.h)) + o.gapY
      : o.origin.y + o.padding + o.header;
    const rows = Math.max(1, Math.ceil(fresh.length / cols));
    fresh.forEach((n, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const s = size(n);
      let rect: Rect = {
        x: anchorX + col * (colW + gapX),
        y: startY + row * (o.card.h + o.gapY),
        w: s.w,
        h: s.h,
      };
      // Slide down until the slot is free (kept nodes may sit anywhere).
      let guard = 0;
      while (placed.some((p) => overlaps(p, rect)) && guard++ < 200)
        rect = { ...rect, y: rect.y + o.card.h + o.gapY };
      placed.push({ key: n.key, section: section.id, ...rect });
    });

    const minX = Math.min(...placed.map((p) => p.x));
    const minY = Math.min(...placed.map((p) => p.y));
    const maxX = Math.max(...placed.map((p) => p.x + p.w));
    const maxY = Math.max(...placed.map((p) => p.y + p.h));
    const frame: PlacedSection = {
      id: section.id,
      title: section.title,
      x: minX - o.padding,
      y: minY - o.padding - o.header,
      w: maxX - minX + o.padding * 2,
      h: maxY - minY + o.padding * 2 + o.header,
    };
    sections.push(frame);
    nodes.push(...placed);
    cursorX = Math.max(cursorX, frame.x + frame.w) + o.sectionGap;
  }

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
  return { sections, nodes, bounds };
}
