/**
 * Boards: a saved arrangement of sections laid out left to right, each
 * section holding windows (or a tiled grid of windows), with labeled arrows
 * between windows and between sections and a tour (camera path) through the
 * sections. A board is a project file, `boards/<name>.json`, so it ships
 * with a project and can be edited like any other file:
 *
 *   {
 *     "name": "build-product", "title": "Build a product", "description": "...",
 *     "sections": [
 *       { "id": "data", "title": "1. Data", "grid": "grid", "cell": { "w": 520, "h": 360 },
 *         "windows": [{ "id": "roles", "kind": "data", "content": { "table": "roles" } }, ...] }
 *     ],
 *     "arrows": [{ "from": "data", "to": "schema", "label": "tables" }],
 *     "steps": [{ "section": "data", "title": "Start with data", "caption": "..." }]
 *   }
 *
 * `grid` is how the section's windows are arranged: the window manager's
 * presets (`columns`, `rows`, `grid`, `bento-1-2`, `bento-2-1`,
 * `bento-mosaic`) tile equal cells; `row` and `stack` place windows with
 * their own sizes side by side or on top of each other; `single` is one
 * window; `free` uses each window's `at` position. Sections that share a
 * `column` stack vertically; otherwise each gets its own column, left to
 * right. Window `content` is what the kind expects (a preview entry, a Data
 * window's `{table}`, note text); editors take `{file}` which is resolved
 * to the project when the board opens. Everything here is pure.
 */
import type { Point, Size } from "@/wm/types";

export const BOARDS_DIR = "boards/";

export const BOARD_GRIDS = [
  "columns",
  "rows",
  "grid",
  "bento-1-2",
  "bento-2-1",
  "bento-mosaic",
  "single",
  "row",
  "stack",
  "free",
] as const;

export type BoardGrid = (typeof BOARD_GRIDS)[number];

export interface BoardWindowSpec {
  /** Unique within the board; arrows and steps refer to it. */
  id: string;
  kind: string;
  title?: string;
  /** Kind-specific content; `{file}` for editors and markdown windows. */
  content?: string | Record<string, unknown>;
  /** Own size (used by `row`, `stack`, `single` and `free`; grids use the cell). */
  size?: Size;
  /** Position inside the section (for `free`), relative to the inner top-left. */
  at?: Point;
}

export interface BoardSectionSpec {
  id: string;
  title: string;
  grid: BoardGrid;
  windows: BoardWindowSpec[];
  /** Cell size for the tiled grids (default 560 x 400). */
  cell?: Size;
  /** Columns for `grid` (default: square-ish). */
  columns?: number;
  /** Sections with the same column stack vertically (default: own column, in order). */
  column?: number;
  notes?: string;
}

export interface BoardArrowSpec {
  /** A window id or a section id. */
  from: string;
  to: string;
  label?: string;
  color?: string;
}

export interface BoardStepSpec {
  section: string;
  title?: string;
  caption: string;
  /**
   * A CSS selector in the desktop chrome (a top-bar button, say): the tour
   * frames that element instead of the section's frame.
   */
  target?: string;
  /** A palette command run when the step is entered (opens a board, a window...). */
  run?: string;
  /** Look the section up on this board instead of the tour's own board. */
  board?: string;
  /** A closing button on the step: runs the command and ends the tour. */
  action?: { label: string; command: string };
}

export interface BoardDef {
  name: string;
  title: string;
  description?: string;
  sections: BoardSectionSpec[];
  arrows: BoardArrowSpec[];
  steps: BoardStepSpec[];
  /** Space between section columns (page units, default 160). */
  gap?: number;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function isBoardName(name: unknown): name is string {
  return typeof name === "string" && NAME_RE.test(name);
}

export function boardPath(name: string): string {
  return `${BOARDS_DIR}${name}.json`;
}

/** `boards/showcase.json` -> `showcase`; null otherwise. */
export function boardFromPath(path: string): string | null {
  const m = /^boards\/([A-Za-z0-9][A-Za-z0-9_-]*)\.json$/.exec(path);
  return m ? m[1] : null;
}

export function isBoardPath(path: string): boolean {
  return boardFromPath(path) !== null;
}

function size(raw: unknown): Size | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.w === "number" && typeof r.h === "number" && r.w > 0 && r.h > 0)
    return { w: Math.round(r.w), h: Math.round(r.h) };
  return undefined;
}

