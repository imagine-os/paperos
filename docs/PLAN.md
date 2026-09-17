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

### M2 - IDE inside windows (done)

- Project model in `src/ide/project/` (pure TypeScript, unit tested):
  normalized paths, tree building and filtering, a `ProjectBackend`
  interface with two implementations (memory mirrored to IndexedDB, File
  System Access directory handle), ZIP import (JSZip, text files), GitHub
  public-repo import (zipball fetched client-side, friendly errors, ZIP as
  the fallback), a sample HTML/CSS/JS site with a README created on first
  run, and a `ProjectStore` (`paperos-v2:projects`) with the active project,
  sessions, permission re-request for folders and file mutations.
- One `Y.Doc` per file (`src/ide/docs.ts`), persisted with `y-indexeddb`,
  seeded from the backend, dirty tracking, save, reload,
  `attachProvider()` hook.
- Window kinds `files`, `editor` (CodeMirror 6 + y-codemirror.next,
  language-data, light/One Dark themes, Ctrl+S, Prettier standalone on
  demand), `preview` (srcdoc bundler, sandboxed iframe, 300 ms debounce,
  console bridge), `console` (levels, clear, snippet eval in the preview),
  `markdown` (marked + DOMPurify). Kinds carry an icon and a default size.
- Windows link to each other: Files opens editors next to itself (reusing a
  window for the same file), editors update the preview, the preview feeds
  the console, Markdown's Edit opens an editor.
- Top bar: Open menu, New window menu, Commands, theme toggle. "IDE"
  default workspace built on first run. Folders/ZIPs/files dropped on the
  canvas become a project.
- Command palette (`Ctrl+K`) over a command registry (`src/ide/commands.ts`)
  with static commands and dynamic sources (files, workspaces, projects).
- Tests: 117 unit tests (project model, paths, tree, imports, documents,
  bundler, commands, formatter) and `e2e/ide.spec.ts` (first run, open
  file, edit-to-preview + save + reload, console, palette, markdown +
  context menu).
- Not done, deferred: binary files in projects (images other than SVG),
  tabs inside one editor window, Sandpack (see decision 13), a real
  awareness/cursor layer (M4).

### M3 - Programmable (done)

- Canvas API in `src/api/`: a schema (`schema.ts`, 42 methods in 10
  namespaces: windows, layout, workspaces, projects, files, preview,
  console, commands, canvas, events) and a typed facade
  (`createCanvasApi(host, events)`) over a `CanvasHost` interface. The
  browser host sits on tldraw, the window manager and the IDE stores; a
  fake host drives the unit tests. Results are plain JSON, bad input throws
  readable errors, `files.write` goes through the Yjs document so editors
  update, `canvas.screenshot` uses tldraw's export (windows draw as titled
  frames; note and script text is rendered). Events: window
  created/closed/focused, layout changed, file changed, command run,
  project changed, with a 200-entry ring buffer for pollers.
  `window.paperos` for the devtools. `docs/CANVAS_API.md` is generated
  from the schema by `npm run api:gen`; a test fails when it is stale.
- Script window kind: CodeMirror JS editor (plain buffer), code runs as an
  async function with `paperos` and a capturing `console`, output pane
  (images inline), Snippets menu, `Ctrl+Enter`, source in the window's
  `content` prop.
- Plugins (`src/plugins/`): ES modules exporting `activate(api)` that
  register commands, React-free window kinds and event handlers; built-in
  (`clock`, `auto-tile`), project (`plugins/*.js`, loaded through a blob
  URL) and URL sources; enabled set in `paperos-v2:plugins`; Plugins
  window kind. The sample project ships `plugins/hello.js`.
- Agent bridge: `tools/paperos-mcp` (own package, `@modelcontextprotocol/sdk`
  - `ws`, built with tsc) runs an MCP server over stdio whose tools are
    generated from the schema and a loopback WebSocket bridge on 7331; the
    tab connects when "Agent bridge" is toggled in the top bar or with
    `?bridge=1` (status dot: off / listening / connected). Agent window kind
    shows the transcript and can pause calls. `docs/MCP.md` has the Claude
    Desktop and Claude Code snippets; `scripts/demo.mjs` drives the canvas end
    to end with the SDK's client.
- Fix from the M2 review: new editors stack under the focused editor
  (`placeFileWindow`) instead of squeezing the Files row.
