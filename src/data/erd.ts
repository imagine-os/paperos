/**
 * Entity-relationship layout for the Schema window: tables as boxes placed
 * in layers (a table sits right of the tables it refers to), ref columns
 * as edges from the column row to the target's header. Pure geometry; the
 * window draws it with SVG.
 */
import type { DataSchema } from "./schema";

export interface ErdNode {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  columns: {
    name: string;
    type: string;
    ref?: string;
    key: boolean;
    y: number;
  }[];
}

export interface ErdEdge {
  from: string;
  column: string;
  to: string;
  /** Polyline points, in layout units. */
  points: { x: number; y: number }[];
  self: boolean;
}

export interface ErdLayout {
  nodes: ErdNode[];
  edges: ErdEdge[];
  width: number;
  height: number;
}

export interface ErdOptions {
  boxWidth?: number;
  headerHeight?: number;
  rowHeight?: number;
  gapX?: number;
  gapY?: number;
  padding?: number;
}

/** Longest ref path from each table to a table with no outgoing refs (cycles broken). */
export function erdLayers(schema: DataSchema): Map<string, number> {
  const names = new Set(schema.tables.map((t) => t.name));
  const out = new Map<string, number>();
  const visiting = new Set<string>();
  const layer = (name: string): number => {
    if (out.has(name)) return out.get(name)!;
    if (visiting.has(name)) return 0;
    visiting.add(name);
    const t = schema.tables.find((x) => x.name === name)!;
    let l = 0;
    for (const c of t.columns) {
      if (c.type === "ref" && c.ref && c.ref !== name && names.has(c.ref))
        l = Math.max(l, layer(c.ref) + 1);
    }
    visiting.delete(name);
    out.set(name, l);
    return l;
  };
  for (const t of schema.tables) layer(t.name);
  return out;
}

export function layoutErd(
  schema: DataSchema,
  options: ErdOptions = {}
): ErdLayout {
  const boxWidth = options.boxWidth ?? 190;
  const headerHeight = options.headerHeight ?? 30;
  const rowHeight = options.rowHeight ?? 20;
  const gapX = options.gapX ?? 90;
  const gapY = options.gapY ?? 28;
  const padding = options.padding ?? 24;

  const layers = erdLayers(schema);
  const columns = new Map<number, string[]>();
  for (const t of schema.tables) {
    const l = layers.get(t.name) ?? 0;
    (columns.get(l) ?? columns.set(l, []).get(l)!).push(t.name);
  }
  const nodes: ErdNode[] = [];
  const byName = new Map<string, ErdNode>();
  let width = padding;
  let height = padding;
  for (const l of [...columns.keys()].sort((a, b) => a - b)) {
    let y = padding;
    const x = padding + l * (boxWidth + gapX);
    for (const name of columns.get(l)!) {
      const t = schema.tables.find((x) => x.name === name)!;
      const h = headerHeight + t.columns.length * rowHeight + 6;
      const node: ErdNode = {
        name,
        x,
        y,
        w: boxWidth,
        h,
        layer: l,
        columns: t.columns.map((c, i) => ({
          name: c.name,
          type: c.type,
          ref: c.ref,
          key: c.name === t.primaryKey,
          y: headerHeight + i * rowHeight + rowHeight / 2 + 3,
        })),
      };
      nodes.push(node);
      byName.set(name, node);
      y += h + gapY;
    }
    width = Math.max(width, x + boxWidth + padding);
    height = Math.max(height, y - gapY + padding);
  }

  const edges: ErdEdge[] = [];
  for (const t of schema.tables) {
    const from = byName.get(t.name)!;
    for (const c of t.columns) {
      if (c.type !== "ref" || !c.ref) continue;
      const to = byName.get(c.ref);
      if (!to) continue;
      const row = from.columns.find((x) => x.name === c.name)!;
      const fy = from.y + row.y;
      if (to === from) {
        const x0 = from.x + from.w;
        edges.push({
          from: t.name,
          column: c.name,
          to: c.ref,
          self: true,
          points: [
            { x: x0, y: fy },
            { x: x0 + 22, y: fy },
            { x: x0 + 22, y: from.y + headerHeight / 2 },
            { x: x0, y: from.y + headerHeight / 2 },
          ],
        });
        continue;
      }
      const leftToRight = to.x >= from.x + from.w;
      const start = { x: leftToRight ? from.x + from.w : from.x, y: fy };
      const end = {
        x: leftToRight ? to.x : to.x + to.w,
        y: to.y + headerHeight / 2,
      };
      const midX = (start.x + end.x) / 2;
      edges.push({
        from: t.name,
        column: c.name,
        to: c.ref,
        self: false,
        points: [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
      });
    }
  }
  return {
    nodes,
    edges,
    width: Math.max(width, padding * 2),
    height: Math.max(height, padding * 2),
  };
}
