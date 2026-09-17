# PaperOS

PaperOS is a zoomable canvas that behaves like an OS desktop. Windows are the
one primitive: everything you open lives in a window you can move, resize and
arrange. A tiling engine arranges windows into layouts, the windows hold IDE
tools (file tree, editors, previews, consoles), and a Canvas API later makes
the whole desktop programmable.

**Status:** v2 preview, milestone M4 (data). The desktop renders, windows
tile into layouts and workspaces (M1), the windows hold an IDE (file tree,
CodeMirror editors, live preview, console, Markdown, command palette; M2),
the whole desktop is scriptable: a typed **Canvas API** (`window.paperos`), a
**Script** window, **plugins**, and a local **MCP bridge** so agents like
Claude can drive the canvas (M3), and a project now carries its **data
model**: tables and rows as JSON files, a **Data** grid, a **Schema** diagram
and a **Connections** view that shows how components and pages use each
table, with the preview rendering menus and lists straight from the data
(M4). Everything runs in the browser and survives a refresh; the bridge is a
small Node CLI on your machine. The rest of the roadmap is in
[`docs/PLAN.md`](docs/PLAN.md).

The 2025 prototype (a tldraw whiteboard with a code editor and a project
browser) still runs at `/legacy`.

## Routes

| Route     | What it is                                                              |
| --------- | ----------------------------------------------------------------------- |
| `/`       | Landing page: what PaperOS is, a link to the demo, status and the plan. |
| `/app`    | The PaperOS v2 desktop (the working demo).                              |
| `/legacy` | The 2025 prototype, frozen.                                             |

Hosted at <https://imagine-os.github.io/paperos/> (landing),
<https://imagine-os.github.io/paperos/app/> (desktop) and
<https://imagine-os.github.io/paperos/legacy/>. The landing page is a static
server component (`src/app/page.tsx`, `src/app/landing.css`); its visual
language is documented in [`docs/BRAND.md`](docs/BRAND.md).

## Run it

Requirements: Node 20 or newer, npm.

```bash
npm ci          # install exactly what package-lock.json says
npm run dev     # http://localhost:3000
```

No accounts, keys or paid services are needed. The canvas shows the tldraw
"made with tldraw" watermark, which is allowed under the tldraw free tier.

Other commands:

| Command             | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `npm run check`     | Typecheck, lint and unit tests. Run before every push.                    |
| `npm run build`     | Production build (what Vercel runs).                                      |
| `npm start`         | Serve the production build.                                               |
| `npm test`          | Unit tests (Vitest).                                                      |
| `npm run e2e`       | Browser tests (Playwright, needs Chromium).                               |
| `npm run format`    | Prettier.                                                                 |
| `npm run api:gen`   | Regenerate `docs/CANVAS_API.md` and the MCP CLI's schema copy (Node 22+). |
| `npm run mcp:build` | Install and build the MCP bridge CLI (`tools/paperos-mcp`).               |
| `npm run mcp`       | Run the MCP bridge CLI (agents normally start it themselves).             |

For `npm run e2e`, Playwright needs a Chromium. Either run
`npx playwright install chromium` once, or point
`PLAYWRIGHT_BROWSERS_PATH` at an existing install.

## Window manager

Windows float by default. The **Layout** menu (top bar) arranges every window
on the page inside the current viewport:

| Layout                       | What it does                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Free                         | No layout; windows float.                                                                                     |
| Columns                      | N equal columns. Collapses to one column when the viewport is narrower than 720 px.                           |
| Grid                         | Square-ish rows x columns.                                                                                    |
| Bento (1 + 2, 2 + 1, mosaic) | Asymmetric presets: one large + two small, two over one, four-cell mosaic. Extra windows share the last cell. |
| Split tree                   | i3-style binary tree you build yourself: tile a window left/right/top/bottom of another.                      |