function point(raw: unknown): Point | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.x === "number" && typeof r.y === "number")
    return { x: Math.round(r.x), y: Math.round(r.y) };
  return undefined;
}

/** Parses a board file. Tolerant: problems are reported and the rest loads. */
export function parseBoard(
  text: string,
  path?: string
): { board: BoardDef | null; errors: string[] } {
  const errors: string[] = [];
  const where = path ?? "board";
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      board: null,
      errors: [
        `${where}: not valid JSON (${e instanceof Error ? e.message : String(e)})`,
      ],
    };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { board: null, errors: [`${where}: must be an object`] };
  const r = raw as Record<string, unknown>;
  const fromPath = path ? boardFromPath(path) : null;
  const name = isBoardName(r.name) ? r.name : fromPath;
  if (!name) return { board: null, errors: [`${where}: missing "name"`] };
  const title = typeof r.title === "string" && r.title ? r.title : name;

  const sections: BoardSectionSpec[] = [];
  const ids = new Set<string>();
  const list = Array.isArray(r.sections) ? r.sections : [];
  if (!Array.isArray(r.sections)) errors.push(`${where}: missing "sections"`);
  list.forEach((s, i) => {
    if (typeof s !== "object" || s === null) {
      errors.push(`${where}.sections[${i}]: must be an object`);
      return;
    }
    const q = s as Record<string, unknown>;
    const id = typeof q.id === "string" && q.id ? q.id : `section-${i + 1}`;
    if (ids.has(id)) errors.push(`${where}: duplicate id "${id}"`);
    ids.add(id);
    const grid = (BOARD_GRIDS as readonly string[]).includes(String(q.grid))
      ? (q.grid as BoardGrid)
      : "columns";
    if (q.grid !== undefined && grid !== q.grid)
      errors.push(`${where}.${id}: unknown grid "${String(q.grid)}"`);
    const windows: BoardWindowSpec[] = [];
    const rawWindows = Array.isArray(q.windows) ? q.windows : [];
    rawWindows.forEach((w, j) => {
      if (typeof w !== "object" || w === null) {
        errors.push(`${where}.${id}.windows[${j}]: must be an object`);
        return;
      }
      const x = w as Record<string, unknown>;
      if (typeof x.kind !== "string" || !x.kind) {
        errors.push(`${where}.${id}.windows[${j}]: missing "kind"`);
        return;
      }
      const wid = typeof x.id === "string" && x.id ? x.id : `${id}-${j + 1}`;
      if (ids.has(wid)) errors.push(`${where}: duplicate id "${wid}"`);
      ids.add(wid);
      const spec: BoardWindowSpec = { id: wid, kind: x.kind };
      if (typeof x.title === "string") spec.title = x.title;
      if (typeof x.content === "string") spec.content = x.content;
      else if (
        typeof x.content === "object" &&
        x.content !== null &&
        !Array.isArray(x.content)
      )
        spec.content = x.content as Record<string, unknown>;
      const sz = size(x.size);
      if (sz) spec.size = sz;
      const at = point(x.at);
      if (at) spec.at = at;
      windows.push(spec);
    });
    const section: BoardSectionSpec = {
      id,
      title: typeof q.title === "string" && q.title ? q.title : id,
      grid,
      windows,
    };
    const cell = size(q.cell);
    if (cell) section.cell = cell;
    if (typeof q.columns === "number" && q.columns >= 1)
      section.columns = Math.round(q.columns);
    if (typeof q.column === "number") section.column = Math.round(q.column);
    if (typeof q.notes === "string") section.notes = q.notes;
    sections.push(section);
  });

  const arrows: BoardArrowSpec[] = [];
  if (Array.isArray(r.arrows))
    r.arrows.forEach((a, i) => {
      if (typeof a !== "object" || a === null) return;
      const q = a as Record<string, unknown>;
      if (typeof q.from !== "string" || typeof q.to !== "string") {
        errors.push(`${where}.arrows[${i}]: needs "from" and "to"`);
        return;
      }
      const arrow: BoardArrowSpec = { from: q.from, to: q.to };
      if (typeof q.label === "string") arrow.label = q.label;
      if (typeof q.color === "string") arrow.color = q.color;
      if (!ids.has(arrow.from))
        errors.push(`${where}.arrows[${i}]: unknown "from" ${arrow.from}`);
      if (!ids.has(arrow.to))
        errors.push(`${where}.arrows[${i}]: unknown "to" ${arrow.to}`);
      arrows.push(arrow);
    });

  const steps: BoardStepSpec[] = [];
  if (Array.isArray(r.steps))
    r.steps.forEach((s, i) => {
      if (typeof s !== "object" || s === null) return;
      const q = s as Record<string, unknown>;
      if (typeof q.section !== "string") {
        errors.push(`${where}.steps[${i}]: needs "section"`);
        return;
      }
      // Steps that frame chrome, point at another board or only close the
      // tour need no section of their own.
      if (
        typeof q.board !== "string" &&
        typeof q.target !== "string" &&
        q.action === undefined &&
        !sections.some((x) => x.id === q.section)
      )
        errors.push(`${where}.steps[${i}]: unknown section "${q.section}"`);
      const step: BoardStepSpec = {
        section: q.section,
        caption: typeof q.caption === "string" ? q.caption : "",
      };
      if (typeof q.title === "string") step.title = q.title;
      if (typeof q.target === "string") step.target = q.target;
      if (typeof q.run === "string") step.run = q.run;
      if (typeof q.board === "string") step.board = q.board;
      const action = q.action as Record<string, unknown> | undefined;
      if (
        action &&
        typeof action === "object" &&
        typeof action.label === "string" &&
        typeof action.command === "string"
      )
        step.action = { label: action.label, command: action.command };
      steps.push(step);
    });

  const board: BoardDef = { name, title, sections, arrows, steps };
  if (typeof r.description === "string") board.description = r.description;
  if (typeof r.gap === "number" && r.gap >= 0) board.gap = r.gap;
  return { board, errors };
}

