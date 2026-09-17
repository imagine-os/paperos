/**
 * Data lineage on the canvas: gathers the project's schema, bindings and
 * pages, builds the graph and draws it as a board (Tables → Components →
 * Pages) with the boards machinery. `focusLineage` dims every card and
 * arrow that does not feed the chosen page; `hintTable` outlines a table's
 * card while a component in a preview is hovered.
 */
import { atom, type Editor, type TLShapeId } from "tldraw";
import { boardShapes, openBoard, type BoardResult } from "@/boards/build";
import { getWindowKind } from "@/desktop/window-kinds";
import type { WindowShape } from "@/desktop/window-shape";
import { parseContent } from "@/desktop/kinds/data-common";
import { getProjectStore, type ProjectStore } from "@/ide/project/store";
import { loadDesign } from "@/design/project-design";
import { gatherMapInput } from "@/map/generate";
import type { CardContent } from "@/map/model";
import {
  buildLineage,
  LINEAGE_BOARD,
  lineageBoard,
  lineageFocus,
  lineagePageBoard,
  type LineageGraph,
} from "./model";

/** The page the lineage board is focused on (null = everything). */
export const lineageFocusPage = atom<string | null>("lineage.focus", null);

const DIM = 0.12;

export async function gatherLineage(
  project: string,
  store: ProjectStore = getProjectStore()
): Promise<LineageGraph> {
  const input = await gatherMapInput(project, store);
  return buildLineage({
    schema: input.schema,
    rowCounts: input.rowCounts,
    bindings: input.bindings,
    components: input.components,
    pages: input.pages,
  });
}

export interface LineageOpenResult extends BoardResult {
  page: string | null;
  tables: number;
  components: number;
  pages: number;
  edges: number;
}

/** Draws the lineage board (all pages), or one page's lineage next to its Page Builder and Preview. */
export async function openLineage(
  editor: Editor,
  options: { page?: string | null; project?: string | null } = {}
): Promise<LineageOpenResult> {
  const project = options.project ?? getProjectStore().getActiveId();
  if (!project)
    throw new Error("No project is open. Use projects.open('sample') first.");
  const graph = await gatherLineage(project);
  const page = options.page ?? null;
  if (page && !graph.pages.some((p) => p.name === page))
    throw new Error(
      `No page "${page}". Pages: ${graph.pages.map((p) => p.name).join(", ")}`
    );
  const board = page ? lineagePageBoard(graph, page) : lineageBoard(graph);
  const result = openBoard(editor, board, { project });
  lineageFocusPage.set(null);
  const sub = page ? lineageFocus(graph, page) : null;
  return {
    ...result,
    page,
    tables: sub
      ? graph.tables.filter((t) => sub.nodes.has(t.key)).length
      : graph.tables.length,
    components: sub
      ? graph.components.filter((c) => sub.nodes.has(c.key)).length
      : graph.components.length,
    pages: page ? 1 : graph.pages.length,
    edges: page
      ? graph.edges.filter((e) => e.pages.includes(page)).length
      : graph.edges.length,
  };
}

function lineageCards(editor: Editor): Map<string, WindowShape> {
  const out = new Map<string, WindowShape>();
  for (const w of boardShapes(editor, LINEAGE_BOARD).windows) {
    if (w.props.kind !== "card") continue;
    const key = parseContent<CardContent>(w.props.content).key;
    if (key) out.set(key, w);
  }
  return out;
}

/**
 * Dims everything on the lineage board that does not feed `page`
 * (null restores everything). Returns how many shapes are dimmed.
 */
export async function focusLineage(
  editor: Editor,
  page: string | null,
  project: string | null = getProjectStore().getActiveId()
): Promise<{ page: string | null; dimmed: number; kept: number }> {
  const { windows, arrows } = boardShapes(editor, LINEAGE_BOARD);
  if (!windows.length) throw new Error("The Data lineage board is not open");
  if (!project) throw new Error("No project is open");
  const graph = await gatherLineage(project);
  if (page && !graph.pages.some((p) => p.name === page))
    throw new Error(`No page "${page}"`);
  const focus = lineageFocus(graph, page);
  const cards = lineageCards(editor);
  const keptIds = new Set<string>();
  for (const [key, w] of cards) if (focus.nodes.has(key)) keptIds.add(w.id);
  let dimmed = 0;
  const partials: {
    id: TLShapeId;
    type: "window" | "arrow";
    opacity: number;
  }[] = [];
  for (const w of windows) {
    const key = parseContent<CardContent>(w.props.content).key;
    const keep = page === null || !key || keptIds.has(w.id);
    if (!keep) dimmed++;
    partials.push({ id: w.id, type: "window", opacity: keep ? 1 : DIM });
  }
  for (const a of arrows) {
    const from = String(a.meta.from ?? "");
    const to = String(a.meta.to ?? "");
    const keep =
      page === null ||
      [...focus.edges].some((k) => k.startsWith(`${from}>${to}>`));
    if (!keep) dimmed++;
    partials.push({ id: a.id, type: "arrow", opacity: keep ? 1 : DIM });
  }
  editor.run(() => editor.updateShapes(partials), { history: "ignore" });
  // The controls window shows the choice.
  for (const w of windows)
    if (w.props.kind === "lineage")
      editor.updateShape<WindowShape>({
        id: w.id,
        type: "window",
        props: { content: JSON.stringify({ page }) },
      });
  lineageFocusPage.set(page);
  return { page, dimmed, kept: partials.length - dimmed };
}

/** Outlines the card of a table (on the lineage board or the project map) while hovered. */
export function hintTable(editor: Editor, table: string | null): void {
  if (!table) {
    editor.setHintingShapes([]);
    return;
  }
  const key = `table:${table}`;
  const ids = editor
    .getCurrentPageShapes()
    .filter(
      (s): s is WindowShape =>
        s.type === "window" &&
        (s as WindowShape).props.kind === "card" &&
        parseContent<CardContent>((s as WindowShape).props.content).key === key
    )
    .map((s) => s.id);
  editor.setHintingShapes(ids);
}

/** Pages of the active project, for the focus dropdown. */
export async function lineagePages(
  project: string,
  store: ProjectStore = getProjectStore()
): Promise<{ name: string; title: string }[]> {
  const design = await loadDesign(project, store);
  return design.pages.map((p) => ({ name: p.name, title: p.title }));
}

export function hasLineageKind(): boolean {
  return getWindowKind("lineage") !== undefined;
}