- Tests: 162 unit tests (API facade, schema/tool generation, script runner,
  event bus, bridge protocol and client, plugin manager, editor placement)
  and `e2e/api.spec.ts` (script snippet creates and tiles windows, clock
  plugin, `window.paperos`).
- Not done, deferred: the tab always dials the default port (the CLI's
  `--port` needs a matching setting in the tab), one tab per bridge,
  `commands.run` arguments are only used by script/plugin commands, no
  sandbox for scripts and plugins (documented as running with page
  privileges), bodies of non-text windows are not part of screenshots.

### M4 - Data (done)

- Data model as project files (`src/data/`, pure TypeScript, unit tested):
  `data/schema.json` (tables, columns typed string / number / boolean / date /
  json / ref / image with required, unique, default, ref target; primary key
  and display column) and `data/<table>.json` (rows). Tolerant parser that
  repairs what it can and reports the rest; row validation (types, required,
  unique, references), input coercion, a filter grammar (`col=value`,
  `col>3`, `col:part`, free text) with sorting and pagination, CSV/JSON
  import-export, schema diff with renames and row migration.
- `DataStore` over a small `DataFs`: tables with counts, query, insert /
  update / delete with referential checks (block, nullify, cascade),
  import/export, `setSchema` with a described plan, change detection that
  compares file text and bumps a `changed` signal. In the browser the fs is
  the live Yjs documents (`project-fs.ts`, `writeLiveText`), so the Data
  window, editors and the preview share one source of truth.
- Bindings: a scanner indexes `data-source` / `data-field` attributes in HTML,
  `bindings` in `components/*.json` and `pages/*.json` (pages also list
  `components`), and `paperos.data.<table>.<method>()` calls in scripts, each
  with file and line; by table, by source, unused tables, broken bindings.
- Preview runtime: `paperos.data` (list / get / find / count / display per
  table, `hydrate()` with a visibility hook, `icons`, `setContext`) and a
  declarative renderer for `data-source` lists (first child = row template,
  `data-field` fills text / `src` / `href` / `data-attr`, `data-as="icon|html"`,
  `data-display` for ref display values, `data-filter` with `{col}` and
  `@context` placeholders, `data-order`, `data-group`, nested lists,
  `data-empty`). The bundler injects it with the tables embedded whenever the
  project has a schema.
- Window kinds `data` (table list with counts, sortable grid, inline editing
  by type, ref click-through, thumbnails, folding JSON, add / delete rows with
  reference handling, filter, pagination, import / export, open the JSON
  file, show connections), `schema` (SVG entity-relationship diagram with
  layered layout, pan / zoom, click-through to Data; form to add tables and
  columns, rename, change type / ref / constraints; Apply shows the migration
  plan and rewrites the row files), `connections` (two-column graph, tables
  and sources lists, per-binding `path:line` links that open the editor at
  the line, unused tables and broken bindings). Editors gained "reveal line".
- Sample project: `roles`, `users`, `menu_items` (nested, categorized, icons,
  SVG data-URI thumbnails, `required_role`) and `pages`; `components/
side-menu.json`, `components/mega-menu.json`, `pages/home.json`; the page
  has a role switcher, a side menu built with the JS API and a declarative
  mega menu grouped by category with thumbnails and nested children.
- Canvas API `data` namespace (tables, schema, setSchema, list, get, insert,
  update, delete, bindings, open), `data.changed` event, MCP tools generated
  from it; commands "Apply Data workspace" and "Show connections for current
  file"; "Data" workspace preset; a data snippet in the Script window.
- Tests: 198 unit tests (model, store, bindings, runtime with a fake DOM,
  bundler injection, ERD layout, API facade) and `e2e/data.spec.ts`.
- Not done, deferred: binary images in projects (thumbnails are URLs or data
  URIs), a query language beyond the filter grammar (joins are done in JS),
  live collaboration on data (it rides on the Yjs documents, so a provider in
  `attachProvider()` will cover it), a visual page builder for
  `pages/*.json` (M5).

### M5 - Design system, pages and flowcharting (done)

- Design system as project files (`src/design/`, pure TypeScript apart from
  `project-design.ts`): `design/tokens.json` (semantic colors with light and
  dark values, typography, spacing, radius, shadow and breakpoint scales;
  defaults, tolerant parser, `--ds-*` CSS with a dark block),
  `design/components/*.json` (typed props incl. the data-aware `table` /
  `field` / `fields`, slots, variants, an HTML template with `{prop}`,
  `{@raw}`, `{#each}`, `{#if}...{:else}`, `{{literal}}`), a starter library
  of 14 components (Button, Card, Table, Form, Nav, MegaMenu, Hero, Stat,
  List, Grid, Tabs, Modal, Badge, Avatar) styled against the tokens, and
  `design/README.md`. The renderer is a self-contained function (like the
  data runtime) that the bundler runs to render pages and injects into the
  preview as `paperos.design` (hydrates `<ds-component>` / `data-component`,
  tabs and modal behavior, `#/route` navigation).