Tiled windows have flush corners and no shadow, sit below floating windows,
and cannot be resized with the corner handles: drag the gap between two tiled
windows instead. Drag a tiled window's title bar to detach it (the others
reflow); drop a floating window on a tiled one to insert it left/right/top/
bottom, or on the center to swap places. Each window has a menu (the `...`
button, or long-press the title bar on touch) with Tile / Float, Tile
left/right/top/bottom, Rename, Focus mode, Duplicate and Close.

The layout region is the viewport as it was when the layout was applied; it
stays on the canvas while you pan and zoom, and is re-captured when the browser
window is resized. "Show layout" in the Layout menu zooms back to it.

### Keyboard shortcuts

Window-manager shortcuts use `Alt` so they do not clash with tldraw's own;
the IDE adds the usual `Ctrl+K` and `Ctrl+S`. They
are listed in tldraw's shortcuts dialog too (`?`). Two tldraw defaults moved
to make room: change page is `Alt+PageUp` / `Alt+PageDown` and tldraw's own
focus mode is `Alt+Shift+F`.

| Shortcut           | Action                                                  |
| ------------------ | ------------------------------------------------------- |
| `W`                | Window tool: click the canvas to open a window there.   |
| `Alt+N`            | New window at the viewport center.                      |
| `Alt+1` .. `Alt+5` | Layout: Free, Columns, Grid, Bento (1 + 2), Split tree. |
| `Alt+Arrow`        | Move focus to the tiled window in that direction.       |
| `Alt+Shift+Arrow`  | Swap the focused window with its neighbour.             |
| `Alt+Enter`        | Tile or float the focused window.                       |
| `Alt+F`            | Focus mode: zoom the camera to the focused window.      |
| `Ctrl+K`           | Command palette.                                        |
| `Ctrl+S`           | Save the file in the focused editor.                    |
| `Shift+Alt+F`      | Format the file in the focused editor (Prettier).       |

### Workspaces

A workspace is a saved arrangement: layout preset, layout tree, the windows in
it, the layout region and the camera. The **Workspaces** menu lists them and
lets you save the current arrangement, update, rename, duplicate or delete the
active one. Switching applies the layout and animates the camera to it. A fresh
install has four: "IDE" (Files, Editor, Preview and Console; built when first
selected), "Data" (Files, Data over Schema, Connections over Preview; built
when first selected), "Desk" (free) and "Grid" (tiles whatever is on the page
in a grid). Workspaces live in this browser's `localStorage` under
`paperos-v2:workspaces`; the live arrangement is kept under `paperos-v2:wm` so
a reload comes back tiled.

## IDE

The first visit opens the **IDE** workspace on the sample project: Files on
the left, an Editor in the center, Preview over Console on the right. The
same arrangement is in the Workspaces menu ("IDE") and the command palette
("Apply IDE workspace").

### Projects

A project is a virtual file tree. **Open** in the top bar (also in the Files
window and the palette) adds one:

| Source                 | Backend                                      | Writes back | Browsers                                                             |
| ---------------------- | -------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| Open folder...         | File System Access API directory handle      | Yes         | Chromium (Chrome, Edge, Brave...). The picker is disabled elsewhere. |
| Open sample project    | In-browser (IndexedDB)                       | Yes         | All                                                                  |
| Import ZIP...          | In-browser (IndexedDB), text files only      | Yes         | All                                                                  |
| Import GitHub repo URL | In-browser (IndexedDB), text files only      | Yes         | All, when `api.github.com` is reachable (see below)                  |
| Drop on the canvas     | In-browser (IndexedDB); folders, ZIPs, files | Yes         | All                                                                  |

In-browser projects live in the IndexedDB database `paperos-v2:projects`
(metadata plus files). Folder projects keep only the directory handle there;
after a reload the browser requires a click to grant access again, which the
Files window asks for. `node_modules`, `.git` and build output folders are
skipped. Binary files are not imported in M2 (files are strings); images
referenced by a page render only when they are SVG.

