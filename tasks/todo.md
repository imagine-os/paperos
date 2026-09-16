# tasks/todo.md

## M0 - Clean start

- [x] Preserve the 2025 prototype: branch `legacy` at `aa5f51d` (pushed);
      annotated tag `v0-prototype` created locally (push blocked, see Review)
- [x] Move prototype source verbatim to `src/legacy/`, route `/legacy`, banner
      back to `/`
- [x] Fresh dependency set: Next 15, React 19, tldraw 3.15.6 (+ `@tldraw/assets`),
      TypeScript strict, ESLint 9 flat config, Prettier, Vitest, Playwright
- [x] Bundle tldraw assets from `@tldraw/assets` (no `cdn.tldraw.com`)
- [x] Optional `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`, documented in `.env.example`
- [x] Route `/`: full-viewport canvas with `persistenceKey="paperos-v2"`
- [x] Top bar: PaperOS, "v2 preview" badge, Legacy link, New window, About
- [x] `Window` shape: title bar, close, focus-to-front, resize with min size,
      default size, tokens, light + dark
- [x] Window kinds registry: `note` (editable, persisted) and `about`
- [x] `w` tool creates a window on click; New window creates at viewport
      center; cascading placement
- [x] `src/wm/` types (`LayoutNode`, `Workspace`) and engine placeholder
- [x] Legacy auth route kept, `LIVEBLOCKS_SECRET_KEY` optional (503 without it)
- [x] README, CLAUDE.md, docs/PLAN.md, .env.example
- [x] CI workflow: `npm ci`, `npm run check`, `npm run build`
- [x] Unit tests (cascade, kinds registry) and Playwright smoke test
- [x] Validate: `npm run check`, `npm run build`, screenshots, e2e
- [x] Push to `main`

## M1 - Window manager

- [x] Plan written, foundation read (`src/desktop/`, `src/wm/`, docs)
- [x] Layout engine (`src/wm/`): types, `layout()` with gaps/padding/min sizes,
      presets (free, columns, grid, bento x3, split-tree), operations
      (insert/splitLeaf/swap/resizeRatio/remove/prune/tile), geometry helpers
      (drop zones, neighbour search), unit tests incl. rectangle invariants
- [x] `Window` shape: `tiled` prop + migration, tiled look, focus ring,
      inline title edit (from the menu), per-window menu, long-press menu
- [x] `WindowManager` service: region = viewport bounds, apply layouts via one
      `updateShapes` batch, z-order (tiled below floating), drag-detach,
      drop swap/insert with quadrant hint, gutter resize overlay
- [x] Workspaces: typed localStorage store (`paperos-v2:workspaces`),
      defaults Desk + Grid, top-bar menu (save/switch/update/rename/duplicate/
      delete), camera animation on switch
- [x] Controls: Layout menu, Tile all / Untile all / Show layout / Focus mode,
      keyboard via `overrides.actions` (Alt+1..5, Alt+Arrows, Alt+Shift+Arrows,
      Alt+Enter, Alt+F, Alt+N), responsive reflow (debounced), narrow columns
      collapse
- [ ] Follow-up: double-click on the title bar to rename (dropped, see Review)
- [x] Docs: PLAN.md (M1 status + decisions 7-10), README (window manager,
      shortcuts, workspaces), this checklist + Review
- [x] Tests: unit (engine, stores), e2e `e2e/wm.spec.ts`
- [x] Validate: `npm run check`, `npm run build`, screenshots, e2e, push

## M2 - IDE inside windows

- [x] Plan written, M1 foundation read (`src/desktop/`, `src/wm/`, docs)
- [x] Project model (`src/ide/project/`): paths + tree helpers, backends
      (memory/IndexedDB, File System Access, GitHub zipball, ZIP upload,
      dropped folders), project store under `paperos-v2:projects`, sample
      project on first run, permission re-request for folders
- [x] Per-file Yjs documents (`src/ide/docs.ts`): `Y.Doc` per project+path,
      `y-indexeddb` persistence, dirty tracking, save/reload,
      `attachProvider()` hook
- [x] Window kinds: `files`, `editor`, `preview`, `console`, `markdown`
      (icons, default sizes, file refs in `content`)
- [x] Preview bundler (`src/ide/preview/`): srcdoc from live buffers,
      console bridge, 300 ms debounce, snippet eval
- [x] Top bar: Open menu, New window menu, Commands, theme toggle; "IDE"
      workspace preset applied on first run; drop-to-import
