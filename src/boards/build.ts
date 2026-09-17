/**
 * Boards on the canvas: `openBoard` draws a board (frames, windows, arrows)
 * from its layout, `saveBoard` captures the canvas into a board file, and
 * `listBoards` / `readBoard` read `boards/*.json` from the active project.
 * Frames, windows and arrows a board owns carry `meta.paperosBoard` so a
 * board can be reopened in place and the tour can find its sections.
 */
import {
  createShapeId,
  type Editor,
  type TLArrowShape,
  type TLFrameShape,
  type TLShapeId,
} from "tldraw";
import { connectWindows, listFlows } from "@/desktop/flow";
import { getWindowKind } from "@/desktop/window-kinds";
import {
  createSection,
  SECTION_HEADER,
  SECTION_PADDING,
} from "@/desktop/sections";
import type { WindowShape } from "@/desktop/window-shape";
import { getWorkspaceStore } from "@/desktop/workspaces";
import { encodeFileRef, parseFileRef } from "@/ide/file-ref";
import { readLiveText, writeLiveText } from "@/ide/docs";
import { fileWindowTitle } from "@/ide/open-file";
import { getProjectStore, type ProjectStore } from "@/ide/project/store";
import type { Rect } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { layoutBoard } from "./layout";
import {
  boardFromPath,
  boardPath,
  parseBoard,
  serializeBoard,
  validateBoard,
  type BoardDef,
  type BoardSectionSpec,
  type BoardWindowSpec,
} from "./model";

export const BOARD_META = "paperosBoard";
export const BOARD_SECTION_META = "boardSection";
export const BOARD_WINDOW_META = "boardWindow";
export const BOARD_COLOR_META = "boardColor";

export interface BoardInfo {
  name: string;
  title: string;
  path: string;
  description?: string;
  sections: number;
  windows: number;
  /** True when the board's frames are on the current page. */
  onCanvas: boolean;
}

export interface BoardResult {
  name: string;
  title: string;
  sections: number;
  windows: number;
  arrows: number;
  bounds: Rect;
  workspace: { id: string; name: string } | null;
}

/** The text content a window gets from its board spec (editors resolve `{file}`). */
export function resolveWindowContent(
  spec: BoardWindowSpec,
  project: string | null
): string {
  const c = spec.content;
  if (c === undefined || c === null) return "";
  if (typeof c === "string") return c;
  if (
    (spec.kind === "editor" || spec.kind === "markdown") &&
    typeof c.file === "string"
  )
    return project ? encodeFileRef({ project, path: c.file }) : "";
  return JSON.stringify(c);
}

/** The title a board window gets: its own, the file name for editors, else the kind's default. */
export function resolveWindowTitle(spec: BoardWindowSpec): string {
  if (spec.title) return spec.title;
  const c = spec.content;
  if (
    (spec.kind === "editor" || spec.kind === "markdown") &&
    c &&
    typeof c === "object" &&
    typeof c.file === "string"
  )
    return fileWindowTitle(c.file);
  if (spec.kind === "data" && c && typeof c === "object" && c.table)
    return `Data: ${String(c.table)}`;
  return getWindowKind(spec.kind)?.defaultTitle ?? spec.kind;
}

/** The frames, windows and arrows that belong to a board (by name, or any board). */
export function boardShapes(editor: Editor, name?: string) {
  const owns = (s: { meta: Record<string, unknown> }) =>
    typeof s.meta[BOARD_META] === "string" &&
    (name === undefined || s.meta[BOARD_META] === name);
  const shapes = editor.getCurrentPageShapes();
  return {
    frames: shapes.filter(
      (s): s is TLFrameShape => s.type === "frame" && owns(s)
    ),
    windows: shapes.filter(
      (s): s is WindowShape => s.type === "window" && owns(s)
    ),
    arrows: shapes.filter(
      (s): s is TLArrowShape => s.type === "arrow" && owns(s)
    ),
  };
}

/** Names of the boards currently drawn on the page. */
export function boardsOnCanvas(editor: Editor): string[] {
  const names = new Set<string>();
  for (const f of boardShapes(editor).frames)
    names.add(String(f.meta[BOARD_META]));
  return [...names];
}

/** Removes a board's frames, windows and arrows from the canvas. */
export function removeBoard(editor: Editor, name: string): number {
  const { frames, windows, arrows } = boardShapes(editor, name);
  const ids: TLShapeId[] = [
    ...arrows.map((a) => a.id),
    ...windows.map((w) => w.id),
    ...frames.map((f) => f.id),
  ];
  if (ids.length) editor.deleteShapes(ids);
  return ids.length;
}