- Pages (`pages/*.json`): 12-column grid of component blocks with props,
  a table binding (feeds `table` / `fields`), children, links to other pages
  and a device hint; validation against the library and the page list;
  rendered to a document by the bundler when the preview entry is
  `pages/<name>.json`. The bindings scanner reads block bindings and
  component names, so Connections and the map see pages' tables. The data
  runtime gained `data-count`.
- Window kinds `design` (Tokens editor with live gallery and light/dark
  toggle, Components gallery with inspector and "Insert into page",
  Guidelines), `pages` (page list, block tree with drag/reorder/nesting and
  spans, inspector with typed props and a schema-driven binding editor, page
  settings and links, device preview 390 / 820 / 1280 with click-to-select)
  and `card` (map node). The Preview lists page entries and follows page
  links. "Design" workspace preset.
- Flowcharting: tldraw arrows bind to Window shapes natively (verified); a
  `↗` connect handle in the title bar switches to the arrow tool so a drag
  from it draws a bound arrow. Sections are tldraw frames
  (`src/desktop/sections.ts`): "Group selected windows into a section",
  "Section from workspace"; the window manager tiles inside the focused
  window's section (region = section bounds) and converts coordinates for
  windows in frames. `src/desktop/flow.ts` creates and lists bound arrows.
- Project map (`src/map/`): `buildProjectMap` turns tables, code files (by
  folder, collapsed above 30), tokens, components (design library + M4
  declarations), pages and page links into sections, nodes and edges
  (bindings, usage, links, tokens); `layoutMap` places sections left to
  right with a column grid per section, no overlaps, honoring kept
  positions; `generateMap` draws frames, Card windows and arrows, zooms to
  it and saves the "Map" workspace. Regenerate keeps moved cards, drops gone
  subjects and redraws arrows.
- Canvas API: `flow.connect / disconnect / list`, `sections.create / list`,
  `map.generate / regenerate` (schema, host, browser host, fake host, facade
  tests), `WindowInfo.section`, `windows.create` knows the new kinds; docs
  and the CLI schema regenerated. Commands "Generate project map",
  "Regenerate project map", "Group selected windows into a section",
  "Section from workspace", "Apply Design workspace"; Script snippets for
  the map and for connecting windows.
- Sample project: `design/tokens.json`, `design/components/*.json`,
  `design/README.md`, pages `home`, `products`, `admin` bound to the M4
  tables with links between them; `styles.css` reads `--ds-color-primary`.
- Tests: 238 unit tests (tokens, template language and renderer, component
  files, pages and block operations, bundler injection, bindings for page
  blocks, map model and layout, flow/sections/map facade) and
  `e2e/design.spec.ts` (token recolors the preview and the gallery, Page
  Builder adds a block and the device preview shows it, `map.generate` from
  the Script window, an arrow drawn between two windows with the handle).
- Not done, deferred: a full WYSIWYG page editor (the builder is a block
  list with a live preview), component templates beyond the small template
  language (no expressions), arrow routing that avoids cards (tldraw arcs
  cross other cards in dense maps), map sections for Growth / Ops beyond
  listing the files, undo of `map.generate` as one step (it is several
  history marks).

### M6 - Design system, boards and tours, Small Business SaaS (done)

- Design system ported from `docs/BRAND.md`: paper/ink tokens, the accent
  gradient, type and spacing scales, motion; premium base CSS; 35
  components (Pricing, Testimonial, FAQ, Footer, Sidebar, Topbar, TabBar,
  KpiGrid, Timeline, Calendar, Kanban, Thread, Chart, EmptyState, ...);
  theme presets Paper / Ink / Studio / Bold; dark mode; a preview context
  (tenant, role) with `@key` filters, tenant brand colors and role gates.
- Boards (`boards/*.json`, `src/boards/`): sections left to right, grids of
  windows, arrows, tours with captions and keys; Boards menu; Canvas API
  `boards.*`; three curated boards in the sample.