- [x] Command palette (Ctrl+K) on a command registry (`src/ide/commands.ts`)
- [x] Tests: unit (project model, paths, tree, imports, docs, bundler,
      commands, formatter), e2e `e2e/ide.spec.ts`
- [x] Docs: README IDE section, PLAN.md M2 status + decisions 11-17, this
      Review
- [x] Validate: `npm run check`, `npm run build`, screenshots, e2e, push

## M3 - Programmable

- [x] Plan written, foundation read (`src/ide/commands.ts`, `src/wm/window-manager.ts`,
      `src/desktop/window-kinds.tsx`, `src/ide/project/store.ts`, `src/ide/docs.ts`,
      `src/ide/open-file.ts`)
- [x] Canvas API (`src/api/`): tool schema (`schema.ts`), event bus, facade over a
      `CanvasHost` interface (windows, layout, workspaces, projects, files,
      preview, console, commands, canvas, events), browser host on tldraw + WM +
      stores, `window.paperos`, `invokeTool` for object-style calls
- [x] `docs/CANVAS_API.md` generated from the schema (`npm run api:gen`) + sync test
- [x] Script console window kind (`script`): CodeMirror JS editor, output pane,
      Run (Ctrl+Enter), snippets menu, text persisted in `content`
- [x] Plugins (`src/plugins/`): ES-module plugins with `activate(api)`, commands,
      React-free window kinds, events; manager window kind (`plugins`); built-ins
      `clock` and `auto-tile`; enabled set in localStorage
- [x] Agent bridge: protocol module, browser WebSocket client, top-bar toggle +
      status, `?bridge=1`, `agent` transcript window with pause
- [x] MCP CLI in `tools/paperos-mcp/` (stdio MCP server + WebSocket bridge on
      127.0.0.1:7331, tools generated from the schema), `npm run mcp`, `docs/MCP.md`
- [x] Fix (M2 review): new editors join the editor column instead of squeezing
      the Files row; unit test
- [x] Tests: API facade (fake host), schema/tool generation, script runner,
      plugin loader, bridge protocol; e2e `e2e/api.spec.ts`
- [x] Docs: README Programmability section, `docs/PLAN.md` (M3 done, decisions),
      this file (Review)
- [x] Validate: `npm run check`, `npm run build`, screenshots, MCP end-to-end drive
- [x] Push to `main`, check CI

## Hosting - GitHub Pages

- [x] Static export mode in `next.config.ts` (`PAPEROS_STATIC=1`): `output:
    "export"`, base path `/paperos`, trailing slashes, unoptimized images,
      API route left out via `pageExtensions`
- [x] `withBasePath()` helper; legacy `authEndpoint` uses it (the only
      hard-coded absolute URL; links already use `<Link>`)
- [x] `npm run build:static` (`scripts/build-static.mjs`, writes `out/.nojekyll`)
- [x] `.github/workflows/pages.yml`: build + deploy on push to `main`; CI also
      runs `build:static`
- [x] Validate: `check`, `build`, `build:static`; `out/` served under
      `/paperos/` in Chromium: 0 console errors on `/`, tldraw assets 200 under
      `/paperos/_next/`, IDE first run (files/editor/preview/console), New
      window works, Legacy link and Back link stay under the base path; legacy
      page renders with the expected auth 404
- [x] README Hosting section, PLAN decision 24

## Review (M3)

### What changed

- `src/api/`: the Canvas API. `schema.ts` is the single description of the
  surface (42 methods, 10 namespaces); `canvas-api.ts` the facade;
  `host.ts` + `browser-host.ts` the app binding; `install.ts` wires events
  and `window.paperos`; `invoke.ts` and `run-script.ts` serve the bridge and
  the Script window; `bridge-protocol.ts` / `bridge-client.ts` the tab side
  of the agent bridge. `fake-host.ts` backs the tests.
- Window kinds `script`, `plugins`, `agent`; plugin system in
  `src/plugins/` with built-ins `clock` and `auto-tile`; sample project has
  `plugins/hello.js`.
- `tools/paperos-mcp/`: MCP server + WebSocket bridge CLI (own package,
  `npm run mcp:build`, `npm run mcp`), `scripts/demo.mjs` end-to-end driver.
- Docs: `docs/CANVAS_API.md` (generated), `docs/MCP.md`, README
  Programmability section, PLAN decisions 18-23.
- Small hooks in existing code: `ProjectStore.lastChange`,
  `onCommandRun` + `Command.run(args)`, `previewReload` signal,
  `WindowManager.setTree`, window-kinds `unregisterWindowKind` +
  `windowKindsChanged`, `WindowShapeUtil.toSvg`, tiling into an empty
  desktop starts Columns.