/** Where a fresh board goes: right of everything on the page, or the viewport's top-left. */
function freshOrigin(editor: Editor): { x: number; y: number } {
  const bounds = editor.getCurrentPageBounds();
  if (bounds) return { x: bounds.maxX + 240, y: bounds.y };
  const v = editor.getViewportPageBounds();
  return { x: v.x + 80, y: v.y + 80 };
}

const ARROW_COLORS = new Set<TLArrowShape["props"]["color"]>([
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
  "white",
]);

function arrowColor(color?: string): TLArrowShape["props"]["color"] {
  return color && ARROW_COLORS.has(color as TLArrowShape["props"]["color"])
    ? (color as TLArrowShape["props"]["color"])
    : "black";
}

/**
 * Draws a board: one frame per section, the windows inside, the arrows
 * between windows and sections. An earlier copy of the same board is
 * replaced in place (same origin); otherwise the board lands right of
 * everything else. The camera zooms to it and a "Board: <title>" workspace
 * remembers the camera.
 */
export function openBoard(
  editor: Editor,
  board: BoardDef,
  options: { project?: string | null; origin?: { x: number; y: number } } = {}
): BoardResult {
  const problems = validateBoard(board);
  if (problems.length)
    throw new Error(`Board "${board.name}": ${problems.join("; ")}`);
  const project = options.project ?? getProjectStore().getActiveId();
  const previous = boardShapes(editor, board.name);
  let origin = options.origin;
  if (!origin && previous.frames.length) {
    const rects = previous.frames
      .map((f) => editor.getShapePageBounds(f.id))
      .filter((b) => b !== undefined);
    if (rects.length)
      origin = {
        x: Math.min(...rects.map((r) => r.x)),
        y: Math.min(...rects.map((r) => r.y)),
      };
  }
  const layout = layoutBoard(board, {
    origin: origin ?? freshOrigin(editor),
    padding: SECTION_PADDING,
    header: SECTION_HEADER,
  });
  const wm = getWindowManager(editor);
  const shapeIds = new Map<string, TLShapeId>();

  editor.run(() => {
    editor.markHistoryStoppingPoint(`open board ${board.name}`);
    removeBoard(editor, board.name);
    // Frames.
    for (const s of layout.sections) {
      const id = createSection(editor, s.title, [], s);
      editor.updateShape<TLFrameShape>({
        id,
        type: "frame",
        meta: { [BOARD_META]: board.name, [BOARD_SECTION_META]: s.id },
      });
      shapeIds.set(s.id, id);
    }
    // Windows, parented into their frames.
    const specs = new Map<string, BoardWindowSpec>();
    for (const s of board.sections)
      for (const w of s.windows) specs.set(w.id, w);
    for (const placed of layout.windows) {
      const spec = specs.get(placed.id)!;
      const id = createShapeId();
      editor.createShape<WindowShape>({
        id,
        type: "window",
        x: placed.x,
        y: placed.y,
        meta: { [BOARD_META]: board.name, [BOARD_WINDOW_META]: spec.id },
        props: {
          w: placed.w,
          h: placed.h,
          title: resolveWindowTitle(spec),
          kind: spec.kind,
          content: resolveWindowContent(spec, project),
          tiled: false,
        },
      });
      shapeIds.set(spec.id, id);
      const frameId = shapeIds.get(placed.section);
      if (frameId) editor.reparentShapes([id], frameId);
      if (wm.isTiled(id)) wm.floatWindow(id);
    }
    // Arrows between windows and/or sections.
    for (const a of board.arrows) {
      const from = shapeIds.get(a.from);
      const to = shapeIds.get(a.to);
      if (!from || !to || from === to) continue;
      const color = arrowColor(a.color);
      connectWindows(editor, from, to, {
        label: a.label,
        color,
        kind: "arc",
        meta: {
          [BOARD_META]: board.name,
          [BOARD_COLOR_META]: color,
          from: a.from,
          to: a.to,
        },
      });
    }
  });

  editor.selectNone();
  editor.zoomToBounds(layout.bounds, {
    inset: 64,
    animation: { duration: 400 },
  });
  const cam = editor.getCamera();
  const workspaces = getWorkspaceStore();
  const wsName = `Board: ${board.title}`;
  const snapshot = {
    preset: "free" as const,
    root: null,
    windowIds: [],
    region: null,
    camera: { x: cam.x, y: cam.y, z: cam.z },
  };
  const found = workspaces.list().find((w) => w.name === wsName);
  const ws = found
    ? workspaces.save(found.id, snapshot)
    : workspaces.create(wsName, snapshot);
  if (ws) {
    workspaces.setActive(ws.id);
    wm.activeWorkspaceId.set(ws.id);
  }
  return {
    name: board.name,
    title: board.title,
    sections: layout.sections.length,
    windows: layout.windows.length,
    arrows: board.arrows.length,
    bounds: layout.bounds,
    workspace: ws ? { id: ws.id, name: ws.name } : null,
  };
}