- Data lineage (`src/lineage/`): Tables → Components → Pages as a board of
  cards with labeled arrows, per-page focus, "Data lineage for <page>" next
  to the real Page Builder, the "Data sources" overlay in previews; Canvas
  API `lineage.*`.
- "Small Business SaaS" template (`src/ide/project/saas.ts`): fifteen
  tables seeded for five tenants, twenty pages in four apps, the showcase
  board; viewport culling for heavy windows.

### M7 - Collaboration

- Multiplayer canvas (tldraw sync or Liveblocks; decide then).
- Presence: cursors, who is in which window.
- Shared Yjs documents for files: attach a provider via
  `attachProvider()` in `src/ide/docs.ts`; pass its awareness to
  `yCollab` for remote cursors.

### M8 - Polish and plugins

- GenMoji plugin (see the original "3D GenMoji Generator" issue), now as a
  PaperOS plugin (`activate(api)`).
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
4. **No vendor until collaboration (M7).** Collaboration providers are a swap of the store in
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

11. **Projects are a backend interface, files are strings.** `ProjectBackend`
    (list/read/write/mkdir/rename/remove) has a memory implementation
    mirrored to IndexedDB and a File System Access one; ZIP, GitHub, the
    sample and dropped folders all feed the memory backend. M2 keeps file
    content as text; binaries are skipped on import and can be added as a
    typed entry later without changing the interface.
12. **Per-file Yjs documents persist locally, providers attach later.** Each
    file's `Y.Doc` is keyed `paperos-v2:doc:<project>:<path>` and saved by
    `y-indexeddb`, so the buffer (including unsaved edits) survives reloads.
    "Saved" compares the buffer with the backend content. A single hook,
    `attachProvider(doc, key)`, is where M7 plugs a sync provider in.
13. **Own srcdoc bundler instead of Sandpack.** Sandpack needs its bundler
    served from a CDN or self-hosted; PaperOS must run offline with no
    vendor. `bundle()` inlines stylesheets, `@import`, `url()` SVG assets and
    scripts into one `srcdoc`, runs it in a sandboxed iframe (no
    same-origin), and a console bridge forwards `console.*`, errors and
    snippet results over `postMessage`. It reads the live editor buffers, so
    the preview reflects unsaved edits (300 ms debounce). Module graphs and
    npm dependencies are out of scope until a bundler is needed.
14. **The window `content` prop carries a file reference.** Editor and
    Markdown windows store `{"project","path"}` as JSON in `content`; a
    Preview stores an entry-path override. No new shape props or types were
    needed, and windows can be duplicated, saved in workspaces and reopened
    after a reload with the same file.
15. **Commands are a registry.** `src/ide/commands.ts` holds static commands
    and dynamic sources (files, workspaces, projects) with fuzzy search. The
    palette is one client; M3's Canvas API and MCP server are the next ones.
16. **Theme is `data-theme` on `<html>`.** Tokens default to the system
    preference and are forced by `data-theme="light|dark"`; tldraw's color
    scheme and the CodeMirror theme follow the same signal.
17. **Reload right after a change can lose it.** tldraw's local persistence
    is throttled; e2e tests wait ~800 ms before reloading. The IDE's own
    stores (projects, documents) write immediately.
18. **The API surface is data first.** `src/api/schema.ts` describes every
    method once (name, description, params as a JSON Schema subset,
    returns). The facade implements it, the docs are generated from it,
    `invokeTool()` maps object-style calls onto positional JS parameters
    with it, and the MCP CLI turns it into tools. Adding a method means one
    schema entry, one facade method and `npm run api:gen`; a unit test
    checks the facade covers the schema and that the generated files are
    current.
19. **Facade over a host interface, not over tldraw.** `createCanvasApi`
    talks to a small `CanvasHost` (plain records, no atoms or tldraw types)
    so the validation and result shaping can be unit tested against a fake
    in Node. `browser-host.ts` is the only file that knows both worlds.
20. **Scripts and plugins run with page privileges.** No sandbox: a script
    is `new AsyncFunction(...)` in the page, a plugin is a dynamic
    `import()` (a blob URL for project files). This is the devtools model
    and is stated in the Script window, the Plugins window and the docs.
    Sandboxing (a worker with a message-passing API proxy) is possible
    later because everything already goes through the Canvas API.
21. **Plugin window kinds are React-free.** Plugins get an element to draw
    into (`render(el, ctx)`) or return HTML (`html(ctx)`); a single React
    host component wraps them. Plugins therefore need no build step and no
    React import.