GitHub import downloads `https://api.github.com/repos/<owner>/<repo>/zipball`
from the browser, without a token. GitHub sends CORS headers, but the API
allows 60 requests per hour per IP and some networks block it; the error
message says so and the fallback is to download the ZIP from GitHub and use
Import ZIP. `owner/repo`, full URLs and `/tree/<branch>` are accepted.

### Documents

Every open file is a Yjs `Y.Doc` keyed by project id and path, persisted with
`y-indexeddb` (one database per file, `paperos-v2:doc:<project>:<path>`), so
unsaved edits survive a reload. The editor binds to it through
`y-codemirror.next`; Preview and Markdown windows read the same text. "Dirty"
means the buffer differs from what the backend holds; **Save** (`Ctrl+S`)
writes it back. To make files collaborative later, attach a sync provider in
`attachProvider()` in `src/ide/docs.ts`; nothing else changes.

### Windows

| Kind        | What it shows                                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files       | Tree of the active project: folders expand and collapse, a filter box, right-click menu (new file, new folder, rename, delete; open as Markdown), project switcher and Open menu. Clicking a file opens an editor next to Files.        |
| Editor      | CodeMirror 6: language by extension (lazy-loaded), line numbers, bracket matching, search (`Ctrl+F`), light and dark theme following the app. `Ctrl+S` saves, `Shift+Alt+F` or **Format** runs Prettier (JS/TS/CSS/HTML/JSON/Markdown). |
| Preview     | The project's entry (`index.html`, or pick another `.html` in the URL bar) in a sandboxed iframe, rebuilt from the live buffers 300 ms after the last edit. Stylesheets, `@import`, `url()` SVGs and scripts are inlined.               |
| Console     | `console.*` output and errors from the preview, with levels and Clear, plus a one-line input that evaluates JavaScript inside the preview.                                                                                              |
| Markdown    | A rendered `.md` file (`README.md` by default), sanitized with DOMPurify. **Edit** opens it in an editor.                                                                                                                               |
| Note        | Plain text, stored in the window.                                                                                                                                                                                                       |
| Data        | The project's tables (`data/schema.json` + `data/<table>.json`): table list with counts, sortable grid with inline editing, add/delete rows, filter, pagination, ref click-through, thumbnails, import/export. See Data.                |
| Schema      | Entity-relationship diagram of the tables (SVG, pan/zoom, click a table to open it in Data) and a form that adds tables and columns, changes types and refs, and migrates the rows on Apply.                                            |
| Connections | The binding index: pick a table to see the components, pages and files that read or write it (with `path:line` links that open the editor there), or a page/component to see its tables; unused tables and broken bindings.             |
| Script      | A JavaScript editor that runs against the Canvas API (`paperos`) with a captured `console`; output pane, Snippets menu, `Ctrl+Enter`. See Programmability.                                                                              |
| Plugins     | The plugin manager: built-in, project (`plugins/*.js`) and URL plugins, enable/disable, permissions note.                                                                                                                               |
| Agent       | Read-only transcript of the tool calls an agent makes over the MCP bridge, with a Pause switch.                                                                                                                                         |

One file per editor window: opening a file focuses its existing window, fills
an empty editor, or creates a new one. When a layout is active the new editor
stacks under the focused editor (the editor column grows downwards, Files
keeps its width); without a layout it cascades. The title shows the path and
a dot while unsaved.

### Command palette

`Ctrl+K` (or **Commands** in the top bar) opens a fuzzy-searchable list of
everything: layouts and window-manager actions, new windows per kind, files
of the active project (type a name to open it), workspaces, projects, Open
actions and the theme toggle. Commands live in a registry
(`src/ide/commands.ts`) that the Canvas API exposes as `paperos.commands` and
that scripts and plugins can add to.

### Theme