- Fix: `placeFileWindow` stacks new editors under the focused editor.

### Verified

- `npm run check` (typecheck, lint, 162 unit tests) and `npm run build`.
- Playwright: 15 e2e tests (smoke, wm, ide, api) against the dev server.
- Production build driven end to end over MCP: the SDK's stdio client starts
  the CLI, a headless tab connects with `?bridge=1`, `windows_create`,
  `layout_apply`, `windows_update`, `canvas_zoomTo`, `canvas_screenshot`
  (returned as an MCP image) and `events_poll` all round-trip; a call before
  the tab connects returns the "no tab connected" error.

### Decisions and notes

- Schema as data, facade over a host interface, page-privilege scripts and
  plugins, React-free plugin kinds, local CLI bridge: see PLAN decisions
  18-23.
- MCP tool names use `_` (`windows_create`) because MCP names allow no dots.
  A tool whose only parameter is an options object takes that object
  directly.
- The CLI's copies of `schema.ts` and `bridge-protocol.ts` are committed
  (so `npx -y .` works from a clone) and regenerated by `npm run api:gen`;
  `src/api/docs.test.ts` fails when they differ from the source.
- `tools/` is excluded from the root tsconfig and ESLint so the root build
  never depends on the CLI's `node_modules`. The CLI is not built in CI
  (it would add an install step); `npm run mcp:build` does it locally.
- `layout.tile(ids)` into an active split tree inserts at the right of the
  tree (the layout the caller asked for); editors opened from Files use the
  stacking rule instead.
- Known limitations: the tab dials `ws://127.0.0.1:7331` only (change both
  sides to use another port); one tab per bridge; window bodies other than
  note/script text are not in screenshots; plugin `html()` is not
  sanitized (plugins already run with page privileges); Playwright is still
  not in CI.

## Review (M2)

### What changed

- `src/ide/project/`: `paths.ts` (normalize/join/resolveRelative),
  `tree.ts` (build/filter/flatten), `kv.ts` (IndexedDB key-value with a
  memory twin for tests), `memory-backend.ts`, `fsa-backend.ts` (directory
  handle, permission query/request, copy-then-delete rename),
  `sample.ts`, `zip.ts` (JSZip on demand, text-only, common root stripped),
  `github.ts` (URL parsing, zipball fetch, explicit CORS/rate-limit errors),
  `store.ts` (`ProjectStore`: metas + active id in IndexedDB, sessions with
  reactive file lists, mutations that bump a `changes` signal).
- `src/ide/docs.ts`: `getFileDoc(project, path)` returns a shared
  `FileDoc` (Y.Doc, Y.Text, `ready`, `dirty`, `error`, `save`, `reload`);
  `readLiveText()` gives the buffer or the backend; `docsChanged` ticks on
  every edit for the preview and markdown windows.
- `src/ide/preview/bundle.ts` + `CONSOLE_BRIDGE`; `src/ide/commands.ts`
  (registry, sources, `fuzzyScore`, `searchCommands`); `src/ide/theme.ts`;
  `src/ide/editor/create-editor.ts` (lazy CodeMirror factory, themes in a
  Compartment) and `format.ts` (Prettier standalone by extension).
- `src/desktop/kinds/`: `files.tsx`, `editor.tsx`, `preview.tsx`,
  `console.tsx`, `markdown.tsx`, `file-picker.tsx`. `window-kinds.tsx`
  gained `icon`, `defaultSize`, `hidden`. `open-file.ts` implements the
  reuse/insert/cascade rule. `project-actions.ts` holds the Open actions
  and drop import. `ide-workspace.ts` builds the IDE split tree through the
  new `WindowManager.applyTree()`; "IDE" is a default workspace
  (`ws_ide`). `ide-commands.ts` fills the registry; `command-palette.tsx`
  renders it (Ctrl+K is captured at the document level so it works inside
  CodeMirror; the tldraw action `$k` lists it in the shortcuts dialog).
- Top bar: Open, New window (per kind), Commands, theme toggle; tldraw's
  color scheme follows `resolvedTheme`. `desktop.tsx` runs the first-run
  IDE setup, drop handlers and a Ctrl+S default-prevent.
- Dependencies added: `y-indexeddb`, `jszip`, `marked`, `dompurify`,
  `@codemirror/language-data`, `@codemirror/theme-one-dark`, the
  `@codemirror/*` packages the factory imports directly; `prettier` moved
  to dependencies (standalone + plugins are dynamic imports).
