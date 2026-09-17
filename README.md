# PaperOS

PaperOS is a zoomable canvas that behaves like an OS desktop. Windows are the
one primitive: everything you open lives in a window you can move, resize and
arrange. A tiling engine arranges windows into layouts, the windows hold IDE
tools (file tree, editors, previews, consoles), and a Canvas API later makes
the whole desktop programmable.

**Status:** v2 preview, milestone M5 (design system, pages, flowcharting).
The desktop renders, windows tile into layouts and workspaces (M1), the
windows hold an IDE (file tree, CodeMirror editors, live preview, console,
Markdown, command palette; M2), the whole desktop is scriptable: a typed
**Canvas API** (`window.paperos`), a **Script** window, **plugins**, and a
local **MCP bridge** so agents like Claude can drive the canvas (M3), a
project carries its **data model**: tables and rows as JSON files, a
**Data** grid, a **Schema** diagram and a **Connections** view (M4), and now
a **design system** (tokens and a component library as files, edited in the
**Design** window), **pages** composed from those components in the **Page
Builder** with a per-device preview, and **flowcharting**: arrows between
windows, titled sections, and a generated **project map** that lays the
whole project out as one flowchart of cards (M5). Everything runs in the
browser and survives a refresh; the bridge is a small Node CLI on your
machine. The rest of the roadmap is in [`docs/PLAN.md`](docs/PLAN.md).

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
install has five: "IDE" (Files, Editor, Preview and Console; built when first
selected), "Data" (Files, Data over Schema, Connections over Preview; built
when first selected), "Design" (Design system, Page Builder over the Preview
of `pages/home.json`; built when first selected), "Desk" (free) and "Grid"
(tiles whatever is on the page in a grid); generating the project map adds
"Map". Workspaces live in this browser's `localStorage` under
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

| Source                           | Backend                                      | Writes back | Browsers                                                             |
| -------------------------------- | -------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| Open folder...                   | File System Access API directory handle      | Yes         | Chromium (Chrome, Edge, Brave...). The picker is disabled elsewhere. |
| Open sample project              | In-browser (IndexedDB)                       | Yes         | All                                                                  |
| Open sample: Small Business SaaS | In-browser (IndexedDB)                       | Yes         | All (see Sample projects below)                                      |
| Import ZIP...                    | In-browser (IndexedDB), text files only      | Yes         | All                                                                  |
| Import GitHub repo URL           | In-browser (IndexedDB), text files only      | Yes         | All, when `api.github.com` is reachable (see below)                  |
| Drop on the canvas               | In-browser (IndexedDB); folders, ZIPs, files | Yes         | All                                                                  |

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

