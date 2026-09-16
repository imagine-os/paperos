import {
  atom,
  computed,
  react,
  type Editor,
  type TLShapeId,
  type TLShapePartial,
} from "tldraw";
import type { WindowShape } from "@/desktop/window-shape";
import { dropZone, findNeighbor, readingOrder, zoneRect } from "./geometry";
import { DEFAULT_LAYOUT_OPTIONS, layout } from "./layout-engine";
import {
  insertWindow,
  removeWindow,
  resizeRatio,
  swapWindows,
} from "./operations";
import { buildPreset, isFlatPreset } from "./presets";
import { browserStorage } from "./storage";
import {
  collectWindowIds,
  findLeaf,
  leaf,
  pruneTree,
  replaceNode,
} from "./tree";
import type {
  DropZone,
  LayoutFrames,
  LayoutNode,
  LayoutOptions,
  LayoutPreset,
  Point,
  Rect,
  Side,
} from "./types";
import { createWmStateStore, type WmState } from "./wm-state";
import type { JsonStore } from "./storage";
import type { Workspace } from "./types";
import type { WorkspaceSnapshot } from "./workspace-store";

/** Below this viewport width (CSS px) columns collapse to a single column. */
export const NARROW_BREAKPOINT = 720;

/** A tiled window has to move this far (page units) before it detaches. */
export const DETACH_DISTANCE = 24;

const REFLOW_DELAY_MS = 150;

/** tldraw's own UI bands (menu bar on top, toolbar at the bottom), in screen px. */
export const CHROME_INSETS = { top: 48, bottom: 72 };

export interface DropHint {
  targetId: TLShapeId;
  zone: DropZone;
  /** The highlighted area, in page space. */
  rect: Rect;
}

const NO_REGION: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Applies layout trees to the Window shapes of the current page.
 *
 * The "desktop region" is the viewport's page bounds at the moment a layout
 * is applied. It stays put while the user pans and zooms (tiled windows are
 * canvas objects, not chrome) and is re-captured when the browser viewport is
 * resized.
 */
export class WindowManager {
  readonly root = atom<LayoutNode | null>("wm.root", null);
  readonly preset = atom<LayoutPreset>("wm.preset", "free");
  readonly region = atom<Rect | null>("wm.region", null);
  readonly focusedId = atom<TLShapeId | null>("wm.focused", null);
  readonly dropHint = atom<DropHint | null>("wm.dropHint", null);
  readonly activeWorkspaceId = atom<string | null>("wm.workspace", null);
  /** The window whose title is being edited inline (double-click on the title bar). */
  readonly titleEditId = atom<TLShapeId | null>("wm.titleEdit", null);

  /** Rectangles for the current tree in the current region (page space). */
  readonly frames = computed<LayoutFrames>("wm.frames", () =>
    layout(this.root.get(), this.region.get() ?? NO_REGION, this.options)
  );

  private disposers: (() => void)[] = [];
  private reflowTimer: ReturnType<typeof setTimeout> | null = null;
  private applyQueued = false;

  constructor(
    readonly editor: Editor,
    private readonly state: JsonStore<WmState> | null = createWmStateStore(
      browserStorage()
    ),
    readonly options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS
  ) {
    this.restore();
    this.watchViewport();
    this.watchShapes();
    this.persistOnChange();
    this.apply();
  }

  dispose() {
    this.disposers.forEach((d) => d());
    this.disposers = [];
    if (this.reflowTimer) clearTimeout(this.reflowTimer);
  }

  // ----- queries ---------------------------------------------------------

  getWindows(): WindowShape[] {
    return this.editor
      .getCurrentPageShapes()
      .filter((s): s is WindowShape => s.type === "window");
  }

  getWindow(id: TLShapeId): WindowShape | undefined {
    const shape = this.editor.getShape(id);
    return shape?.type === "window" ? (shape as WindowShape) : undefined;
  }

  isTiled(id: TLShapeId): boolean {
    return findLeaf(this.root.get(), id) !== null;
  }