- e2e: `e2e/ide.spec.ts` (6 tests), `e2e/helpers.ts` (`skipFirstRun`,
  `newNoteWindow`); `smoke.spec.ts` and `wm.spec.ts` go through the New
  window menu and skip the first-run IDE setup.

### Verified in a real browser (Chromium 1440x900, production build)

- Zero console errors on `/` through: first run, editing index.html
  (preview updates live, dirty dot, Ctrl+S saves, Save disabled), console
  snippet result, palette (search + open file by name), Markdown window,
  dark theme, file context menu, reload (arrangement, edited buffer and
  preview all come back). `/legacy` renders with only its known Liveblocks 503.
- Screenshots and a webm of edit-to-preview are in the session scratchpad
  (`v2shots/m2/`). All 12 Playwright tests pass; `npm run check` and
  `npm run build` pass. Route `/` first-load JS stays at 106 kB; editors,
  Prettier, JSZip, marked/DOMPurify and y-indexeddb load on demand.

### Decisions and notes

- Sandpack was replaced by an in-house srcdoc bundler (PLAN decision 13):
  no CDN, works offline, no vendor.
- The preview reflects unsaved buffers, not just saved files: the spec
  asked for refresh on save, but live buffers make edit-to-preview
  immediate and the 300 ms debounce keeps it cheap. Save still matters for
  the backing store (disk for folder projects).
- One file per editor window, per the spec's "keep it simple"; the title
  carries the path and the dirty dot. Opening a file reuses the window that
  shows it, then an empty editor, then creates one next to Files.
- Files are text only in M2; binaries are skipped on import with a count
  in the console. SVG assets are inlined as data URIs.
- Folder projects: renames copy then delete (the File System Access API
  has no portable rename). Permission must be re-granted after a reload
  from a click; the Files window shows the button.
- `window.prompt`/`confirm` are used for names and confirmations, matching
  M1.
- `y-indexeddb` creates one IndexedDB database per opened file. Fine for a
  project's worth of files; a single-database persistence can replace it
  behind `docs.ts` later.
- Known: opening a file while the "IDE" split tree is active inserts a new
  editor as a sibling of Files, so several opened files squeeze the row;
  close editors or float them. Tabs are a follow-up.
- Known: tldraw's local persistence is throttled, so reloading within
  ~600 ms of creating a window loses it (pre-existing, PLAN decision 17).
- Vercel's deployment status on `main` continues to show the known
  Hobby-plan failure; CI is the GitHub Actions workflow.

## Review (M1)

### What changed

- `src/wm/` is now a real engine: `types.ts` (leaf / n-ary split / grid
  tree, presets, workspace), `tree.ts` (immutable tree helpers),
  `layout-engine.ts` (`layout()`, minimum sizes via `fitSizes`), `presets.ts`
  (columns, grid, Bento templates filled in reading order, alternating split
  tree), `operations.ts` (insert as sibling when the parent splits the same
  way, otherwise wrap; swap; ratio resize clamped to 8%; remove with
  collapse; `tile()`), `geometry.ts` (drop zones with a 40% center, neighbour
  search, reading order). Everything is pure and covered by 70 unit tests
  including invariants (no overlap, inside region, ratios sum to 1) and a
  200-step randomized operation sequence.
- `window-manager.ts` holds the live tree/preset/region in tldraw atoms,
  writes rectangles with one `updateShapes` per change (undo works; gutter
  drags squash into one entry), sends tiled windows to the back after every
  apply, prunes deleted windows via a side effect, re-tiles a window that
  comes back from undo, re-captures the region on viewport resize
  (debounced 150 ms) and rebuilds flat presets with `narrow` under 720 px.
- `window-shape.tsx`: `tiled` prop with a props migration (existing canvases
  load), `canResize` false when tiled, `onTranslate` detaches after 24 page
  units and feeds the drop hint, `onTranslateEnd` inserts or swaps. Focus
  ring from `wm.focusedId`, `...` menu, long-press (500 ms) opens the same
  menu, "Rename..." in the menu edits the title inline.
- `wm-overlay.tsx` (`InFrontOfTheCanvas`): gutters between split children
  (min 8 px on screen, cursor col/row-resize) and the drop-zone highlight.
- Top bar: `Layout` and `Workspaces` dropdowns (`menu.tsx` primitives, no
  dependency). Workspaces are in `workspace-store.ts` (validated JSON in
  `localStorage`), live arrangement in `wm-state.ts`.
- `wm-actions.ts` registers the shortcuts as tldraw actions; the shortcuts
  dialog gets a "PaperOS" group.
