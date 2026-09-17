# M9 - Polish

Goal: the live demo feels finished for a first-time visitor. Three commits,
each pushed on its own.

## Commit 1 - First-run experience

- [x] Tour steps gain `target` (a top-bar element), `run` (a command), `board`
      (another board's section) and `action` (a closing button); the overlay
      moves above the whole desktop so it can frame the top bar.
- [x] Welcome tour (8 steps): IDE workspace, Open, Layout, New window +
      Commands, Share + Agent bridge, a board, Data lineage, "Open the Small
      Business SaaS sample". Shown once (`paperos-v2:welcome-seen`), "Take
      the tour" in About and the palette.
- [x] "Start here" card on an empty canvas: Open sample, Play a board, Watch
      the tour.
- [x] Keyboard map window kind `keys`: built from the command registry and
      tldraw's actions/tools plus the editor and terminal keys, grouped,
      searchable, `?` and the palette open it. Unit test: no registered
      shortcut is missing.
- [x] Empty states with one-click fixes: Preview (create index.html), Files
      (open the sample), Pages (create the starter library), Data / Schema
      (add a first table), Boards menu (save the canvas as a board).
- [x] e2e `onboarding.spec.ts`; helpers skip the welcome tour in the specs
      that start fresh.

## Commit 2 - Performance and robustness

- [x] Measure before: /app cold time to interactive, JS transferred, largest
      chunks; 60-window pan frame time.
- [x] Code-split heavy window kinds (Design, Page Builder, Data, Schema,
      Connections, Lineage, Browser, Terminal, Share, Script, Plugins, Agent).
- [x] Culling for arrows/labels at low zoom; throttled store persistence.
- [x] Error boundary per window (Reload window card); global "Something
      broke" toast with Copy details.
- [x] Persistence: schema version in the project store, migration hook,
      "Reset local data" in About with a confirm.
- [x] Measure after; write both in the Review.

## Commit 3 - Accessibility and landing refresh

- [ ] axe-core via Playwright on /, /app, a board, Data, Share; fix
      serious/critical; focus order and rings; aria labels on icon buttons;
      reduced motion; preset token contrast.
- [ ] Landing: screenshot carousel from `public/shots/` (`npm run shots`),
      "What's inside" grid, Status from the plan, deep links (`?board=`).
- [ ] README, PLAN (M9 done, decisions), todo Review, CLAUDE.md folder map.

# M8 - Collaboration

- [x] Transport: `src/collab/` with room ids, transport selection (y-webrtc
      default with public signaling + self-hosted URL, y-websocket for a
      self-hosted server), provider interface, identity (name + color).
- [x] Sync: tldraw store <-> Y.Map (one Yjs doc per room), presence through
      awareness -> instance_presence records; project files <-> Y.Map of
      Y.Text mirrored to the local project backend; per-file docs bind to the
      room doc (`setDocSource` in docs.ts).
- [x] Session: create / join / leave, `?room=` links, joiner adopts the room's
      project (confirm), creator seeds an empty room, y-indexeddb per room.
- [x] `tools/paperos-sync/`: tiny y-websocket server (ws + yjs + y-protocols).
- [x] UX: Share button + Share window kind, participants, status, title-bar
      chips, CodeMirror remote cursors, robot badge for bridge agents.
- [x] Canvas API `collab.*`, `collab.changed` event, palette commands, docs
      regenerated, MCP schema copy.
- [x] Board "Collaborate" in the sample + tour.
- [x] Tests: unit (room ids, transport selection, awareness mapping, store
      sync, project sync, sync server), e2e with two contexts + local server.
- [x] Docs: docs/COLLAB.md, README Share section, PLAN M8 + decisions, landing
      status, todo review. Screenshots + webm.

## Review (M9, commits 1 and 2)

### Commit 1 - First-run experience (90a8309)

- Tour steps carry `target` / `run` / `board` / `action`; the overlay moved
  from tldraw's `InFrontOfTheCanvas` to the desktop root so it can frame
  the top bar (`src/desktop/tour-overlay.tsx`). `src/desktop/welcome-tour.ts`
  defines the eight steps; `paperos-v2:welcome-seen` keeps it to one showing.
- Start here card (`start-here.tsx`), keyboard map (`keymap.ts`,
  `kinds/keys.tsx`; built from the command registry plus tldraw's
  `useActions()` / `useTools()`), `EmptyState` component used by Preview,
  Files, Pages, Data and Schema with one-click fixes (`addFirstTable`,
  `createStarterDesign`, `STARTER_HTML`).
- Escape while a top-bar menu is open also ends a tour (both listen on
  the document in the capture phase); the onboarding e2e closes menus by
  clicking the button again. Known, small.

### Commit 2 - Performance and robustness

Measured with `.scratch/perf.mjs` (Playwright, Chromium headless, cache
disabled, `next start` on localhost, 1440x900, medians of 3 cold loads;
pan = 120 frames of `canvas.setCamera` on a canvas of 60 windows (notes,
data grids, previews, editors, markdown, cards, schema) with 9 labeled
arrows, frame time from requestAnimationFrame deltas).

| Metric                                      | Before (90a8309)      | After                 |
| ------------------------------------------- | --------------------- | --------------------- |
| /app cold, top bar visible                  | 596 ms                | 559 ms                |
| /app cold, canvas visible                   | 603 ms                | 584 ms                |
| /app cold, `window.paperos` ready           | 620 ms                | 636 ms                |
| First run, editor shows index.html          | 801 ms                | 781 ms                |
| JS transferred on a cold /app (gzip)        | 1097 kB / 23 files    | 1052 kB / 25 files    |
| JS uncompressed on a cold /app              | 2581 kB               | 2484 kB               |
| Desktop chunk (everything under /app)       | 712 kB                | 436 kB                |
| Pan, 60 windows, zoom 0.22: avg / p95 / max | 16.9 / 18.7 / 29.8 ms | 16.7 / 18.5 / 29.1 ms |
| Pan, 60 windows, zoom 0.6: avg / p95 / max  | 16.6 / 18.9 / 30.0 ms | 16.6 / 18.3 / 22.6 ms |
| Pan, 60 windows, zoom 0.08: avg / p95 / max | 16.6 / 16.8 / 20.6 ms | 16.6 / 17.0 / 19.6 ms |

Reading: the pan is vsync-bound (16.7 ms at 60 Hz) before and after, so the
60-window board already panned smoothly; the change is in the tail (p95 and
max drop at every zoom). Cold load on localhost is dominated by tldraw's
1.3 MB chunk (390 kB gzip), which every desktop paint needs; the code
splitting moved 276 kB (uncompressed) of window kinds and the two sample
templates out of the desktop chunk into 17 on-demand chunks, but the first
run fetches the sample template chunk right away (a fresh store creates the
sample), so the wire total only drops 45 kB. Largest chunks after: tldraw
1309 kB, Prettier (on demand) 863 kB, desktop 436 kB, CodeMirror (on demand)
206 kB, React 214 kB.

What shipped:

- Code splitting: every kind except Files, Editor, Preview, Console, Note
  and About is `React.lazy` (`window-kinds.tsx`); the window frame wraps
  the body in `Suspense` (placeholder while a chunk loads). The sample and
  SaaS templates and the starter design library load on demand
  (`store.createSampleProject`, `createStarterDesign`).
- Culling: `zoom-band.ts` (near / mid / far with hysteresis) sets
  `data-zoom` on the canvas container once per band change; CSS hides arrow
  labels below 30% zoom and whole arrows below 10%.
- Store persistence: the window manager writes its tree 250 ms after the
  last change (flushed on dispose and `pagehide`) instead of on every atom
  change.
- Error boundaries: `WindowErrorBoundary` per window body (card with the
  message, Reload window, Copy details); `problems.ts` collects crashes,
  uncaught errors and unhandled rejections (deduped, last three) for the
  "Something broke" toast with Copy details.
- Persistence safety: `src/ide/project/migrations.ts` stamps the project
  store with a schema version at init and runs ordered migrations (a newer
  store is left alone and logged); "Reset local data..." in About (window
  and menu) and the palette wipes `paperos-v2*` storage, the project store,
  the Yjs databases and tldraw's document after a confirm and reloads into a
  first run.
- Tests: 337 unit (migrations, problems, zoom band), `e2e/robustness.spec.ts`
  (crashing window, arrow culling, reset).

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

## Landing page

- [x] `/` is a static sales page (`src/app/page.tsx`, `landing.css`,
      `landing-visual.tsx`): hero with the product line and three CTAs, an
      inline-SVG desktop scene (animated on load, reduced-motion aware), a
      six-tile feature grid, How it works, Built for, an honest Status panel
      linking to `docs/PLAN.md`, footer; light/dark, 360-1600px, keyboard
      accessible
- [x] Desktop moved to `/app` (`src/app/app/page.tsx`); legacy banner links
      to `/app`; all e2e specs visit `/app`; new `e2e/landing.spec.ts`
- [x] Visual language documented in `docs/BRAND.md` (palette, type, spacing,
      radii, shadows, motion) for the design system to adopt
- [x] Docs: README routes table + hosting, PLAN decision 31
- [x] Validate: `check`, `build`, `build:static` (index, app, legacy, 404),
      `out/` served under `/paperos/` in Chromium, screenshots, full e2e
      against the production build

## M4 - Data

- [x] Plan written, foundation read (`src/ide/project/`, `src/ide/docs.ts`,
      `src/ide/preview/bundle.ts`, `src/desktop/window-kinds.tsx`, `src/api/`)
- [x] Data model (`src/data/`): schema types + parser, row validation
      (types, required, unique, refs, defaults), in-memory query
      (filter/sort/paginate), CSV/JSON import-export, schema diff + row
      migration, `DataStore` over the project's files (through the Yjs docs)
      with a `changed` signal; unit tests
- [x] Bindings (`src/data/bindings.ts`): scanner for `data-source` /
      `data-field` attributes, `components/*.json` + `pages/*.json`
      `bindings`, and `paperos.data.<table>` calls; index by table and by
      source with file + line; unused tables and broken bindings; tests
- [x] Preview runtime (`src/data/runtime.ts`): `paperos.data` shim +
      `data-source` hydration injected by the bundler with the tables embedded;
      tests (fake DOM)
- [x] Window kinds `data` (grid), `schema` (SVG ERD + editable form),
      `connections` (graph + lists); editor "reveal line"
- [x] Sample project: `data/schema.json`, `roles`, `users`, `menu_items`,
      `pages`; `components/side-menu.json`, `components/mega-menu.json`,
      `pages/home.json`; index.html with a role switcher, side menu and mega menu
- [x] Canvas API `data` namespace (schema, host, facade, fake host, tests),
      `data.changed` event, `npm run api:gen`
- [x] Commands ("Show connections for current file", "Apply Data workspace";
      New window offers Data / Schema / Connections), "Data" workspace preset
- [ ] Follow-up: a palette command per table ("Open table: x") needs a
      synchronous table cache; `paperos.data.open(table)` covers it for now
- [x] Docs: README Data section, `docs/PLAN.md` (M4 done, decisions 25-30),
      `docs/CANVAS_API.md`, this Review
- [x] Tests: unit + `e2e/data.spec.ts`
- [x] Validate: `npm run check`, `npm run build`, screenshots, push, CI

## M5 - Design system, pages and flowcharting

- [x] Plan written, foundation read (`src/data/`, `src/desktop/kinds/*`,
      `src/desktop/window-shape.tsx`, `src/wm/window-manager.ts`,
      `src/ide/preview/bundle.ts`, `src/api/`, tldraw arrow/frame APIs)
- [x] Design tokens (`src/design/tokens.ts`): `design/tokens.json` types,
      defaults, tolerant parser, `--ds-*` CSS generation (light + dark), base
      component CSS; injected by the bundler when the file exists
- [x] Components (`src/design/components.ts`, `render.ts`):
      `design/components/*.json` (name, props typed with defaults, slots,
      template with `{prop}` / `{@html}` / `{#each}` / `{#if}`, variants,
      bindings); self-contained renderer shared by the bundler and the
      preview runtime (`<ds-component>` / `data-component` hydrate); starter
      library (Button, Card, Table, Form, Nav, MegaMenu, Hero, Stat, List,
      Grid, Tabs, Modal, Badge, Avatar)
- [x] Pages (`src/design/pages.ts`): `pages/*.json` schema (title, route,
      12-column layout, component blocks with props / bindings / children,
      links, device), validation, HTML rendering; the preview renders a page
      when the entry is `pages/<name>.json`
- [x] Design window kind (`design`): Tokens (swatches, type scale, spacing,
      radius, shadows, light/dark toggle, live preview, writes tokens.json),
      Components (gallery with variants, inspector, Insert into page),
      Guidelines (`design/README.md`)
- [x] Page Builder window kind (`pages`): page list, block list in the grid,
      move / reorder / add from library, props panel, table and field
      dropdowns from the schema, device toggle (390 / 820 / 1280) with an
      embedded preview, writes `pages/*.json`
- [x] Flowcharting: arrows bind to windows (connect handle on the title bar),
      sections as frames (group selected, section from workspace), tiling
      inside the focused section, `card` window kind, project map generator
      (`map.generate` / `map.regenerate`, layered layout, keeps positions),
      "Map" workspace
- [x] Canvas API: `map.generate`, `map.regenerate`, `flow.connect`,
      `flow.disconnect`, `flow.list`, `sections.create`, `sections.list`
      (schema, host, facade, fake host, tests, `npm run api:gen`)
- [x] Sample project: `design/tokens.json`, `design/components/*.json`,
      `design/README.md`, pages `home`, `products`, `admin` bound to the M4
      tables with links between them
- [x] Tests: unit (tokens, renderer, pages, map layout, flow API) and
      `e2e/design.spec.ts`
- [x] Docs: README (Design system, Pages, Flowcharting), `docs/PLAN.md`
      (M5 done, decisions), `docs/CANVAS_API.md`, this Review
- [x] Validate: `npm run check`, `npm run build`, `npm run build:static`,
      screenshots, push, CI

## M6 - Gorgeous design system, boards and tours, Small Business SaaS

- [x] Plan written, foundation read (`src/design/`, `src/map/`, `src/desktop/kinds/`,
      `src/wm/`, `src/api/`, `src/ide/project/sample.ts`, `docs/BRAND.md`)
- [x] Part 1: `docs/BRAND.md` ported into `design/tokens.json` defaults (paper/ink
      palette, rose-ember-amber gradient, display + body type, fluid scale, 4px
      spacing, 8/12/20/pill radii, layered shadows, glass, dot grid, motion);
      premium base CSS; upgraded 14 components + Pricing, Testimonial, FAQ,
      Footer, Sidebar, Topbar, KpiGrid, Timeline, Calendar, Kanban, Thread,
      Chart, EmptyState (+ TenantSwitcher, RoleSwitcher, PageHeader, TabBar,
      Section, PostCard, AdCard); theme presets Paper / Ink / Studio / Bold in
      the Design window; dark mode in the renderer; sample pages look like a
      product; push
- [x] Part 2: boards (`src/boards/`, `boards/*.json`): model, layout, build,
      save, list; tour mode with overlay, keys and captions; Canvas API
      `boards` namespace; Boards menu; curated boards "Build a product",
      "Ship a feature", "Agent-driven" in the sample; docs + CLI schema; push
- [x] Data lineage (priority insertion): `src/lineage/` graph builder and
      boards, "Data lineage" and "Data lineage for <page>" in the Boards
      menu and palette, per-page focus (dropdown, card Focus, API), "Data
      sources" overlay in Preview / Page Builder with hover hinting, Canvas
      API `lineage.*`, unit + e2e tests, screenshots; push
- [x] Part 3: "Small Business SaaS" template (multi-tenant data model seeded
      for 5 tenants, customer app, admin dashboard, marketing site, social and
      ad production, outreach CRM), tenant / role switchers, showcase board,
      viewport culling for heavy windows
- [x] Tests: unit (boards, tour, template, tenant filtering) and
      `e2e/boards.spec.ts`
- [x] Docs: README, `docs/PLAN.md` (M6 done, decisions), `docs/CANVAS_API.md`,
      landing status, this Review
- [x] Validate: `npm run check`, `npm run build`, `npm run build:static`,
      `npm run e2e` (production build), screenshots and tour video, push, CI

## M7 - Browser and Terminal windows

- [x] Plan written, foundation read (window kinds, Canvas API host/facade,
      bridge protocol, boards, MCP CLI)
- [x] Browser: pure model in `src/browser/` (addresses incl. `paperos://`
      targets, embed-refusal heuristic + blocked list, tab state, bookmarks
      file), unit tests
- [x] Browser window kind: tab strip, URL bar with back/forward/reload/home,
      bookmarks (`browser/bookmarks.json`), Open in new tab, refusal card,
      internal targets (Preview, /legacy, docs, landing), sandboxed iframe
- [x] Canvas API `browser.*` (open, navigate, back, forward, reload, tabs,
      bookmarks, bookmark), commands, "Ship a feature" board step, sample
      bookmarks file, docs regenerated
- [x] Bridge: tab -> bridge `request`/`response` messages; CLI local tools
      `browser.fetch` and `browser.screenshot` (Playwright optional), MCP
      tools `browser_fetch` / `browser_screenshot`, docs/MCP.md
- [x] e2e `e2e/browser.spec.ts`; check, build, build:static, e2e; push Part 1
- [x] Terminal: pure project shell in `src/terminal/` (interpreter over a
      virtual fs, completion, history), unit tests
- [x] Terminal window kind: own terminal component, Project shell and Bridge
      shell backends, opt-in confirm for the bridge shell, backend indicator
- [x] Bridge `shell.*` tools (node-pty optional, child_process fallback) and
      `stream` messages; Canvas API `terminal.*`; palette commands;
      "Agent-driven" board step; docs/MCP.md security section
- [x] e2e `e2e/terminal.spec.ts`; check, build, build:static, e2e; push Part 2
- [x] Docs: CANVAS_API.md, README (Windows), PLAN (M7 done + decisions),
      landing status, this Review
- [ ] Screenshots and webm in the scratchpad (`v2shots/m7/`)

## Review (M8)

### What changed

- `src/collab/`: `room-id.ts` (ids, links, `roomKey`), `config.ts`
  (transport selection: explicit > stored > env > public WebRTC),
  `participants.ts` (awareness -> participants, colors, initials),
  `identity.ts` (name and color in localStorage), `providers.ts` (y-webrtc
  and y-websocket behind `CollabProvider`, loaded on demand), `store-sync.ts`
  (tldraw store <-> `Y.Map`, presence <-> awareness), `project-sync.ts`
  (seed, adopt, two-way mirror), `session.ts` (`CollabSession`: create,
  join, leave, setName, `?room=` on load, focus and agent fields).
- `src/ide/docs.ts`: `setDocSource()`, `resetFileDocs()`, `docsGeneration`,
  `FileDoc.shared` / `awareness`, `clearFileDocStorage()`; shared docs are
  never dirty and `reload()` never overwrites the room. Editors rebind on
  the generation and pass the awareness to `yCollab`.
- UI: Share button, Share window kind, title-bar chips (`WindowPeers`),
  palette commands `share.*`, the "Collaborate" board and tour, landing
  status.
- Canvas API `collab.*` + `collab.changed`; fake host with an in-memory
  room; docs and CLI schema regenerated.
- `tools/paperos-sync/server.mjs` (+ `npm run sync`), used by
  `playwright.config.ts` as a second web server for `e2e/collab.spec.ts`.
- Docs: `docs/COLLAB.md`, README "Share (rooms)", PLAN M8 + decisions 52-57.

### Verified

- `npm run check` (322 unit tests), `npm run build`, `npm run build:static`,
  `npm run e2e` against the production build with the local relay.
- Two Chromium contexts in one room through `tools/paperos-sync`: a note
  created in A appears in B, B adopts A's project under the same id, both
  editors on `index.html` show the other's caret and text, both backends
  follow the shared buffer, the chip shows the other peer, leaving keeps
  the copy. Screenshots and a webm in the session scratchpad
  (`v2shots/m8/`).

### Decisions and notes

- Remote store changes are applied in a microtask: a provider (or the
  store's own integrity checker) can deliver while the store is inside a
  transaction and `mergeRemoteChanges` must not nest.
- The public signaling server is y-webrtc's `wss://y-webrtc-eu.fly.dev`;
  tests never touch it (the e2e uses the local relay).
- Joiners never seed: a join waits for the room's content (6 s before it
  says "waiting", then indefinitely), so a slow first sync cannot merge two
  projects into one room.
- The tiling layout is personal (decision 8); positions travel with the
  shapes, so a peer's "Tile all" moves everyone's windows but leaves their
  trees alone. Shared layouts are a follow-up.
- `y-indexeddb` databases of a project's local documents are removed on
  leave (best effort, `indexedDB.databases()`), so stale pre-room buffers do
  not reappear over the mirrored files.
- Not done: TURN, relay persistence, access control, binary files (see PLAN).

## Review (M7)

### What changed

- Browser window kind (`src/desktop/kinds/browser.tsx`) with its pure model
  in `src/browser/`: addresses (`paperos://preview|docs|legacy|home`, http(s),
  bare hosts, project paths), tab state kept in the window `content`,
  bookmarks as `browser/bookmarks.json`, an embed-refusal heuristic
  (blocked-host list, 8 s timeout, load event) and bundled docs (`?raw`
  imports of README.md and docs/*.md, loaded on demand). Canvas API
  `browser.*`, palette commands, a Browser step on "Ship a feature", the
  sample ships a bookmarks file.
- Terminal window kind (`src/desktop/kinds/terminal.tsx`) with its model in
  `src/terminal/`: a pure project shell (tokenizer with quotes, pipes and
  redirection; ls, cd, pwd, cat, echo, mkdir, touch, rm, mv, cp, find, grep,
  head, tail, wc, tree, clear, help, history; globs; completion for
  commands, paths, presets, tables and boards) with PaperOS commands
  (`open`, `preview`, `data`, `board`, `layout`, `api`, `js` REPL) behind a
  `ShellHost`; a `TerminalSession` per window (registry by window id) that
  the component and the Canvas API share; the bridge shell backend over
  `shell.*` CLI tools with an opt-in confirmation. Canvas API `terminal.*`,
  palette commands, a Terminal step on "Agent-driven".
- Bridge protocol v2: `request` / `response` (tab → CLI) and `stream`
  (CLI → tab). CLI local tools: `browser.fetch`, `browser.screenshot`
  (Playwright optional; MCP tools `browser_fetch`, `browser_screenshot`) and
  tab-only `shell.spawn|write|resize|kill|list` (node-pty optional, pipes
  otherwise, `PAPEROS_BRIDGE_NO_SHELL=1` to refuse).
- Fixes found on the way: `FileDoc.loaded` so `peekLiveText` falls through
  to the backend while a document is still seeding; the Boards menu's "on
  canvas" check is reactive to the store; `.pos-browser` fills the window
  body.
- Docs: `docs/CANVAS_API.md` regenerated (`browser.*`, `terminal.*`),
  `docs/MCP.md` (real browser and real shell through the bridge, security),
  README (Windows rows, Browser and Terminal sections), PLAN (M7 done,
  decisions 44-51, collaboration is M8), landing status, CLAUDE.md folder
  map.

### Verified in a real browser (Chromium, production build)

- `e2e/browser.spec.ts`: the preview renders inside the Browser, tabs open
  and close, docs link to each other and Back works, a bookmark lands in
  `browser/bookmarks.json`, github.com shows the refusal card, the API
  navigates and goes back.
- `e2e/terminal.spec.ts`: `ls` lists the sample, Tab completes `pages/` and
  lists candidates, `open index.html` opens an editor, errors are marked,
  `grep | wc > file` writes a project file, the Bridge shell confirmation
  appears and cannot start with the bridge off; `terminal.run` from the API
  opens a window and returns output.
- The CLI's pipe-mode shell was exercised by hand (`shell.spawn`,
  `shell.write "echo hello"`, `shell.kill`).
- Screenshots in the scratchpad `v2shots/m7/`.

### Decisions and notes

- No xterm.js: the terminal is a list of lines plus an input row, ANSI is
  stripped. Enough for the project shell and line-mode work; full-screen
  programs would need a real emulator (see PLAN decision 50).
- Playwright and node-pty are never installed by `npm run mcp:build`; both
  load with a dynamic import and the tools explain how to install them.
- The `shell.*` tools are not MCP tools on purpose; agents can only type
  into a shell the person started.
- The static export carries the docs as text chunks (about 200 KB, loaded
  when a docs address opens).

## Review (M6)

### What changed

- `src/design/`: tokens rewritten from `docs/BRAND.md` (`tokens.ts`,
  `presets.ts` with Paper / Ink / Studio / Bold), `base-css.ts` (premium CSS
  for 35 components, the `.ds-src-*` overlay), `starter.ts` (35 components),
  `render.ts` (icons, avatars, SVG charts and calendars, preview context:
  tenant and role, tenant brand colors, role gates, `showSources` overlay),
  `pages.ts` (nested page names, `theme`, `texture`, `padBottom`),
  `gallery.ts`; the bundler passes `?tenant=&role=&sources=` from the entry.
- `src/boards/`: `model.ts`, `layout.ts`, `tour.ts` (pure, tested),
  `build.ts` (open / save / list / capture), `tour-controller.ts`;
  `src/desktop/tour-overlay.tsx`; Boards menu in `top-bar.tsx`; palette
  commands; Canvas API `boards.*`; `src/ide/project/sample-boards.ts`.
- `src/lineage/`: `model.ts` (graph, focus, boards), `open.ts` (draw,
  focus, hint), `src/desktop/kinds/lineage.tsx` (controls window), Focus
  button on page cards, Sources toggles in Preview and Page Builder, Canvas
  API `lineage.*`.
- `src/ide/project/saas.ts`: the Small Business SaaS template (schema,
  deterministic seed for five tenants, twenty pages, `boards/showcase.json`,
  README); `projects.open('saas')`, Open menu and palette entries.
- `src/desktop/window-shape.tsx`: viewport culling for `heavy` kinds with a
  placeholder body; `WindowKind.heavy`.
- Tests: `src/design/*.test.ts` updated, `src/boards/boards.test.ts`,
  `src/lineage/lineage.test.ts`, `src/ide/project/saas.test.ts`, API facade
  tests; `e2e/boards.spec.ts` (boards, tour, lineage, SaaS showcase with
  placeholders, tenant and role switches).
- Docs: README (Boards and tours, Data lineage, Sample projects),
  `docs/PLAN.md` (M6 done, decisions 38-43), `docs/CANVAS_API.md` (71
  methods), landing status panel.

### Verified in a real browser (Chromium, production build)

- Zero console errors on `/app` while opening the three sample boards,
  playing a tour, drawing the lineage board, focusing a page, opening the
  per-page lineage with the overlay, opening the SaaS project (about 30 ms)
  and its showcase board (17 windows, 11 arrows), zooming out to
  placeholders and back, switching tenant (colors and services change) and
  role (menu items appear). `/legacy` still renders.
- Screenshots and the tour video are in the session scratchpad
  (`v2shots/m6/`).

### Decisions and notes

- See PLAN decisions 38-43. The second sample is not seeded on first run.
- Not done: dragging kanban cards between stages (edit the stage in the
  Data window), arrow routing around windows on dense boards (labels can
  overlap where many arrows cross), WYSIWYG editing inside previews,
  binary assets (thumbnails are inline SVG data URIs).

## Review (M5)

### What changed

- `src/design/`: `tokens.ts` (defaults, tolerant parser, `--ds-*` CSS with
  a dark block, serializer), `components.ts` (typed props, slots, variants,
  parser), `render.ts` (self-contained `designCore` template renderer and
  the `paperos.design` preview runtime), `pages.ts` (page schema, parser,
  validation, HTML rendering of a 12-column grid), `page-ops.ts`,
  `base-css.ts`, `starter.ts` (14 components, default tokens, guidelines),
  `gallery.ts`, `project-design.ts`. The bundler injects token CSS, the
  design runtime and renders `pages/*.json` entries; the data runtime gained
  `data-count`; the bindings scanner reads page blocks.
- Window kinds `design`, `pages`, `card` (`src/desktop/kinds/`), plus
  `prop-editor.tsx` and `design-common.ts`; the Preview lists page entries
  and follows `#/route` links; "Design" workspace preset.
- Flowcharting: `src/desktop/sections.ts` (frames), `src/desktop/flow.ts`
  (bound arrows), the `↗` connect handle in the title bar, window-manager
  support for tiling inside the focused section and for windows in frames.
- `src/map/`: `model.ts` (graph from the project), `layout.ts` (layered
  placement that keeps given positions), `generate.ts` (frames, cards,
  arrows, "Map" workspace, regenerate).
- Canvas API namespaces `flow`, `sections`, `map`; `npm run api:gen` run;
  commands and snippets; sample project design files and pages;
  `e2e/design.spec.ts`; README, PLAN (M5 done, decisions 32-37).

### Verified in a real browser (Chromium 1440x900, production build)

- Zero console errors on `/app` while editing tokens (the preview's `h1`
  recolors), browsing the gallery, building a page at mobile / tablet /
  desktop width, generating and regenerating the map (32 cards, 6
  sections, 49 arrows on the sample), tiling inside a section and drawing
  an arrow with the connect handle. `/legacy` still renders.
- Screenshots and a webm of the map generation are in the session
  scratchpad (`v2shots/m5/`).

### Decisions and notes

- The design renderer follows the data runtime's pattern (self-contained
  source injected into the preview); pages are rendered from JSON on the
  fly, nothing is generated into the project (PLAN decisions 32-34).
- Sections and arrows are tldraw's own frames and arrows; no new shape
  type. tldraw's arrow tool binds to windows out of the box, so the connect
  handle only switches tools (decision 35). Tiling follows the focused
  section (decision 36).
- The map puts Design before Components so token arrows run left to right,
  and repeats pages as a row of small "UX flow" cards (decision 37).
- The M4 `pages/home.json` became a composed page; the Connections e2e
  expectation changed from "via side-menu" to the page's direct bindings.
- Not done: WYSIWYG editing inside the page preview (blocks are selected
  there, edited in the inspector), arrow routing around cards, a Growth /
  Ops model beyond listing files in those folders.

## Review (M4)

### What changed

- `src/data/`: `schema.ts` (types, tolerant parser, row parsing, display and
  image helpers), `validate.ts` (row validation, coercion, ids, referrers),
  `query.ts` (filter grammar, sort, paginate), `csv.ts`, `migrate.ts` (schema
  diff with renames, row migration, step descriptions), `store.ts`
  (`DataStore` over `DataFs`, `memoryDataFs`), `project-fs.ts` (browser
  `DataFs` over the Yjs documents, `getDataStore`, `scanProjectBindings`),
  `bindings.ts` (scanner + index), `runtime.ts` (`paperos.data` for the
  preview, injected as source), `erd.ts` (layered ERD layout).
- `src/ide/docs.ts` gained `writeLiveText` (used by the Canvas API host and
  the DataStore); `src/ide/preview/bundle.ts` injects the data runtime with
  the tables when `data/schema.json` exists; `src/ide/reveal.ts` +
  `EditorHandle.gotoLine` let Connections open a file at a line
  (`openFile(..., { line })`).
- Window kinds `data`, `schema`, `connections` (`src/desktop/kinds/`), shared
  helpers in `kinds/data-common.ts` (active DataStore hook, async value hook,
  open/reuse a window of a kind, download, file picker). CSS at the end of
  `desktop.css`, tokens only.
- Sample project rewritten around the data model (four tables, two
  components, one page, role switcher, side menu via the JS API, declarative
  mega menu with grouping, thumbnails and nested children). The old lines the
  M2 e2e tests rely on (`<h1>Hello, PaperOS</h1>`, `#count`, the console log)
  are unchanged.
- Canvas API: 10 `data.*` methods, `data.changed` event, docs and CLI schema
  regenerated (52 methods, 11 namespaces); "Data" default workspace
  (`ws_data`) built by `data-workspace.ts`, `preset-workspaces.ts` replaces
  the three IDE-specific checks; commands `layout.data` and
  `data.connections-for-file`; a "Query and change a table" snippet.
- Tests: `src/data/*.test.ts` (model, store, bindings, runtime, erd), bundle
  injection, API data namespace, workspace defaults; `e2e/data.spec.ts`
  (menus from data + live edit, role switch, Schema + Connections + open at
  line, Data workspace + `paperos.data`).

### Verified in a real browser (Chromium 1440x900)

- Fresh install: the sample renders the side menu (11 items as Admin, 7 as
  Viewer, 8 as Editor), the mega menu (4 categories, 5 thumbnails) and the
  role switcher; editing a `menu_items` label in the Data grid updates the
  preview and the open `menu_items.json` editor; the Schema form adds a column
  and the row file gains it; Connections opens `components/mega-menu.json`
  at its binding line. Zero console errors on `/`; `/legacy` unchanged.
- Screenshots and a webm of edit-to-preview are in the session scratchpad
  (`v2shots/m4/`).

### Decisions and notes

- PLAN decisions 25-30: data as files, `DataFs` seam, runtime injected as
  source, text-indexed bindings, schema edits as a plan, milestones
  renumbered (collaboration is M7).
- Switching from the IDE workspace to the Data one leaves the Editor and
  Console windows floating over the layout (the M1 rule: windows not in a
  workspace float). Close or tile them; a "hide other windows" option is a
  follow-up.
- The `id` column of a table cannot be edited in the grid when it is numeric
  (change it in the JSON file); other unique columns can.
- Deleting a referenced row asks once, then clears the references (nullify);
  cascade is available through the API only.
- `e2e/api.spec.ts` (M3) called its module-level `api()` helper inside
  `page.evaluate` callbacks, which run in the browser and threw
  `ReferenceError`; the callbacks now read `window.paperos` directly. All 19
  e2e tests pass against the production build.
- Playwright's `addInitScript` also runs in the sandboxed preview iframes,
  where `localStorage` throws; the new e2e helper wraps it in try/catch. The
  older `skipFirstRun` helper still logs that page error in the preview (it
  does not affect the tests).

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