22. **The MCP bridge is a local CLI, not a server.** Canvas state lives in
    the tab, so the CLI (stdio MCP server + WebSocket on 127.0.0.1:7331)
    forwards each tool call to the connected tab and returns its answer.
    Nothing is deployed, no vendor is involved, and the Vercel build is
    untouched. The CLI is its own package under `tools/` with two runtime
    dependencies; the shared schema and protocol are copied verbatim by
    `npm run api:gen` and a test fails when the copies drift. Loopback only,
    one tab at a time, 30 s call timeout, clear error when no tab is
    connected.
23. **Editors stack in the editor column.** `placeFileWindow` inserts a new
    file window below the focused (else last) tiled editor; the Files column
    keeps its width however many files are opened. `WindowManager.setTree`
    replaces the tree without re-capturing the region.
24. **GitHub Pages hosts a static export; Vercel keeps the server build.**
    `PAPEROS_STATIC=1 next build` (`npm run build:static`) turns on
    `output: "export"` with `basePath`/`assetPrefix` `/paperos`, trailing
    slashes and unoptimized images, entirely inside `next.config.ts`, so the
    normal build is untouched. The one route handler (legacy Liveblocks auth,
    a POST) cannot be exported; in static mode `pageExtensions` omits `ts`,
    which leaves `route.ts` out without moving files (all pages and layouts
    are `.tsx`). The legacy page still renders; its client fails to auth and
    stays offline as it does without a key. `withBasePath()` (`src/lib/env.ts`)
    is for hand-written URLs; `<Link>` and imported assets already get the
    prefix. `.github/workflows/pages.yml` deploys on push to `main`.
25. **Data is files.** Tables live in `data/schema.json` and
    `data/<table>.json`, nothing else: they travel with the project (ZIP,
    GitHub, folder), diff in git, and need no database or service. The
    DataStore reads and writes them through the same Yjs documents as the
    editor (`writeLiveText`), so the grid, an open editor and the preview
    never disagree, and change detection is "the file text differs", which
    also catches edits made in an editor or by an agent.
26. **The DataStore talks to a `DataFs`, not to the project store.** Five
    methods (list, read, write, rename, remove) plus a change callback are
    enough; `project-fs.ts` binds them to the live documents in the browser,
    a Map implementation serves tests and the fake Canvas API host. Same
    pattern as `CanvasHost` (decision 19).
27. **One runtime, injected as source.** `paperos.data` for the preview is a
    self-contained function in `src/data/runtime.ts` whose `toString()` is
    put into the srcdoc with the tables embedded as JSON. It is unit tested
    in Node against a tiny fake DOM and runs unchanged in the sandbox; a test
    checks its filter grammar agrees with `query.ts`. The same convention
    (`data-source`, `data-field`) is what the bindings scanner indexes, so
    what the Connections window shows is what the page renders.
28. **Bindings are a convention, indexed by text.** `data-source` attributes,
    `bindings` arrays in `components/*.json` / `pages/*.json` and
    `paperos.data.<table>` calls are found with regular expressions and
    `JSON.parse`, with file and line. No build step, no AST: good enough to
    answer "who uses this table" and to flag missing tables and columns, and
    cheap enough to rescan on every edit (debounced).
29. **Schema edits are a plan.** `diffSchema(before, after, renames)` yields
    steps (add / drop / rename table or column, change type) that are shown
    before applying; `setSchema` then rewrites the row files (defaults for
    new columns, dropped columns removed, values converted). Renames are
    explicit (the form tracks original names) because a rename and a
    drop-plus-add are indistinguishable from the schema alone.
30. **Milestones renumbered.** The owner's direction put data ahead of
    collaboration: M4 is Data, M5 the page builder, M6 the full-stack sample,
    M7 collaboration (unchanged in content), M8 polish.

31. **The root is a sales page; the desktop lives at `/app`.** `/` is a
    static server component (`src/app/page.tsx`, `src/app/landing.css`, an
    inline SVG scene in `src/app/landing-visual.tsx`): no tldraw, no client
    JavaScript beyond Next's runtime, no external fonts or images, so it is
    fast and safe to index. The desktop moved to `src/app/app/page.tsx`
    unchanged; `/legacy` stays. Every internal link is a `<Link>` so the
    Pages base path applies. The landing's tokens (`--land-*`) are the
    reference visual language, written up in `docs/BRAND.md` for the design
    system to adopt (M5).