- e2e: `e2e/wm.spec.ts` (columns geometry, Alt+3/Alt+1, workspace save +
  reload + switch, drag detach + center swap + edge insert). Both specs pass
  against the production build.

### Verified in a real browser (Chromium 1440x900 and 390x844)

- Zero console errors on `/` while tiling, switching presets, using every
  shortcut and dragging. `/legacy` unchanged (only its known Liveblocks 503).
- Screenshots and a webm of the tiling flow are in the session scratchpad
  (`v2shots/m1/`).

### Decisions and notes

- Layout region = viewport bounds at apply time (PLAN decision 7). The
  tree lives outside the tldraw document (decision 8) so shapes only carry
  `tiled`.
- tldraw's `Alt+Arrow` (change page) and `Alt+F` (tldraw focus mode) were
  remapped to `Alt+PageUp/PageDown` and `Alt+Shift+F`.
- Double-click-to-rename was dropped (per the owner's steer): tldraw's select
  tool owns double-clicks on shapes, and without a util handler it creates a
  text shape at the pointer. `WindowShapeUtil.onDoubleClick` now returns a
  no-op change so double-clicking a window does nothing, and "Rename..." lives
  in the per-window menu (inline title editor).
- Rename / delete workspace use `window.prompt` / `window.confirm` on
  purpose (smallest thing that works; a dialog can replace them later).
- Not done: stack/tab nodes and a separate "maximize" state (Focus mode zooms
  the camera instead). Playwright is still not in CI (needs a Chromium
  download step); run `npm run e2e` locally.

## Review (M0)

### What changed

- The repo is now the PaperOS v2 app. `/` is the desktop, `/legacy` the 2025
  prototype. Old template files (`.eslintrc.json`, `next.config.js`, the
  Liveblocks template README) are replaced.
- `src/desktop/` holds the canvas, the `Window` shape, the `w` tool, the
  window kinds registry and cascading placement. `src/wm/` holds the layout
  types for M1. `src/lib/` holds env and asset helpers.
- Verified in a real browser (1440x900): toolbar icons load from the bundle,
  three windows cascade, text typed in a note is stored in shape props and
  survives a reload, `w` + click creates a window, close removes it, drag
  moves it, dark mode follows the system. No console errors on `/` other
  than Next's CSS preload notices. `/legacy` logs the expected Liveblocks
  auth failure (503, key not configured) and nothing else app-related.

### Legacy adaptations (kept to the minimum)

1. Import paths: `@/components/Loading` -> `@/legacy/Loading`,
   `@/database` -> `@/legacy/database`; `page.tsx` moved to
   `src/app/legacy/page.tsx` with the banner added around the original tree.
2. `src/types/tldraw-extensions.d.ts` deleted (pointed at a path that no
   longer existed and misused tldraw's types).
3. `StorageTldraw.tsx`: root `div` is `100%` instead of `100vh/100vw` so it
   fits under the banner; `assetUrls` now uses the bundled tldraw assets
   (the CDN is unreachable from some networks, and the icons rendered blank).
4. `project-browser.component.tsx:82`: `editor.getShape<IProjectBrowserShape>(...)`
   so `props.w` typechecks under tldraw 3.15 / TS 5.9.
5. `api/liveblocks-auth/route.ts`: Liveblocks client is created inside the
   handler and the route answers 503 when `LIVEBLOCKS_SECRET_KEY` is unset
   (before, the module threw at import time). The unused `request` parameter
   was dropped.
6. `@codemirror/state` added as an explicit dependency (the legacy editor
   imports it directly; it used to arrive transitively).
7. ESLint: the legacy folder keeps the prototype's habits as warnings, not
   errors (`eslint.config.mjs`).

### Decisions and notes

- Next 15 (15.5.x) as decided, even though Next 16 is out. tldraw stays on
  3.x (3.15.6): 4.x and 5.x exist, but one version must serve both apps and
  3.x is what the legacy code was written for.
- Vitest is 3.x: npm 10.9 crashed resolving Vitest 4's optional peers.
- The Playwright smoke test is `npm run e2e`, not part of CI yet: CI would
  need a Chromium download step. Add it when the suite is worth the minute.
- Fonts: system font stack instead of `next/font/google` so builds work
  offline and without third-party requests.
- **Tag `v0-prototype` not pushed:** the automated session's credential only
  permits `refs/heads/*` updates ("push contains a ref outside refs/heads/*")
  and the GitHub API write path is blocked through the proxy. The `legacy`
  branch preserves the same commit. Create the tag from any normal clone:
  `git tag -a v0-prototype aa5f51d -m "2025 prototype before the v2 rebuild" && git push origin v0-prototype`.
