# PaperOS v2 plan

PaperOS is a zoomable canvas that behaves like an OS desktop. Windows are the
one primitive; a tiling engine arranges them; windows hold IDE tools; a Canvas
API later makes it programmable.

## Milestones

### M0 - Clean start (done)

- Next 15 + React 19 + TypeScript strict, ESLint, Prettier, Vitest, Playwright.
- tldraw canvas with local persistence, bundled assets, optional license key.
- `Window` shape: title bar, close, focus-to-front, resize with min size,
  cascading placement, window kinds registry (`note`, `about`).
- `w` tool and "New window" button.
- 2025 prototype frozen at `/legacy`, linked both ways.
- CI: `npm run check` + `npm run build` on every push and PR.

### M1 - Window manager (done)

- Layout engine in `src/wm/` (pure TypeScript, unit tested): tree of leaves,
  n-ary splits and grids; `layout()` with gaps, padding and minimum sizes;
  presets free, columns, grid, three Bento shapes, split tree; operations
  insert, splitLeaf, swap, resizeRatio, remove, prune, tile.
- `WindowManager` applies a tree to the `Window` shapes of the page in one
  `updateShapes` batch (undoable), marks them `tiled`, keeps tiled windows
  below floating ones, detaches on drag, inserts or swaps on drop (with a
  quadrant hint), resizes ratios by dragging the gaps, reflows on viewport
  resize and collapses columns below 720 px.
- Workspaces: named arrangements (preset, tree, windows, region, camera) in
  `localStorage`; menu to save, switch, update, rename, duplicate, delete;
  defaults "Desk" and "Grid".
- Controls: Layout menu, Tile all / Untile all / Show layout / Focus mode,
  Alt-based shortcuts registered as tldraw actions, per-window menu
  (button or long-press), double-click to rename, focus ring.
- Not done, deferred: stack/tab nodes (the engine's types allow adding one),
  maximize as a distinct state (Focus mode covers the camera side of it).

### M2 - IDE inside windows

- File tree window (File System Access API, with a fallback in-browser
  workspace).
- Editor window: CodeMirror 6, one Yjs document per file.
- Preview window: Sandpack.
- Console window for output and errors.
- Windows link to each other (file tree opens editor, editor updates preview).

### M3 - Programmable

- Canvas API: create/move/resize/close windows, run layouts, read the
  workspace, subscribe to events.
- Command palette.
- Script console that talks to the Canvas API.
- MCP server exposing the same API to agents.

### M4 - Collaboration

- Multiplayer canvas (tldraw sync or Liveblocks; decide then).
- Presence: cursors, who is in which window.
- Shared Yjs documents for files.

### M5 - Polish and plugins

- GenMoji plugin (see the original "3D GenMoji Generator" issue).
- Themes beyond light/dark.
- Export/import of workspaces.

## Architecture decisions

1. **Same repo, legacy under a route.** No new repository was available, so
   v2 lives on `main` and the 2025 prototype is preserved verbatim in
   `src/legacy/`, served at `/legacy`, and also kept as the `legacy` branch at
   commit `aa5f51d`. Both pages link to each other.
2. **tldraw SDK, free tier.** The watermark is acceptable. A license key is a
   single environment variable (`NEXT_PUBLIC_TLDRAW_LICENSE_KEY`). One tldraw
   version (3.15.x) serves both v2 and legacy. Assets are bundled from
   `@tldraw/assets`; nothing is loaded from tldraw's CDN.
3. **Local-first persistence.** The canvas is stored in the browser via
   tldraw's `persistenceKey`. No backend, no accounts, no keys to run.
4. **No vendor until M4.** Collaboration providers are a swap of the store in
   `src/desktop/desktop.tsx`; nothing else may depend on a vendor. The
   Liveblocks packages present today exist only for the legacy route.
5. **One Yjs document per file.** The 2025 prototype bound every editor to a
   single shared text, which merged all files into one. In M2 each file gets
   its own Yjs document keyed by path.
6. **Windows are the one primitive.** New content types are window _kinds_
   registered in `src/desktop/window-kinds.tsx`, not new shape types.
7. **Layout region = viewport bounds.** A layout is applied inside the
   viewport's page bounds at that moment. The region then stays where it is
   on the canvas while the user pans and zooms (tiled windows are canvas
   objects, not chrome) and is re-captured, debounced, when the browser
   viewport is resized. The bands tldraw's own chrome covers (menu bar on
   top, toolbar at the bottom) are excluded so title bars stay reachable. A
   user-chosen frame as region is a later option; the engine only needs a
   rectangle.
8. **The layout tree lives outside the tldraw document.** Shapes carry only
   `tiled: boolean`; the tree, preset and region are in the `WindowManager`
   and persisted to `localStorage` (`paperos-v2:wm`), workspaces to
   `paperos-v2:workspaces`. This keeps the document schema small and makes
   the tree a plain value the pure engine can operate on. When collaboration
   arrives (M4) the tree can move into document meta or a shared record.
9. **Alt is PaperOS's modifier.** Window-manager shortcuts are `Alt+...` and
   registered through tldraw's `overrides.actions`, so they show in the
   shortcuts dialog. tldraw's `Alt+Arrow` (change page) and `Alt+F` (tldraw
   focus mode) were remapped to `Alt+PageUp/PageDown` and `Alt+Shift+F`.
10. **Flat presets are rebuilt, split trees are edited.** Columns, grid and
    Bento are functions of the window list and get regenerated when windows
    join or leave; a split tree is the user's structure and only receives
    targeted insert/remove/ratio changes. Inserting with a side into a flat
    preset turns it into a split tree.

## Notes

- The annotated tag `v0-prototype` (at `aa5f51d`) could not be pushed from
  the automated session: the repository credential only allows branch
  updates. The `legacy` branch points at the same commit. To add the tag:
  `git tag -a v0-prototype aa5f51d -m "2025 prototype before the v2 rebuild" && git push origin v0-prototype`.
- Next.js 16 is available; this scaffold pins Next 15 (as decided). Upgrading
  is a follow-up once the Window shape work settles.