/** The page bounds of a board section's frame, or null. */
export function boardSectionBounds(
  editor: Editor,
  name: string,
  sectionId: string
): Rect | null {
  const frame = boardShapes(editor, name).frames.find(
    (f) => f.meta[BOARD_SECTION_META] === sectionId
  );
  if (!frame) return null;
  const b = editor.getShapePageBounds(frame.id);
  return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
}

/** Arrow ids of a board touching a section (its frame or one of its windows). */
export function boardSectionArrows(
  editor: Editor,
  name: string,
  sectionId: string
): TLShapeId[] {
  const { frames, windows, arrows } = boardShapes(editor, name);
  const frame = frames.find((f) => f.meta[BOARD_SECTION_META] === sectionId);
  if (!frame) return [];
  const members = new Set<string>([frame.id]);
  for (const w of windows) if (w.parentId === frame.id) members.add(w.id);
  const flows = listFlows(editor);
  const own = new Set(arrows.map((a) => a.id as string));
  return flows
    .filter(
      (f) =>
        own.has(f.id) &&
        ((f.from && members.has(f.from)) || (f.to && members.has(f.to)))
    )
    .map((f) => f.id as TLShapeId);
}

/** Window content back to a board spec: editors become `{file}`, JSON becomes an object. */
function specContent(
  kind: string,
  content: string
): BoardWindowSpec["content"] {
  if (!content) return undefined;
  if (kind === "editor" || kind === "markdown") {
    const ref = parseFileRef(content);
    return ref ? { file: ref.path } : content;
  }
  if (content.trim().startsWith("{")) {
    try {
      const v = JSON.parse(content);
      if (v && typeof v === "object" && !Array.isArray(v))
        return v as Record<string, unknown>;
    } catch {
      /* plain text */
    }
  }
  return content;
}

/**
 * Captures the current page as a board: every frame is a section (windows
 * keep their positions, `free` grid), windows outside frames form a
 * "Canvas" section, arrows between them keep their labels. Sections are
 * ordered left to right; sections stacked over one another share a column.
 */
