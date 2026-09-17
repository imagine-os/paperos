/**
 * Draws the project map on the canvas: one frame per section, one Card
 * window per node (parented into its frame) and one arrow per edge, laid
 * out by `layout.ts`. Regeneration keeps the position of every card the
 * user still has, replaces the arrows and removes cards whose subject is
 * gone. The result is saved as the "Map" workspace.
 */
import { createShapeId, type Editor, type TLShapeId } from "tldraw";
import { getDataStore, scanProjectBindings } from "@/data/project-fs";
import { loadDesign } from "@/design/project-design";
import { connectWindows } from "@/desktop/flow";
import { parseContent } from "@/desktop/kinds/data-common";
import {
  createSection,
  SECTION_HEADER,
  SECTION_PADDING,
} from "@/desktop/sections";
import type { WindowShape } from "@/desktop/window-shape";
import { getWorkspaceStore } from "@/desktop/workspaces";
import { getProjectStore, type ProjectStore } from "@/ide/project/store";
import type { Rect } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import type { TLArrowShape, TLFrameShape } from "tldraw";
import { DEFAULT_MAP_LAYOUT, layoutMap } from "./layout";
import {
  buildProjectMap,
  type CardContent,
  type MapEdge,
  type MapInput,
  type MapSectionId,
} from "./model";

/** Meta key on the frames and arrows the map owns. */
export const MAP_META = "paperosMap";
export const MAP_WORKSPACE_NAME = "Map";

export interface MapResult {
  sections: number;
  nodes: number;
  edges: number;
  /** Cards that kept a position from the previous map. */
  kept: number;
  bounds: Rect;
  workspace: { id: string; name: string } | null;
}

const EDGE_COLOR: Record<MapEdge["kind"], TLArrowShape["props"]["color"]> = {
  binding: "orange",
  usage: "violet",
  link: "light-blue",
  tokens: "light-violet",
};

export async function gatherMapInput(
  project: string,
  store: ProjectStore = getProjectStore()
): Promise<MapInput> {
  const session = await store.session(project);
  const files =
    session?.files
      .get()
      .filter((f) => f.type === "file")
      .map((f) => f.path) ?? [];
  const data = getDataStore(project, store);
  const schema = await data.schema();
  const rowCounts: Record<string, number> = {};
  for (const t of schema.tables)
    rowCounts[t.name] = (await data.rows(t.name)).length;
  const bindings = await scanProjectBindings(project, store);
  const design = await loadDesign(project, store);
  return {
    files,
    schema,
    rowCounts,
    bindings,
    components: design.components,
    pages: design.pages,
    tokens: design.hasTokens ? design.tokens : null,
  };
}

function mapFrames(editor: Editor): Map<MapSectionId, TLFrameShape> {
  const out = new Map<MapSectionId, TLFrameShape>();
  for (const s of editor.getCurrentPageShapes()) {
    if (s.type !== "frame") continue;
    const id = s.meta[MAP_META];
    if (typeof id === "string") out.set(id as MapSectionId, s as TLFrameShape);
  }
  return out;
}

function mapCards(editor: Editor): Map<string, WindowShape> {
  const out = new Map<string, WindowShape>();
  for (const s of editor.getCurrentPageShapes()) {
    if (s.type !== "window") continue;
    const w = s as WindowShape;
    if (w.props.kind !== "card") continue;
    const key = parseContent<CardContent>(w.props.content).key;
    if (key) out.set(key, w);
  }
  return out;
}

function mapArrows(editor: Editor): TLShapeId[] {
  return editor
    .getCurrentPageShapes()
    .filter((s) => s.type === "arrow" && typeof s.meta[MAP_META] === "string")
    .map((s) => s.id);
}

/** Where a fresh map goes: right of everything on the page, or the viewport's top-left. */
function freshOrigin(editor: Editor): { x: number; y: number } {
  const bounds = editor.getCurrentPageBounds();
  if (bounds) return { x: bounds.maxX + 200, y: bounds.y };
  const v = editor.getViewportPageBounds();
  return { x: v.x + 80, y: v.y + 80 };
}