32. **The design system is files plus one self-contained renderer.**
    Tokens, components and pages are JSON in the project (they travel with
    it and diff in git, like the data model); the renderer (`designCore`)
    has no imports so its source is injected into the preview with
    `toString()`, the same way as the data runtime (decision 27). The
    bundler renders pages with it in the app and the preview hydrates
    `<ds-component>` elements with the same code, so a component looks the
    same everywhere.
33. **A small template language, not a framework.** `{prop}`, `{@raw}`,
    `{#each}`, `{#if}/{:else}` and `{{literal}}` are enough for the starter
    library and keep templates readable JSON strings. Data binding inside
    templates reuses the M4 `data-source` / `data-field` convention (with
    `{{id}}` for the runtime's own placeholders), so the bindings scanner,
    the runtime and the map all agree without a second mechanism.
34. **Pages render from JSON, no generated HTML.** The preview entry
    `pages/<name>.json` is rendered by the bundler on the fly; nothing is
    written back to the project. Links use `href="#/route"` and the runtime
    posts a `navigate` message the Preview window turns into an entry
    change. Pages therefore never drift from their components or tokens.
35. **Sections are tldraw frames, arrows are tldraw arrows.** No new shape
    types (decision 6): windows stay the one primitive; frames group them
    and move them, arrows bind to them natively (`canBind` is tldraw's
    default). The map is built only from those three: frames with a
    `paperosMap` meta, Card windows keyed by `key` in `content`, arrows with
    a `paperosMap` edge key, which is what lets regeneration reuse and
    prune them.
36. **The layout region follows the focused section.** When the focused
    window sits in a frame, layouts apply inside that frame's bounds (minus
    padding and the title band) and only to that frame's windows; otherwise
    the viewport rule (decision 7) holds and windows inside sections are
    left alone. Shapes in frames carry parent-relative coordinates, so the
    window manager and the Canvas API read page bounds and convert with
    `getPointInParentSpace` when writing.
37. **Map order: Data, Code, Design, Components, Pages, UX flows.** Design
    (tokens) sits left of Components so the tokens → components arrows run
    left to right like the rest; UX flows repeat the pages as a separate
    row of small cards so page-to-page links read as a flow instead of
    tangling with the binding arrows in the Pages column.

38. **Boards are project files of sections, not canvas snapshots.** A board
    names windows by kind and content and lets the pure layout place them
    (no overlaps by construction), so it survives edits, diffs well and can
    be written by an agent. Saving the canvas as a board captures positions
    into a `free` section for the cases where hand placement matters.
39. **Tours are a camera path over sections.** No slides, no separate
    presentation model: a step names a section and a caption; the tour
    zooms to the section's frame and highlights its arrows. Boards without
    steps get one step per section.
40. **Lineage reuses the map machinery.** Tables, components and pages are
    Card windows in frames with bound arrows (no new shape type); focus is
    shape opacity; the per-page variant places the real Page Builder and
    Preview windows so the lineage is live, not a drawing of it.
41. **The Data sources overlay lives in the preview runtime.** The badges
    are derived from the rendered DOM (`data-source`, `data-count`,
    `data-table`, forms), so they are right for any page or hand-written
    HTML, and they post `hover-table` to the host, which hints the table's
    card.
42. **One data model, apps as page sets.** The SaaS template does not add
    an "app" concept: an app is a folder of pages (`pages/apps/customer/*`)
    sharing a shell block, and tenancy is a filter (`tenant_id=@tenant`) plus
    the tenant row's brand colors. Roles gate menu rows and blocks through
    the existing `required_role` / RoleGate mechanics.
43. **Viewport culling by kind, with hysteresis.** Kinds flag themselves
    `heavy`; a heavy window shows a placeholder beyond 3/4 of a viewport off
    screen or below 10% zoom and renders again within 1/4 viewport and above
    14%, so panning and zooming do not flicker. The second sample is not
    seeded on first run: it is one click (or `projects.open('saas')`) away
    and keeps first-run tests and timings unchanged.

## Notes

- The annotated tag `v0-prototype` (at `aa5f51d`) could not be pushed from
  the automated session: the repository credential only allows branch
  updates. The `legacy` branch points at the same commit. To add the tag:
  `git tag -a v0-prototype aa5f51d -m "2025 prototype before the v2 rebuild" && git push origin v0-prototype`.
- Next.js 16 is available; this scaffold pins Next 15 (as decided). Upgrading
  is a follow-up once the Window shape work settles.