  /** Tiled window ids in tree (reading) order, existing shapes only. */
  getTiledIds(): TLShapeId[] {
    return collectWindowIds(this.root.get()).filter((id) =>
      this.getWindow(id as TLShapeId)
    ) as TLShapeId[];
  }

  isNarrow(): boolean {
    return this.editor.getViewportScreenBounds().w < NARROW_BREAKPOINT;
  }

  /** The viewport in page space, minus the bands tldraw's chrome covers. */
  viewportRegion(): Rect {
    const b = this.editor.getViewportPageBounds();
    const z = this.editor.getZoomLevel();
    const top = CHROME_INSETS.top / z;
    const bottom = CHROME_INSETS.bottom / z;
    return {
      x: b.x,
      y: b.y + top,
      w: b.w,
      h: Math.max(0, b.h - top - bottom),
    };
  }

  /** The window that keyboard commands act on. */
  getFocusedId(): TLShapeId | null {
    const focused = this.focusedId.get();
    if (focused && this.getWindow(focused)) return focused;
    const selected = this.editor.getOnlySelectedShape();
    if (selected?.type === "window") return selected.id;
    return null;
  }

  /** All windows, left to right and top to bottom, so tiling keeps the rough arrangement. */
  private orderedWindowIds(): TLShapeId[] {
    return readingOrder(
      this.getWindows().map((s) => ({
        id: s.id,
        rect: { x: s.x, y: s.y, w: s.props.w, h: s.props.h },
      }))
    ).map((i) => i.id as TLShapeId);
  }

  // ----- presets -----------------------------------------------------------

  /** Tiles every window on the page with `preset` inside the current viewport. */
  applyPreset(preset: LayoutPreset) {
    this.editor.markHistoryStoppingPoint("wm preset");
    this.preset.set(preset);
    if (preset === "free") {
      this.root.set(null);
    } else {
      this.region.set(this.viewportRegion());
      const current = this.root.get();
      if (preset === "split-tree" && current) {
        // Keep whatever the user built; only add windows that are not in it.
        let root: LayoutNode | null = current;
        for (const id of this.orderedWindowIds()) {
          if (!findLeaf(root, id)) root = insertWindow(root, id, null, "right");
        }
        this.root.set(root);
      } else {
        this.root.set(
          buildPreset(preset, this.orderedWindowIds(), {
            narrow: this.isNarrow(),
          })
        );
      }
    }
    this.apply();
  }

  /** Replaces the whole layout with `root` (a tree built elsewhere) inside the current viewport. */
  applyTree(root: LayoutNode, preset: LayoutPreset = "split-tree") {
    this.editor.markHistoryStoppingPoint("wm tree");
    this.preset.set(preset);
    this.region.set(this.viewportRegion());
    this.root.set(root);
    this.apply();
  }

  /** Replaces the tree but keeps the region (unlike `applyTree`); the layout becomes a split tree. */
  setTree(root: LayoutNode | null) {
    this.editor.markHistoryStoppingPoint("wm tree");
    if (root && !this.region.get()) this.region.set(this.viewportRegion());
    this.root.set(root);
    if (root) this.preset.set("split-tree");
    this.apply();
  }

  tileAll() {
    const preset = this.preset.get();
    this.applyPreset(preset === "free" ? "columns" : preset);
  }

  untileAll() {
    this.applyPreset("free");
  }

  // ----- single windows ----------------------------------------------------

  /**
   * Adds a window to the layout. Without a side, flat presets are rebuilt to
   * include it; otherwise it is inserted next to `targetId` (or the whole
   * layout) and the layout becomes a split tree.
   */
  tileWindow(id: TLShapeId, side?: Side, targetId?: TLShapeId) {
    if (!this.getWindow(id)) return;
    if (this.isTiled(id) && !side) return;
    this.editor.markHistoryStoppingPoint("wm tile");
    if (!this.region.get()) this.region.set(this.viewportRegion());
    // Tiling into an empty desktop starts a Columns layout.
    if (!side && this.preset.get() === "free" && !this.root.get())
      this.preset.set("columns");
    const preset = this.preset.get();
    const current = this.root.get();
    if (!side && isFlatPreset(preset)) {
      const ids = [...this.getTiledIds().filter((t) => t !== id), id];
      this.root.set(buildPreset(preset, ids, { narrow: this.isNarrow() }));
    } else {
      const target = targetId
        ? (findLeaf(current, targetId)?.id ?? null)
        : null;
      this.root.set(insertWindow(current, id, target, side ?? "right"));
      if (!isFlatPreset(preset) || side) this.preset.set("split-tree");
    }
    this.apply();
  }