| Kind         | What it shows                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files        | Tree of the active project: folders expand and collapse, a filter box, right-click menu (new file, new folder, rename, delete; open as Markdown), project switcher and Open menu. Clicking a file opens an editor next to Files.                                                                                                                                                                     |
| Editor       | CodeMirror 6: language by extension (lazy-loaded), line numbers, bracket matching, search (`Ctrl+F`), light and dark theme following the app. `Ctrl+S` saves, `Shift+Alt+F` or **Format** runs Prettier (JS/TS/CSS/HTML/JSON/Markdown).                                                                                                                                                              |
| Preview      | The project's entry (`index.html`, or pick another `.html` in the URL bar) in a sandboxed iframe, rebuilt from the live buffers 300 ms after the last edit. Stylesheets, `@import`, `url()` SVGs and scripts are inlined.                                                                                                                                                                            |
| Console      | `console.*` output and errors from the preview, with levels and Clear, plus a one-line input that evaluates JavaScript inside the preview.                                                                                                                                                                                                                                                           |
| Markdown     | A rendered `.md` file (`README.md` by default), sanitized with DOMPurify. **Edit** opens it in an editor.                                                                                                                                                                                                                                                                                            |
| Note         | Plain text, stored in the window.                                                                                                                                                                                                                                                                                                                                                                    |
| Data         | The project's tables (`data/schema.json` + `data/<table>.json`): table list with counts, sortable grid with inline editing, add/delete rows, filter, pagination, ref click-through, thumbnails, import/export. See Data.                                                                                                                                                                             |
| Schema       | Entity-relationship diagram of the tables (SVG, pan/zoom, click a table to open it in Data) and a form that adds tables and columns, changes types and refs, and migrates the rows on Apply.                                                                                                                                                                                                         |
| Connections  | The binding index: pick a table to see the components, pages and files that read or write it (with `path:line` links that open the editor there), or a page/component to see its tables; unused tables and broken bindings.                                                                                                                                                                          |
| Design       | The design system: **Tokens** (colors with light/dark values, type scale, spacing, radius, shadows, breakpoints; editable, live preview, writes `design/tokens.json`), **Components** (gallery of every component and variant, inspector, "Insert into page") and **Guidelines** (`design/README.md`). See Design system.                                                                            |
| Page Builder | Pages composed from components: page list, block tree (drag to reorder or nest, spans on a 12-column grid, add from the library), inspector (typed props, table and field binding from the schema, variant), page settings and links, device preview at 390 / 820 / 1280. Writes `pages/*.json`. See Pages.                                                                                          |
| Card         | A light node for the project map: title, subtitle, a few facts and an Open button that opens the real thing (a table in Data, a file in an editor, a component in Design, a page in the Page Builder). Created by `map.generate`.                                                                                                                                                                    |
| Script       | A JavaScript editor that runs against the Canvas API (`paperos`) with a captured `console`; output pane, Snippets menu, `Ctrl+Enter`. See Programmability.                                                                                                                                                                                                                                           |
| Plugins      | The plugin manager: built-in, project (`plugins/*.js`) and URL plugins, enable/disable, permissions note.                                                                                                                                                                                                                                                                                            |
| Agent        | Read-only transcript of the tool calls an agent makes over the MCP bridge, with a Pause switch.                                                                                                                                                                                                                                                                                                      |
| Terminal     | A terminal with two backends: the **project shell** (in the tab: `ls`, `cd`, `cat`, `grep`, `find`, `tree`, pipes, `>`/`>>`, plus `open <file>`, `preview <page>`, `data <table>`, `board <name>`, `layout <preset>`, `api <expression>` and a `js` REPL; Tab completes) and the **bridge shell** (a real shell on your machine through the agent bridge, opt-in with a confirmation). See Terminal. |
| Browser      | A web browser: tabs, address bar with back / forward / reload / home, bookmarks in the project (`browser/bookmarks.json`), "Open in new tab". Shows the project preview (`paperos://preview/<entry>`), the docs (`paperos://docs/...`), `/legacy`, the landing and http(s) sites in a sandboxed iframe; sites that refuse embedding get a card with a way out. See Browser.                          |

One file per editor window: opening a file focuses its existing window, fills
an empty editor, or creates a new one. When a layout is active the new editor
stacks under the focused editor (the editor column grows downwards, Files
keeps its width); without a layout it cascades. The title shows the path and
a dot while unsaved.

### Browser

New window → Browser (or `paperos.browser.open()`, or "Open the Preview in
the Browser window" in the palette) opens a browser inside the canvas. The
address bar takes `http(s)` URLs, bare hosts (`example.com`) and internal
addresses:

| Address                     | Shows                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paperos://preview/<entry>` | The project preview, rebuilt from the live buffers like the Preview window (`paperos://preview/` picks the default page; `pages/home.json?tenant=2` works).      |
| `paperos://docs/<file>`     | PaperOS's own docs, bundled with the app: `README.md`, `docs/CANVAS_API.md`, `docs/MCP.md`, `docs/PLAN.md`, `docs/BRAND.md`. Links between them stay in the tab. |
| `paperos://legacy`          | The 2025 prototype.                                                                                                                                              |
| `paperos://home`            | The landing page.                                                                                                                                                |

Tabs, history and the active tab are the window's state (they survive
reloads, workspaces and boards); bookmarks are `browser/bookmarks.json` in the
project, so they show in Files and travel with it. External pages load in a
sandboxed iframe with `referrerPolicy="no-referrer"`. Response headers are
not readable across origins, so refusals are detected with a list of hosts
known to refuse framing, an 8 s load timeout and the frame's `load` event;
the card that results offers **Open in new tab**, **Try anyway** and, with
the agent bridge connected, **Screenshot via bridge** (Playwright on your
machine, see `docs/MCP.md`). There is no proxy.

The Canvas API's `browser.*` namespace (`open`, `navigate`, `back`,
`forward`, `reload`, `tabs`, `bookmarks`, `bookmark`) drives the window, and
arrows bind to Browser windows like any other.

### Terminal