The desktop follows the system color scheme; the sun/moon button (or the
palette's "Toggle light / dark theme") forces one, stored under
`paperos-v2:theme`. The editor switches between a token-based light theme and
One Dark; the tldraw canvas follows too.

## Data

A project can carry its own data model as plain files, and the canvas shows
how everything connects to it:

- **`data/schema.json`** lists tables. Each has columns (`name`, `type`:
  `string`, `number`, `boolean`, `date`, `json`, `ref`, `image`; `required`,
  `unique`, `default`), a `primaryKey` (`id` by default) and an optional
  `display` column (what a row is called elsewhere). A `ref` column names the
  table it points at (`"ref": "roles"`); a table can refer to itself
  (`parent_id` for nested menus).
- **`data/<table>.json`** holds the rows as an array of objects.
- **Bindings** say who uses what. HTML lists declare
  `data-source="menu_items"` (the first child is the row template;
  `data-field="label"` fills text, `src` on images and `href` on links;
  `data-filter`, `data-order` and `data-group="category"` shape the list, and
  a nested `data-source` with `data-filter="parent_id={id}"` nests children).
  `components/*.json` and `pages/*.json` declare
  `bindings: [{table, fields, mode}]` (pages also list their `components`).
  Scripts call `paperos.data.<table>.list()` in the preview.

The **Data** window edits rows (double-click a cell; `ref` cells show the
display value of the referenced row and jump to it; image columns show a
thumbnail; JSON cells fold), validates against the schema (types, required,
unique, references) and writes the JSON file through the same shared document
the editor uses, so the preview re-renders and an open editor updates. The
**Schema** window draws the tables and their references and edits the model:
adding a column adds it to every row (with its default), removing one drops
it, renames keep the data, and every change is listed before it is applied.
**Connections** indexes every binding with its file and line: click one to
open the editor at that line; unused tables and bindings to missing tables or
columns are listed at the bottom. **Show connections for current file** in
the palette does the reverse for the focused editor.

In the preview, `paperos.data` is injected with the tables embedded:
`paperos.data.menu_items.list({ where: { parent_id: null }, orderBy: "sort" })`,
`.get(id)`, `.find(where)`, `.count()`, `.display(row)`; `paperos.data.hydrate(root, { visible })`
re-renders the `data-source` lists with a filter, and `paperos.data.icons`
maps icon names to inline SVG for `data-as="icon"`.

The sample project shows all of it: a `roles` table sets access levels, and
`menu_items` (nested by `parent_id`, grouped by `category`, with `icon`,
`thumbnail_url` and `required_role`) drives a side menu built in `app.js`
and a declarative mega menu in `index.html`. Pick a role in the page header
and restricted items disappear; edit a label in Data and both menus update.
The **Data** workspace arranges Files, Data, Schema, Connections and Preview.

The Canvas API exposes the same model as `paperos.data.tables()`, `schema()`,
`setSchema()`, `list()`, `get()`, `insert()`, `update()`, `delete()`,
`bindings()` and `open()`, and emits `data.changed`, so scripts, plugins and
agents over the MCP bridge can read and change project data.

## Programmability

Everything the desktop does is reachable from one typed object, the
**Canvas API**, documented method by method in
[`docs/CANVAS_API.md`](docs/CANVAS_API.md): `windows`, `layout`,
`workspaces`, `projects`, `files`, `data`, `preview`, `console`, `commands`,
`canvas` and `events`. Every method returns plain JSON and throws a readable error on
bad input. Three doors lead to it:

### Script window

**New window → Script** opens a JavaScript editor whose code runs as an
async function with `paperos` (the Canvas API) and a capturing `console` in
scope, so `await` works at the top level. **Run** (or `Ctrl+Enter`) shows
logs, the returned value and errors in the pane below; a returned image data
URL renders inline. The **Snippets** menu has starters: tile everything in a
grid, open every `.js` file, create a note per file, take a screenshot,
subscribe to events. The source is stored in the window, so it survives a
reload and can be saved in a workspace.

```js
const files = await paperos.files.list();
for (const f of files.filter((f) => f.path.endsWith(".js")))
  paperos.files.open(f.path);
paperos.layout.apply("grid");
```

The same object is `window.paperos` in the browser devtools once the desktop
has mounted. Scripts run inside the page with the page's privileges, exactly
like code pasted into the devtools: only run code you trust.

### Plugins

A plugin is an ES module exporting `activate(api)`; `api` is the Canvas API
plus `registerCommand`, `registerWindowKind` (React-free: draw into an
element with `render(el, ctx)` or return HTML from `html(ctx)`), `on` for
events and `log`. Everything a plugin registers is removed when it is
disabled. **New window → Plugins** lists them:

- **Built-in**: `clock` (a window kind showing the time) and `auto-tile`
  (new windows join the active layout).
- **From this project**: any `plugins/*.js` in the active project appears
  automatically. The sample project ships `plugins/hello.js` as a template.
- **From URL**: any URL serving an ES module.

Enabled plugins are remembered in the browser (`paperos-v2:plugins`). Plugins
run in the page with full access to it; the manager says so, and only what
you enable runs.

### Agent bridge (MCP)

`tools/paperos-mcp` is a small Node CLI that speaks
[MCP](https://modelcontextprotocol.io) over stdio to an agent and opens a
loopback WebSocket the PaperOS tab connects to. Each Canvas API method
becomes an MCP tool (`windows_create`, `layout_apply`, `files_write`,
`canvas_screenshot`...). Quick start:

```bash
npm run mcp:build                    # once: installs the CLI's deps and compiles it
# Claude Code:
claude mcp add paperos -- node "$PWD/tools/paperos-mcp/dist/index.js"
# Claude Desktop: add {"command":"node","args":["<repo>/tools/paperos-mcp/dist/index.js"]}
#                 under mcpServers in claude_desktop_config.json
```

Then open PaperOS and click **Agent bridge** in the top bar (or open the app
with `?bridge=1`): the dot is amber while the tab waits for the CLI and green
when connected. The **Agent** window shows every tool call as it arrives and
can pause them. No server is deployed and nothing leaves your machine. Details,
options and security notes: [`docs/MCP.md`](docs/MCP.md).

## Hosting

PaperOS is a static, local-first app; the only server code is the legacy
prototype's optional auth route.

- **GitHub Pages (static):** <https://imagine-os.github.io/paperos/>. The
  `pages` workflow (`.github/workflows/pages.yml`) runs on every push to
  `main`: `npm run build:static` exports the site to `out/` and
  `actions/deploy-pages` publishes it. `/`, `/app` and `/legacy` all work
  under the `/paperos/` base path. The static build is `next build` with
  `PAPEROS_STATIC=1` (see `next.config.ts`): `output: "export"`,
  `basePath`/`assetPrefix` from `PAPEROS_BASE_PATH` (default `/paperos`),
  trailing slashes, unoptimized images, and no API routes, so the legacy
  prototype's Liveblocks client cannot authenticate and stays disconnected
  (its normal no-key behavior). Hand-written URLs go through `withBasePath()`
  in `src/lib/env.ts`; `<Link>`, the router and imported assets get the base
  path from Next. Caveat: GitHub Pages for a **private** repository needs a
  paid GitHub plan; on a free plan the workflow's `configure-pages` step
  fails until the repository is public or the plan is upgraded.
- **Vercel (server build):** the normal `npm run build` / `next start`, with
  the `/api/liveblocks-auth` route included. Nothing about it changes when
  `PAPEROS_STATIC` is unset.

To try the static build locally, serve `out/` under the base path, e.g.
`mkdir -p /tmp/root && ln -s "$PWD/out" /tmp/root/paperos && npx http-server /tmp/root -p 3100`
and open <http://localhost:3100/paperos/>.

## Environment variables

All optional. Copy `.env.example` to `.env.local` if you want to set any.

| Variable                         | Used by   | Effect                                                         |
| -------------------------------- | --------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` | `/`       | tldraw SDK license key. Removes the watermark. No code change. |
| `LIVEBLOCKS_SECRET_KEY`          | `/legacy` | Lets the 2025 prototype's collaboration client connect.        |
| `PAPEROS_STATIC`                 | build     | `1` = static export for GitHub Pages (`npm run build:static`). |
| `PAPEROS_BASE_PATH`              | build     | Base path of the static export. Default `/paperos`.            |

## Routes

| Route     | What                                                          |
| --------- | ------------------------------------------------------------- |
| `/`       | PaperOS v2 desktop. Top bar, persistent canvas, Window shape. |
| `/legacy` | The 2025 prototype, frozen. Has a banner linking back to `/`. |

Both pages link to each other.

## Architecture

```
src/
  app/            Next.js App Router: routes, root layout, global tokens
    page.tsx      /        -> the v2 desktop
    legacy/       /legacy  -> the frozen prototype (own layout + providers)
    api/liveblocks-auth/   legacy-only auth route (optional key; not in the static export)
  desktop/        The v2 desktop
    desktop.tsx        tldraw canvas + top bar + toolbar overrides
    window-shape.tsx   the Window shape (title bar, menu, tiled/focused state,
                       drag detach + drop hooks, editable title, long-press)
    window-menu.tsx    per-window menu (tile/float, tile to a side, duplicate, close)
    wm-overlay.tsx     resize gutters and the drop-zone hint (screen space)
    wm-actions.ts      Alt-based keyboard shortcuts as tldraw actions
    top-bar.tsx        Layout and Workspaces menus, New window, About
    menu.tsx           small dropdown/menu primitives for the top bar
    window-tool.ts     toolbar tool: press "w", click to open a window
    window-kinds.tsx   registry of what a window can show (icon, size, component)
    kinds/             one file per kind: files, editor, preview, console,
                       markdown, data, schema, connections, script, plugins,
                       agent, note, about (+ file-picker, data-common helpers)
    create-window.ts   create a window with cascading placement
    cascade.ts         pure placement helper (unit tested)
    project-actions.ts Open folder / sample / ZIP / GitHub / dropped files
    ide-workspace.ts   the "IDE" arrangement, applied on first run
    data-workspace.ts  the "Data" arrangement; preset-workspaces.ts maps both
    ide-commands.ts    fills the command registry (WM, windows, files, ...)
    command-palette.tsx Ctrl+K palette over the registry
  api/            The Canvas API (M3)
    schema.ts          every method as data: names, params, returns (the
                       docs and the MCP tools are generated from it)
    canvas-api.ts      the typed facade (validation, plain JSON results)
    host.ts            what the facade needs from the app; browser-host.ts
                       implements it on tldraw + WM + stores; fake-host.ts for tests
    install.ts         builds the API, forwards events, sets window.paperos
    events.ts          event bus with a ring buffer (events.poll)
    invoke.ts          call a method by dotted name with object args (MCP)
    run-script.ts      runs Script-window code with paperos + console
    bridge-protocol.ts messages between the tab and the MCP CLI (shared)
    bridge-client.ts   the tab side of the bridge (status, transcript, pause)
  data/           The data model (M4, pure TypeScript apart from project-fs)
    schema.ts          data/schema.json types, tolerant parser, row helpers
    validate.ts        row validation, input coercion, ids, referrers
    query.ts           filter grammar, sorting, pagination (shared with the runtime)
    csv.ts, migrate.ts CSV in/out; schema diff + row migration
    store.ts           DataStore over a small DataFs (tables, rows, import/export,
                       setSchema with a plan, change detection); memoryDataFs
    project-fs.ts      the browser DataFs over the Yjs documents; getDataStore()
    bindings.ts        scanner: data-source attributes, components/pages JSON,
                       paperos.data calls -> index by table and by source
    runtime.ts         paperos.data for the preview (self-contained function the
                       bundler injects with the tables embedded)
    erd.ts             layered entity-relationship layout for the Schema window
  plugins/        Plugin system (M3)
    types.ts           PluginModule / PluginApi contract
    manager.ts         load, activate, disable, persist (paperos-v2:plugins)
    install.ts         wires the manager into commands, kinds, project scans
    plugin-window.tsx  React host for React-free plugin window kinds
    builtin/           clock, auto-tile
  ide/            The IDE (plain TypeScript apart from the hooks)
    project/           Project model: paths, tree, KV (IndexedDB) store,
                       memory + File System Access backends, sample, ZIP,
                       GitHub import, ProjectStore (paperos-v2:projects)
    docs.ts            one Y.Doc per file, y-indexeddb, dirty/save,
                       attachProvider() hook for a sync provider (M4)
    preview/bundle.ts  srcdoc bundler: inlines styles/scripts/SVG assets,
                       injects the console bridge and the data runtime (unit tested)
    editor/            CodeMirror factory (lazy) and the Prettier formatter
    commands.ts        command registry + fuzzy search (seed of M3's API)
    theme.ts           system / light / dark, data-theme on <html>
    console-store.ts, file-ref.ts, open-file.ts, signal.ts, palette-state.ts
  wm/             Window manager (pure TypeScript except window-manager.ts)
    types.ts           layout tree (leaf / split / grid), presets, workspace
    layout-engine.ts   layout(): rectangles for a tree in a region (gaps, padding, min sizes)
    presets.ts         columns, grid, bento templates, split tree
    operations.ts      insert, splitLeaf, swap, resizeRatio, remove, tile
    geometry.ts        drop zones, neighbour search, reading order
    window-manager.ts  applies trees to Window shapes via the tldraw editor
    workspace-store.ts localStorage-backed workspaces; wm-state.ts live arrangement
  lib/            Shared helpers: env, bundled tldraw assets
  legacy/         The 2025 prototype, moved verbatim (see src/legacy/README.md)
tools/paperos-mcp/ MCP server + WebSocket bridge CLI (own package, built with tsc)
scripts/gen-api.mts Generates docs/CANVAS_API.md and the CLI's schema copy
e2e/              Playwright: landing, smoke, window manager, IDE, API and data tests
docs/PLAN.md      Milestones and architecture decisions
docs/CANVAS_API.md Generated Canvas API reference; docs/MCP.md the bridge guide
tasks/todo.md     Working checklist and review notes
```

Design tokens live in `src/app/globals.css` as CSS variables (`--pos-*`),
with a dark set under `prefers-color-scheme: dark`. The landing page has its
own set (`--land-*` in `src/app/landing.css`), documented in `docs/BRAND.md`
as the reference for the design system. The tldraw canvas follows
the same system preference.

tldraw's icons, fonts and translations are bundled from `@tldraw/assets`
(see `src/lib/tldraw-assets.ts` and `next.config.ts`), so the app does not
load anything from `cdn.tldraw.com`.

## Upgrading later

- **Remove the tldraw watermark:** buy a tldraw license, set
  `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` in your environment (Vercel: Project
  Settings -> Environment Variables) and redeploy. `src/lib/env.ts` passes it
  to `<Tldraw licenseKey>`.
- **Real-time collaboration (M4):** the v2 canvas uses tldraw's local
  persistence (`persistenceKey="paperos-v2"`, IndexedDB). Swapping in a sync
  backend means replacing that one prop with a store from a sync provider
  (tldraw sync, Liveblocks, Yjs over WebSocket, ...) in
  `src/desktop/desktop.tsx`. Files are already Yjs documents: call
  `attachProvider()` in `src/ide/docs.ts` with a function that connects a
  provider to each `Y.Doc`. No other code depends on where the data lives.
- **tldraw version:** one `tldraw` version serves both `/app` and `/legacy`;
  bump `tldraw` and `@tldraw/assets` together in `package.json`.