  floatWindow(id: TLShapeId) {
    if (!this.isTiled(id)) return;
    this.editor.markHistoryStoppingPoint("wm float");
    this.removeFromTree(id);
    this.apply();
    this.raise(id);
  }

  toggleTile(id: TLShapeId) {
    if (this.isTiled(id)) this.floatWindow(id);
    else this.tileWindow(id);
  }

  private removeFromTree(id: TLShapeId) {
    const preset = this.preset.get();
    const next = removeWindow(this.root.get(), id);
    // Flat presets keep their shape for the remaining windows.
    this.root.set(
      isFlatPreset(preset) && next
        ? buildPreset(preset, collectWindowIds(next), {
            narrow: this.isNarrow(),
          })
        : next
    );
  }

  // ----- drag and drop -----------------------------------------------------

  /** Called while a tiled window is dragged past DETACH_DISTANCE: it floats and the rest reflow. */
  detach(id: TLShapeId) {
    if (!this.isTiled(id)) return;
    this.removeFromTree(id);
    this.apply();
    this.editor.bringToFront([id]);
  }

  /** Updates the drop hint for a floating window dragged over tiled ones. */
  updateDropHint(draggedId: TLShapeId, point: Point) {
    for (const [windowId, rect] of this.frames.get().windows) {
      const id = windowId as TLShapeId;
      if (id === draggedId || !this.getWindow(id)) continue;
      const zone = dropZone(rect, point);
      if (zone) {
        const hint = this.dropHint.get();
        if (hint?.targetId !== id || hint.zone !== zone) {
          this.dropHint.set({ targetId: id, zone, rect: zoneRect(rect, zone) });
        }
        return;
      }
    }
    if (this.dropHint.get()) this.dropHint.set(null);
  }

  /**
   * Finishes a drag. Center swaps: the dragged window takes the target's
   * place and the target floats where the drag started. Edges insert.
   */
  dropWindow(draggedId: TLShapeId, dragStart: Point): boolean {
    const hint = this.dropHint.get();
    this.dropHint.set(null);
    if (!hint || !this.getWindow(hint.targetId)) return false;
    const targetLeaf = findLeaf(this.root.get(), hint.targetId);
    if (!targetLeaf) return false;

    if (hint.zone === "center") {
      this.root.set(
        replaceNode(this.root.get(), targetLeaf.id, () => leaf(draggedId))
      );
      this.editor.updateShape<WindowShape>({
        id: hint.targetId,
        type: "window",
        x: dragStart.x,
        y: dragStart.y,
        props: { tiled: false },
      });
      this.apply();
      this.editor.bringToFront([hint.targetId]);
    } else {
      this.root.set(
        insertWindow(this.root.get(), draggedId, targetLeaf.id, hint.zone)
      );
      if (isFlatPreset(this.preset.get())) this.preset.set("split-tree");
      this.apply();
    }
    return true;
  }

  // ----- gutters -------------------------------------------------------------

  /** Moves a split boundary; `base` is the tree at drag start so deltas are absolute. */
  resizeSplit(
    splitId: string,
    index: number,
    delta: number,
    base: LayoutNode | null = this.root.get()
  ) {
    const next = resizeRatio(base, splitId, index, delta);
    if (next === this.root.get()) return;
    this.root.set(next);
    this.apply();
  }

  // ----- focus and z-order -----------------------------------------------------