New window → Terminal (or `paperos.terminal.open()`, or "Open a Terminal"
in the palette). The prompt shows the working directory inside the project
(`/src $`). Two backends sit behind it:

- **Project shell** runs in the browser tab over the project's files, the
  same live buffers editors and the preview use, so `cat` shows unsaved
  edits and `echo x > file` updates an open editor. Commands: `ls [-l]`,
  `cd`, `pwd`, `cat`, `echo`, `mkdir`, `touch`, `rm [-r]`, `mv`, `cp [-r]`,
  `find [-name] [-type]`, `grep [-i] [-n]`, `head`, `tail`, `wc`, `tree`,
  `clear`, `help`, `history`; pipes and `>` / `>>`; globs; Tab completion for
  commands, paths, presets, tables and boards; Up/Down history; `Ctrl+L`.
  PaperOS commands act on the canvas: `open <file>` opens an editor,
  `preview [entry]` sets the Preview entry (`preview home` finds
  `pages/home.json`), `data <table>` opens the Data window, `board <name>`
  opens a board, `layout <preset>` applies a layout, `api <expression>`
  evaluates against the Canvas API (`api windows.list()`), and `js` enters a
  JavaScript REPL with `paperos` in scope (`exit` leaves it).
- **Bridge shell** is a real shell on your machine (`$SHELL`, or
  `powershell.exe`) started by the `paperos-mcp` CLI through the agent
  bridge, streaming over the same WebSocket. It is opt-in: picking it shows
  what will run and where, and needs the bridge connected. With `node-pty`
  installed next to the CLI it is a pty (prompts, colors stripped for
  display); otherwise it runs on pipes in line mode. `Stop shell` ends it;
  closing the window, the tab or the CLI does too. See `docs/MCP.md`.

The window shows which backend is active and, when the bridge is off, a
one-line hint on how to get a real shell. The Canvas API's `terminal.*`
namespace (`open`, `run`, `write`, `onOutput`, `list`) drives the project
shell from scripts and agents; it cannot start a bridge shell.

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

## Design system

A project's look lives in `design/` as plain files, edited in the **Design**
window or any editor:

- **`design/tokens.json`**: semantic colors (`bg`, `surface`, `text`,
  `muted`, `primary`, `accent`, `danger`, `border`; a value or
  `{light, dark}`), typography (`fontFamily`, `fontSize`, `fontWeight`,
  `lineHeight` scales), `spacing`, `radius`, `shadow` and `breakpoint`
  scales. The bundler turns them into CSS variables in every preview:
  `--ds-color-primary`, `--ds-font-size-md`, `--ds-space-4`,
  `--ds-radius-lg`, `--ds-shadow-md`, with the dark values under
  `[data-theme="dark"]` and `prefers-color-scheme: dark`. The sample's
  `styles.css` reads `--ds-color-primary`, so changing the token in the
  Design window recolors the site as you drag the swatch.
- **`design/components/<Name>.json`**: one component per file with `props`
  (typed: `string`, `number`, `boolean`, `select` with `options`, `html`,
  `list`, `json`, and the data-aware `table`, `field`, `fields`), `slots`,
  a `template` and `variants`. Templates are HTML with `{prop}` (escaped),
  `{@slot}` (raw HTML), `{#each items}...{/each}` (`{.}`, `{key}`,
  `{@index}`), `{#if prop}...{:else}...{/if}` and `{{literal}}` for a
  literal brace, so the M4 `data-source` / `data-field` attributes work
  inside them and a Table or Nav renders from the project's tables. A
  `fields` prop defaults to the bound table's columns; templates get
  `columns` (name, label, type, input type, ref display column) to build
  tables and forms from the schema.
- **`design/README.md`**: the guidelines, shown in the Guidelines tab.

The starter library (created in the sample, or with **Create design system**
in an empty project) has Button, Card, Table, Form, Nav, MegaMenu, Hero,
Stat, List, Grid, Tabs, Modal, Badge and Avatar. Components also work in
hand-written HTML: `<ds-component name="Badge" props='{"text":"New"}'>` or
`<div data-component="Card" data-prop-title="Hi">...</div>` hydrate through
`paperos.design`, which the bundler injects with the library embedded (it
also renders `paperos.design.render(name, props)` on demand).

## Pages