export function captureBoard(
  editor: Editor,
  name: string,
  title = name
): BoardDef {
  const shapes = editor.getCurrentPageShapesSorted();
  const frames = shapes.filter((s): s is TLFrameShape => s.type === "frame");
  const windows = shapes.filter((s): s is WindowShape => s.type === "window");
  const idFor = new Map<TLShapeId, string>();
  const used = new Set<string>();
  const slug = (text: string, fallback: string) => {
    const base =
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32) || fallback;
    let out = base;
    let n = 2;
    while (used.has(out)) out = `${base}-${n++}`;
    used.add(out);
    return out;
  };
  const bounds = (id: TLShapeId) => editor.getShapePageBounds(id)!;

  const sectionOf = (
    frameTitle: string,
    frameId: TLShapeId | null,
    members: WindowShape[],
    inner: Rect
  ): BoardSectionSpec => {
    const sid = slug(frameTitle, "section");
    if (frameId) idFor.set(frameId, sid);
    const specs: BoardWindowSpec[] = members.map((w) => {
      const b = bounds(w.id);
      const wid = slug(`${w.props.kind}-${w.props.title}`, w.props.kind);
      idFor.set(w.id, wid);
      const spec: BoardWindowSpec = {
        id: wid,
        kind: w.props.kind,
        title: w.props.title,
        size: { w: Math.round(b.w), h: Math.round(b.h) },
        at: { x: Math.round(b.x - inner.x), y: Math.round(b.y - inner.y) },
      };
      const content = specContent(w.props.kind, w.props.content);
      if (content !== undefined) spec.content = content;
      return spec;
    });
    return { id: sid, title: frameTitle, grid: "free", windows: specs };
  };

  const placed: { section: BoardSectionSpec; rect: Rect }[] = [];
  for (const f of frames) {
    const b = bounds(f.id);
    const members = windows.filter((w) => w.parentId === f.id);
    const inner: Rect = {
      x: b.x + SECTION_PADDING,
      y: b.y + SECTION_PADDING + SECTION_HEADER,
      w: b.w,
      h: b.h,
    };
    placed.push({
      section: sectionOf(f.props.name || "Section", f.id, members, inner),
      rect: { x: b.x, y: b.y, w: b.w, h: b.h },
    });
  }
  const loose = windows.filter((w) => w.parentId === editor.getCurrentPageId());
  if (loose.length) {
    const xs = loose.map((w) => bounds(w.id));
    const rect: Rect = {
      x: Math.min(...xs.map((b) => b.x)),
      y: Math.min(...xs.map((b) => b.y)),
      w: 0,
      h: 0,
    };
    rect.w = Math.max(...xs.map((b) => b.x + b.w)) - rect.x;
    rect.h = Math.max(...xs.map((b) => b.y + b.h)) - rect.y;
    placed.push({ section: sectionOf("Canvas", null, loose, rect), rect });
  }
  // Left to right; frames whose x-bands overlap share a column.
  placed.sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y);
  let column = -1;
  let lastRight = -Infinity;
  for (const p of placed) {
    if (p.rect.x >= lastRight) column++;
    p.section.column = column;
    lastRight = Math.max(lastRight, p.rect.x + p.rect.w);
  }
  const sections = placed.map((p) => p.section);
  const arrows = listFlows(editor)
    .filter(
      (f) =>
        f.from &&
        f.to &&
        idFor.has(f.from as TLShapeId) &&
        idFor.has(f.to as TLShapeId)
    )
    .map((f) => ({
      from: idFor.get(f.from as TLShapeId)!,
      to: idFor.get(f.to as TLShapeId)!,
      ...(f.label ? { label: f.label } : {}),
    }));
  return {
    name,
    title,
    sections,
    arrows,
    steps: sections.map((s) => ({ section: s.id, caption: "" })),
  };
}

/** Writes the current canvas as `boards/<name>.json` in the project. */
export async function saveBoard(
  editor: Editor,
  project: string,
  name: string,
  title?: string,
  store: ProjectStore = getProjectStore()
): Promise<BoardDef> {
  const board = captureBoard(editor, name, title ?? name);
  // Mark the shapes as this board's so the tour and reopen find them.
  const shapes = editor.getCurrentPageShapes();
  editor.run(
    () => {
      for (const s of shapes) {
        if (s.type !== "frame" && s.type !== "window" && s.type !== "arrow")
          continue;
        if (s.meta[BOARD_META] === name) continue;
        editor.updateShape({
          id: s.id,
          type: s.type,
          meta: { ...s.meta, [BOARD_META]: name },
        });
      }
    },
    { history: "ignore" }
  );
  await writeLiveText(project, boardPath(name), serializeBoard(board), store);
  return board;
}

export async function listBoards(
  project: string,
  editor: Editor | null,
  store: ProjectStore = getProjectStore()
): Promise<BoardInfo[]> {
  const session = await store.session(project);
  const paths =
    session?.files
      .get()
      .filter((f) => f.type === "file" && boardFromPath(f.path))
      .map((f) => f.path)
      .sort() ?? [];
  const onCanvas = new Set(editor ? boardsOnCanvas(editor) : []);
  const out: BoardInfo[] = [];
  for (const path of paths) {
    const text = await readLiveText(project, path, store);
    if (text === null) continue;
    const { board } = parseBoard(text, path);
    if (!board) continue;
    out.push({
      name: board.name,
      title: board.title,
      path,
      ...(board.description ? { description: board.description } : {}),
      sections: board.sections.length,
      windows: board.sections.reduce((n, s) => n + s.windows.length, 0),
      onCanvas: onCanvas.has(board.name),
    });
  }
  return out;
}

export async function readBoard(
  project: string,
  name: string,
  store: ProjectStore = getProjectStore()
): Promise<BoardDef> {
  const path = boardPath(name);
  const text = await readLiveText(project, path, store);
  if (text === null) throw new Error(`No board "${name}" (${path})`);
  const { board, errors } = parseBoard(text, path);
  if (!board) throw new Error(`Cannot read ${path}: ${errors.join("; ")}`);
  return board;
}