  focusWindow(id: TLShapeId, { select = true } = {}) {
    if (!this.getWindow(id)) return;
    this.focusedId.set(id);
    if (select) this.editor.setSelectedShapes([id]);
    this.raise(id);
  }

  /** Brings a window to the top of its layer: floating windows stay above tiled ones. */
  raise(id: TLShapeId) {
    const top = this.editor.getCurrentPageShapesSorted().at(-1);
    const tiled = this.isTiled(id);
    if (top?.id === id && !tiled) return;
    this.editor.run(
      () => {
        this.editor.bringToFront([id]);
        if (tiled) this.sendTiledToBack();
      },
      { history: "ignore" }
    );
  }

  private sendTiledToBack() {
    const tiledSet = new Set(this.getTiledIds());
    if (tiledSet.size === 0) return;
    const inOrder = this.editor
      .getCurrentPageShapesSorted()
      .filter((s) => tiledSet.has(s.id))
      .map((s) => s.id);
    this.editor.sendToBack(inOrder);
  }

  moveFocus(side: Side) {
    const rects = this.frames.get().windows;
    const from = this.getFocusedId();
    const next =
      from && rects.has(from)
        ? findNeighbor(rects, from, side)
        : (this.getTiledIds()[0] ?? null);
    if (next) this.focusWindow(next as TLShapeId);
  }

  swapFocused(side: Side) {
    const from = this.getFocusedId();
    if (!from || !this.isTiled(from)) return;
    const other = findNeighbor(this.frames.get().windows, from, side);
    if (!other) return;
    this.editor.markHistoryStoppingPoint("wm swap");
    this.root.set(swapWindows(this.root.get(), from, other));
    this.apply();
    this.focusWindow(from);
  }

  /** Zooms the camera to the focused window. */
  focusMode(id: TLShapeId | null = this.getFocusedId()) {
    if (!id) return;
    const bounds = this.editor.getShapePageBounds(id);
    if (!bounds) return;
    this.focusWindow(id);
    this.editor.zoomToBounds(bounds, {
      inset: 32,
      animation: { duration: 260 },
    });
  }

  /** Zooms out to show the whole layout region. */
  showRegion() {
    const region = this.region.get();
    if (!region || !this.root.get()) return;
    this.editor.zoomToBounds(region, {
      inset: 0,
      animation: { duration: 260 },
    });
  }

  // ----- workspaces ----------------------------------------------------------------

  snapshot(): WorkspaceSnapshot {
    const camera = this.editor.getCamera();
    return {
      preset: this.preset.get(),
      root: this.root.get(),
      windowIds: this.getTiledIds(),
      region: this.region.get(),
      camera: { x: camera.x, y: camera.y, z: camera.z },
    };
  }

  applyWorkspace(ws: Workspace) {
    this.editor.markHistoryStoppingPoint("wm workspace");
    const existing = new Set(this.getWindows().map((s) => s.id));
    let root = pruneTree(ws.root, existing);
    if (!root && ws.preset !== "free") {
      // A workspace saved without windows (like the default "Grid") tiles what is here.
      root = buildPreset(ws.preset, this.orderedWindowIds(), {
        narrow: this.isNarrow(),
      });
    }
    this.preset.set(ws.preset);
    this.region.set(root ? (ws.region ?? this.viewportRegion()) : ws.region);
    this.root.set(root);
    this.activeWorkspaceId.set(ws.id);
    this.apply();
    const animation = { duration: 320 };
    if (root && ws.region) {
      this.editor.zoomToBounds(ws.region, { inset: 0, animation });
    } else if (ws.camera) {
      this.editor.setCamera(ws.camera, { animation });
    }
  }

  // ----- applying -------------------------------------------------------------------