`pages/<name>.json` composes components on a grid: `title`, `route`,
`layout` (`columns`, default 12, `gap`, `maxWidth`), `components` (blocks:
`{id, name, span, variant, props, bindings: [{table, fields, filter,
order, mode}], children}`), `links` to other pages (`{to, label, from}`,
the UX flows on the project map), `device` and page-level `bindings`. A
block's binding feeds its `table` / `fields` props, so the Connections
window and the project map see which tables a page uses. M4's page files
(`file: "index.html"`, `components: ["side-menu"]`) still parse.

The **Preview** window renders a page when its entry is
`pages/<name>.json` (the URL bar lists them); links with `href="#/route"`
switch to that page inside the preview. The **Page Builder** edits the
block tree (drag to reorder or into a container such as Grid or Card, spans,
add from the library, remove), the selected block's props, variant and
data binding (tables and columns from the schema), the page's title, route,
grid and links, and shows the page at mobile (390), tablet (820) or desktop
(1280) width; clicking a block in the preview selects it. Every change
writes the JSON file, so an open editor and the Preview follow. The sample
ships `home`, `products` and `admin`, bound to the M4 tables.

## Flowcharting

Windows can be connected and grouped, so a board reads like a flowchart:

- **Arrows**: tldraw's arrow tool binds to windows. Drag from the `↗`
  handle in a title bar to another window (or draw with the arrow tool),
  double-click the arrow for a label; arrows follow the windows they
  connect. `paperos.flow.connect(from, to, label)`, `flow.disconnect` and
  `flow.list` do the same from scripts and agents.
- **Sections**: tldraw frames with a title. "Group selected windows into a
  section" and "Section from workspace" (frames the tiled windows) are in
  the palette; `paperos.sections.create(title, windowIds)` and
  `sections.list` in the API. Windows in a section move with it, and a
  layout applied while a window in a section is focused tiles inside that
  section (the region is the section's bounds; otherwise it is the
  viewport as before).
- **Project map**: "Generate project map" (palette, or
  `paperos.map.generate()`) builds one board from the real project:
  sections Data (tables), Code (files, by folder; folders collapse to one
  card in big projects), Design (tokens), Components, Pages and UX flows
  (plus Growth and Ops when those folders exist), each a frame of Card
  windows, with arrows from the bindings index (table → component, page
  or file; `write` labels writes), component usage (component → page),
  page links (page → page, with the link label) and tokens → components.
  The layout is layered left to right with no overlaps, the camera zooms
  to it and it is saved as the "Map" workspace. "Regenerate project map"
  (`paperos.map.regenerate()`) rebuilds from the current project but keeps
  the position of every card you moved; gone subjects disappear, new ones
  take free slots. Each card's **Open** button opens the real thing.

## Boards and tours

A board is a saved arrangement of the canvas: sections laid out left to
right, each a frame holding windows or a tiled grid of windows, with labeled
arrows between windows and a tour through the sections. Boards are project
files, `boards/<name>.json`:

```json
{
  "name": "build-product",
  "title": "Build a product",
  "sections": [
    {
      "id": "data",
      "title": "1. Data",
      "grid": "grid",
      "cell": { "w": 520, "h": 360 },
      "windows": [
        { "id": "roles", "kind": "data", "content": { "table": "roles" } }
      ]
    }
  ],
  "arrows": [{ "from": "data", "to": "schema", "label": "tables" }],
  "steps": [{ "section": "data", "title": "Start with data", "caption": "..." }]
}
```

`grid` is one of the window manager's presets (`columns`, `rows`, `grid`,
`bento-*`), or `row`, `stack`, `single` and `free` for windows with their own
sizes; sections that share a `column` stack vertically. The **Boards** menu
opens a board (frames, windows and arrows appear, the camera zooms to it and
a "Board: ..." workspace is saved), plays its tour and saves the current
canvas as a new board file. Tour mode animates the camera section by
section, highlights the section and its arrows, shows a caption with
previous / next / exit, and takes the arrow keys and Escape. The Canvas API
has `boards.list / open / save / play / step / stop`. The sample site ships
"Build a product", "Ship a feature" and "Agent-driven"; the SaaS sample
ships "Small Business SaaS".

## Data lineage

**Boards > Data lineage** draws where every component on every page gets
its data: a Tables section (one card per table with its columns), a
Components section (one card per component that binds data) and a Pages
section, laid out left to right with arrows bound to the cards. Table →
component arrows are labeled with the bound fields, filter and mode (writes
in red); component → page arrows with the block ids. Pick a page in the
controls window (or click Focus on a page card, or call
`lineage.focus(page)`) to dim everything that does not feed it. **Data
lineage for <page>** puts the page's tables and components on the left and
the real Page Builder and a Preview on the right. In any Preview or Page
Builder, **Data sources** badges every component instance with its
`table.field` sources; hovering a badge outlines the table's card on the
canvas. `lineage.graph(page?)` returns the graph.