export async function generateMap(
  editor: Editor,
  { regenerate = false }: { regenerate?: boolean } = {}
): Promise<MapResult> {
  const projects = getProjectStore();
  const project = projects.getActiveId();
  if (!project)
    throw new Error("No project is open. Use projects.open('sample') first.");
  const graph = buildProjectMap(await gatherMapInput(project, projects));

  const wm = getWindowManager(editor);
  const frames = mapFrames(editor);
  const cards = mapCards(editor);
  const existing = frames.size > 0 || cards.size > 0;

  // Positions to keep: every card that still has a subject, when regenerating.
  const keep: Record<string, { x: number; y: number }> = {};
  const wanted = new Set(graph.nodes.map((n) => n.key));
  if (regenerate && existing) {
    for (const [key, shape] of cards) {
      if (!wanted.has(key)) continue;
      const b = editor.getShapePageBounds(shape.id);
      if (b) keep[key] = { x: b.x, y: b.y };
    }
  }
  let origin = freshOrigin(editor);
  if (regenerate && existing) {
    const rects = [...frames.values()]
      .map((f) => editor.getShapePageBounds(f.id))
      .filter((b) => b !== undefined);
    if (rects.length)
      origin = {
        x: Math.min(...rects.map((r) => r.x)),
        y: Math.min(...rects.map((r) => r.y)),
      };
  }
  const layout = layoutMap(graph, keep, {
    origin,
    padding: SECTION_PADDING,
    header: SECTION_HEADER,
  });

  const pageId = editor.getCurrentPageId();
  const nodeIds = new Map<string, TLShapeId>();

  editor.run(() => {
    editor.markHistoryStoppingPoint(
      regenerate ? "regenerate map" : "generate map"
    );
    // Old arrows always go; they are rebuilt from the graph.
    const oldArrows = mapArrows(editor);
    if (oldArrows.length) editor.deleteShapes(oldArrows);
    // Cards whose subject disappeared, and (on a fresh generate) every old card.
    const stale = [...cards.entries()]
      .filter(([key]) => !regenerate || !wanted.has(key))
      .map(([, s]) => s.id);
    if (stale.length) editor.deleteShapes(stale);
    for (const id of stale)
      for (const [k, s] of cards) if (s.id === id) cards.delete(k);
    // Stale frames (a section that no longer has nodes, or a fresh generate).
    const keepFrames = new Set(layout.sections.map((s) => s.id));
    for (const [sectionId, frame] of frames) {
      if (regenerate && keepFrames.has(sectionId)) continue;
      const children = editor.getSortedChildIdsForParent(frame.id);
      if (children.length) editor.reparentShapes(children, pageId);
      editor.deleteShape(frame.id);
      frames.delete(sectionId);
    }
    // Cards out of their frames first so page coordinates can be written directly.
    const parked = [...cards.values()]
      .filter((c) => c.parentId !== pageId)
      .map((c) => c.id);
    if (parked.length) editor.reparentShapes(parked, pageId);

    // Frames: reuse or create.
    const frameIds = new Map<MapSectionId, TLShapeId>();
    for (const s of layout.sections) {
      const old = frames.get(s.id);
      if (old) {
        editor.updateShape<TLFrameShape>({
          id: old.id,
          type: "frame",
          x: s.x,
          y: s.y,
          props: { w: s.w, h: s.h, name: s.title },
        });
        frameIds.set(s.id, old.id);
      } else {
        const id = createSection(editor, s.title, [], s);
        editor.updateShape<TLFrameShape>({
          id,
          type: "frame",
          meta: { [MAP_META]: s.id },
        });
        frameIds.set(s.id, id);
      }
    }

    // Cards: reuse or create, then put each in its frame.
    for (const placed of layout.nodes) {
      const node = graph.nodes.find((n) => n.key === placed.key)!;
      const content: CardContent = {
        key: node.key,
        subtitle: node.subtitle,
        icon: node.icon,
        section: node.section,
        facts: node.facts,
        target: node.target,
      };
      const old = cards.get(node.key);
      let id: TLShapeId;
      if (old) {
        id = old.id;
        editor.updateShape<WindowShape>({
          id,
          type: "window",
          x: placed.x,
          y: placed.y,
          props: {
            w: placed.w,
            h: placed.h,
            title: node.title,
            content: JSON.stringify(content),
            tiled: false,
          },
        });
      } else {
        id = createShapeId();
        editor.createShape<WindowShape>({
          id,
          type: "window",
          x: placed.x,
          y: placed.y,
          props: {
            w: placed.w,
            h: placed.h,
            title: node.title,
            kind: "card",
            content: JSON.stringify(content),
            tiled: false,
          },
        });
      }
      nodeIds.set(node.key, id);
      const frameId = frameIds.get(node.section);
      if (frameId) editor.reparentShapes([id], frameId);
    }

    // Arrows.
    for (const e of graph.edges) {
      const from = nodeIds.get(e.from);
      const to = nodeIds.get(e.to);
      if (!from || !to) continue;
      connectWindows(editor, from, to, {
        label: e.label,
        kind: "arc",
        bend: e.kind === "link" ? 36 : 0,
        color: EDGE_COLOR[e.kind],
        meta: { [MAP_META]: `${e.from}>${e.to}` },
      });
    }
    // A map is a free arrangement: cards do not join the tiling layout.
    for (const id of nodeIds.values()) if (wm.isTiled(id)) wm.floatWindow(id);
  });

  editor.zoomToBounds(layout.bounds, { inset: 64 });
  const cam = editor.getCamera();
  const workspaces = getWorkspaceStore();
  const snapshot = {
    preset: "free" as const,
    root: null,
    windowIds: [],
    region: null,
    camera: { x: cam.x, y: cam.y, z: cam.z },
  };
  const found = workspaces.list().find((w) => w.name === MAP_WORKSPACE_NAME);
  const ws = found
    ? workspaces.save(found.id, snapshot)
    : workspaces.create(MAP_WORKSPACE_NAME, snapshot);
  if (ws) {
    workspaces.setActive(ws.id);
    wm.activeWorkspaceId.set(ws.id);
  }
  return {
    sections: layout.sections.length,
    nodes: layout.nodes.length,
    edges: graph.edges.length,
    kept: Object.keys(keep).length,
    bounds: layout.bounds,
    workspace: ws ? { id: ws.id, name: ws.name } : null,
  };
}

export { DEFAULT_MAP_LAYOUT };