  /** Writes every tiled window's rectangle in one batch and fixes z-order. */
  apply() {
    const existing = new Set(this.getWindows().map((s) => s.id));
    const pruned = pruneTree(this.root.get(), existing);
    if (pruned !== this.root.get()) this.root.set(pruned);
    if (pruned && !this.region.get()) this.region.set(this.viewportRegion());

    const frames = this.frames.get();
    const partials: TLShapePartial<WindowShape>[] = [];
    for (const shape of this.getWindows()) {
      const rect = frames.windows.get(shape.id);
      if (rect) {
        if (
          !near(shape.x, rect.x) ||
          !near(shape.y, rect.y) ||
          !near(shape.props.w, rect.w) ||
          !near(shape.props.h, rect.h) ||
          !shape.props.tiled
        ) {
          partials.push({
            id: shape.id,
            type: "window",
            x: rect.x,
            y: rect.y,
            props: { w: rect.w, h: rect.h, tiled: true },
          });
        }
      } else if (shape.props.tiled) {
        partials.push({
          id: shape.id,
          type: "window",
          props: { tiled: false },
        });
      }
    }
    this.editor.run(() => {
      if (partials.length) this.editor.updateShapes(partials);
      this.sendTiledToBack();
    });
  }

  private queueApply() {
    if (this.applyQueued) return;
    this.applyQueued = true;
    queueMicrotask(() => {
      this.applyQueued = false;
      this.apply();
    });
  }

  // ----- wiring -------------------------------------------------------------------------

  private restore() {
    const saved = this.state?.get();
    if (!saved) return;
    this.preset.set(saved.preset);
    this.region.set(saved.region);
    this.activeWorkspaceId.set(saved.activeWorkspaceId);
    const existing = new Set(this.getWindows().map((s) => s.id));
    this.root.set(pruneTree(saved.root, existing));
  }

  private persistOnChange() {
    if (!this.state) return;
    this.disposers.push(
      react("wm.persist", () => {
        const next: WmState = {
          version: 1,
          preset: this.preset.get(),
          root: this.root.get(),
          region: this.region.get(),
          activeWorkspaceId: this.activeWorkspaceId.get(),
        };
        this.state!.set(next);
      })
    );
  }

  /** Re-captures the region when the browser viewport changes size (debounced). */
  private watchViewport() {
    let last = { w: 0, h: 0 };
    this.disposers.push(
      react("wm.viewport", () => {
        const b = this.editor.getViewportScreenBounds();
        const size = { w: b.w, h: b.h };
        const first = last.w === 0 && last.h === 0;
        const changed = size.w !== last.w || size.h !== last.h;
        last = size;
        if (!first && changed) this.scheduleReflow();
      })
    );
  }

  private scheduleReflow() {
    if (this.reflowTimer) clearTimeout(this.reflowTimer);
    this.reflowTimer = setTimeout(() => {
      this.reflowTimer = null;
      if (!this.root.get()) return;
      this.region.set(this.viewportRegion());
      const preset = this.preset.get();
      if (isFlatPreset(preset)) {
        this.root.set(
          buildPreset(preset, this.getTiledIds(), { narrow: this.isNarrow() })
        );
      }
      this.apply();
    }, REFLOW_DELAY_MS);
  }

  private watchShapes() {
    this.disposers.push(
      this.editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
        if (shape.type !== "window") return;
        if (this.focusedId.get() === shape.id) this.focusedId.set(null);
        if (this.isTiled(shape.id)) {
          this.removeFromTree(shape.id);
          this.queueApply();
        }
      }),
      // A tiled window that reappears (undo of a close) rejoins the layout.
      this.editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
        if (shape.type !== "window") return;
        queueMicrotask(() => {
          const fresh = this.getWindow(shape.id);
          if (fresh?.props.tiled && !this.isTiled(shape.id)) {
            this.tileWindow(shape.id);
          }
        });
      })
    );
  }
}

function near(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

const managers = new WeakMap<Editor, WindowManager>();

/** The window manager for an editor, created on first use and disposed with it. */
export function getWindowManager(editor: Editor): WindowManager {
  let wm = managers.get(editor);
  if (!wm) {
    wm = new WindowManager(editor);
    managers.set(editor, wm);
    editor.disposables.add(() => {
      wm?.dispose();
      managers.delete(editor);
    });
  }
  return wm;
}