## Sample projects

**Open > Open sample project** creates the small site (tables `roles`,
`users`, `menu_items`, `pages`; pages `home`, `products`, `admin`; three
boards). **Open > Open sample: Small Business SaaS** (also
`projects.open('saas')`) creates a multi-tenant template: fifteen tables
(`tenants`, `users`, `roles`, `permissions`, `menu_items`, `customers`,
`bookings`, `services`, `invoices`, `leads`, `sequences`, `touches`,
`posts`, `campaigns`, `assets`) seeded for five businesses (a salon, a
restaurant, a contractor, a clinic and a shop), and twenty pages in four
apps: `pages/apps/customer/*` (mobile-first customer app with a bottom tab
bar, in the tenant's brand colors), `pages/apps/admin/*` (back office with a
role-gated side menu from `menu_items`, tenant and role switchers),
`pages/site/*` (the marketing site) and `pages/growth/social/*`,
`pages/growth/outreach/*` (post templates, content calendar, ad A/B,
assets; leads kanban, sequence builder, touch log, call sheet). Every
data-bound block filters by `tenant_id=@tenant`; `?tenant=2&role=3` on a
preview entry picks the business and the viewer's role. `boards/showcase.json`
tours Acquisition, Product and Growth with the pipeline arrows lead →
customer → booking → invoice → repeat. Heavy windows (previews, editors,
data grids) show a placeholder while far off screen or below 10% zoom, so
a board of a dozen previews stays smooth.

## Programmability

Everything the desktop does is reachable from one typed object, the
**Canvas API**, documented method by method in
[`docs/CANVAS_API.md`](docs/CANVAS_API.md): `windows`, `layout`,
`workspaces`, `projects`, `files`, `data`, `flow`, `sections`, `map`,
`preview`, `console`, `commands`, `canvas` and `events`. Every method
returns plain JSON and throws a readable error on bad input. Three doors
lead to it:

### Script window

**New window → Script** opens a JavaScript editor whose code runs as an
async function with `paperos` (the Canvas API) and a capturing `console` in
scope, so `await` works at the top level. **Run** (or `Ctrl+Enter`) shows
logs, the returned value and errors in the pane below; a returned image data
URL renders inline. The **Snippets** menu has starters: query a table,
generate the project map, connect and group two windows, tile everything in
a grid, open every `.js` file, create a note per file, take a screenshot,
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
                       markdown, data, schema, connections, design, pages,
                       card, script, plugins, agent, note, about (+ file-picker,
                       data-common, design-common, prop-editor helpers)
    sections.ts        sections = tldraw frames around windows (create, list, move)
    flow.ts            arrows bound to windows (connect, disconnect, list)
    create-window.ts   create a window with cascading placement
    cascade.ts         pure placement helper (unit tested)
    project-actions.ts Open folder / sample / ZIP / GitHub / dropped files
    ide-workspace.ts   the "IDE" arrangement, applied on first run
    data-workspace.ts  the "Data" arrangement; design-workspace.ts the "Design"
                       one; preset-workspaces.ts maps them
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
  design/         The design system (M5, pure TypeScript apart from project-design)
    tokens.ts          design/tokens.json: defaults, tolerant parser, --ds-* CSS
    components.ts      design/components/*.json: typed props, slots, variants
    render.ts          self-contained renderer (template language) + the
                       paperos.design preview runtime, injected like the data runtime
    pages.ts           pages/*.json: blocks on a grid, links, validation, HTML
    page-ops.ts        immutable block-tree operations for the Page Builder
    base-css.ts        component styles written against the tokens
    starter.ts         the starter library, default tokens and guidelines
    gallery.ts         the Design window's preview document
    project-design.ts  loads tokens, components, pages from the live documents
  map/            The project map (M5)
    model.ts           sections, nodes and edges from the project's content (pure)
    layout.ts          layered left-to-right placement, keeps given positions (pure)
    generate.ts        draws frames, cards and arrows; saves the "Map" workspace
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
e2e/              Playwright: landing, smoke, window manager, IDE, API, data and design tests
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