export function serializeBoard(board: BoardDef): string {
  const out: Record<string, unknown> = { name: board.name, title: board.title };
  if (board.description) out.description = board.description;
  if (board.gap !== undefined) out.gap = board.gap;
  out.sections = board.sections.map((s) => {
    const sec: Record<string, unknown> = {
      id: s.id,
      title: s.title,
      grid: s.grid,
    };
    if (s.cell) sec.cell = s.cell;
    if (s.columns !== undefined) sec.columns = s.columns;
    if (s.column !== undefined) sec.column = s.column;
    if (s.notes) sec.notes = s.notes;
    sec.windows = s.windows.map((w) => {
      const win: Record<string, unknown> = { id: w.id, kind: w.kind };
      if (w.title) win.title = w.title;
      if (w.content !== undefined && w.content !== "") win.content = w.content;
      if (w.size) win.size = w.size;
      if (w.at) win.at = w.at;
      return win;
    });
    return sec;
  });
  out.arrows = board.arrows;
  out.steps = board.steps;
  return JSON.stringify(out, null, 2) + "\n";
}

/** Every window of a board with its section. */
export function boardWindows(
  board: BoardDef
): { window: BoardWindowSpec; section: BoardSectionSpec }[] {
  return board.sections.flatMap((section) =>
    section.windows.map((window) => ({ window, section }))
  );
}

/** The tour: the board's steps, or one step per section when none are written. */
export function tourSteps(board: BoardDef): BoardStepSpec[] {
  if (board.steps.length) return board.steps;
  return board.sections.map((s) => ({
    section: s.id,
    title: s.title,
    caption: s.notes ?? "",
  }));
}

/** Problems that would make a board impossible to open. */
export function validateBoard(board: BoardDef): string[] {
  const errors: string[] = [];
  if (!board.sections.length) errors.push("a board needs at least one section");
  const seen = new Set<string>();
  for (const s of board.sections) {
    if (!s.windows.length && s.grid !== "free")
      errors.push(`section "${s.id}" has no windows`);
    for (const id of [s.id, ...s.windows.map((w) => w.id)]) {
      if (seen.has(id)) errors.push(`duplicate id "${id}"`);
      seen.add(id);
    }
  }
  return errors;
}
