/**
 * The Canvas API tool surface as data.
 *
 * Every method of the Canvas API is described here once: its dotted name,
 * what it does, its parameters (a small JSON Schema subset) and what it
 * returns. The script console shows this list, `docs/CANVAS_API.md` is
 * generated from it (`npm run api:gen`) and the MCP bridge in
 * `tools/paperos-mcp/` turns each entry into an MCP tool. The file has no
 * imports so it can be copied verbatim into the CLI; a unit test keeps the
 * copy in sync.
 */

export interface JsonSchema {
  type?:
    "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
  description?: string;
  enum?: string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  default?: unknown;
}

export interface ParamSpec {
  name: string;
  description: string;
  required?: boolean;
  schema: JsonSchema;
}

export interface ToolSpec {
  /** Dotted name: `<namespace>.<method>`, also the JS path on `paperos`. */
  name: string;
  description: string;
  /** Positional parameters of the JS method, in order. */
  params: ParamSpec[];
  /** What the method resolves to (all results are plain JSON). */
  returns: string;
  /** Takes a callback; not offered over the MCP bridge. */
  browserOnly?: boolean;
  /** Changes state (an MCP hint; agents may ask before running these). */
  mutates?: boolean;
}

export const API_VERSION = 1;

/** Event names `paperos.events.on()` and `events.poll()` deliver. */
export const EVENT_NAMES = [
  "window.created",
  "window.closed",
  "window.focused",
  "layout.changed",
  "file.changed",
  "command.run",
  "project.changed",
  "data.changed",
  "board.opened",
  "tour.changed",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export const LAYOUT_PRESETS = [
  "free",
  "columns",
  "grid",
  "bento-1-2",
  "bento-2-1",
  "bento-mosaic",
  "split-tree",
] as const;

export const SIDES = ["left", "right", "top", "bottom"] as const;

const id = (description = "Window id (as returned by windows.list)") => ({
  name: "id",
  description,
  required: true,
  schema: { type: "string" as const },
});

const str = (name: string, description: string, required = true) => ({
  name,
  description,
  required,
  schema: { type: "string" as const },
});

const num = (name: string, description: string, required = true) => ({
  name,
  description,
  required,
  schema: { type: "number" as const },
});

const WINDOW_INFO =
  "WindowInfo {id, kind, title, content, x, y, w, h, tiled, focused, section}";
const FLOW_INFO = "FlowInfo {id, from, to, label}";
const SECTION_INFO = "SectionInfo {id, title, x, y, w, h, windowIds}";
const MAP_RESULT =
  "MapResult {sections, nodes, edges, kept, bounds: {x, y, w, h}, workspace: {id, name} | null}";
const BOARD_INFO =
  "BoardInfo {name, title, path, description?, sections, windows, onCanvas}";
const BOARD_RESULT =
  "BoardResult {name, title, sections, windows, arrows, bounds: {x, y, w, h}, workspace: {id, name} | null}";
const LINEAGE_GRAPH =
  "LineageGraph {tables: [{key, name, columns: [{name, type, ref?}], rows}], components: [{key, name, kind: 'design' | 'declared', path?, description?, tables, pages}], pages: [{key, name, title, route, components, tables}], edges: [{from, to, kind: 'table-component' | 'component-page' | 'table-page', label, fields, filter?, mode: 'read' | 'write', pages, blocks?}]}";
const LINEAGE_RESULT =
  "LineageResult: BoardResult plus {page: string | null, tables, components, pages, edges}";
const TOUR_INFO =
  "TourInfo {board, title, step, total, section, sectionTitle, stepTitle, caption, first, last} or null when no tour is playing";
const BROWSER_TAB =
  "BrowserTab {id, url, title, active, canGoBack, canGoForward}";
const BROWSER_INFO = `BrowserInfo {id (window id), title, tabs: ${BROWSER_TAB}[]}`;
const BOOKMARK = "Bookmark {title, url}";
const TERMINAL_INFO =
  "TerminalInfo {id (window id), title, backend: 'project' | 'bridge', prompt, lines}";
const LAYOUT_STATE =
  "LayoutState {preset, root (layout tree or null), region, tiled: window ids}";
const WORKSPACE_INFO = "WorkspaceInfo {id, name, preset, windowCount, active}";
const PROJECT_INFO = "ProjectInfo {id, name, source, backend, active}";
const TABLE_INFO =
  "TableInfo {name, primaryKey, display, columns: Column[], rowCount, path}";
const ROW =
  "Row (an object; the primary key is `id` unless the table says otherwise)";
const QUERY_OPTIONS = {
  type: "object" as const,
  properties: {
    filter: {
      type: "string" as const,
      description:
        "Filter text: words match any column; col=value, col!=value, col>n, col>=n, col<n, col<=n, col:part",
    },
    where: {
      type: "object" as const,
      description: "Column equals value, for every key",
      additionalProperties: true,
    },
    sort: {
      type: "string" as const,
      description: "'col', '-col' or 'col desc'",
    },
    page: {
      type: "integer" as const,
      description: "1-based page (with pageSize)",
    },
    pageSize: { type: "integer" as const },
    limit: { type: "integer" as const },
    offset: { type: "integer" as const },
  },
};
const CAMERA = "Camera {x, y, z}";

export const TOOLS: ToolSpec[] = [
  // ----- windows -----
  {
    name: "windows.list",
    description: "Every window on the current page, in z-order (bottom first).",
    params: [],
    returns: `${WINDOW_INFO}[]`,
  },
  {
    name: "windows.get",
    description: "One window by id.",
    params: [id()],
    returns: `${WINDOW_INFO} or null`,
  },
  {
    name: "windows.create",
    description:
      "Creates a window of a registered kind (files, editor, preview, console, markdown, data, schema, connections, design, pages, card, note, script, plugins, agent, or a plugin kind). Without a rect it cascades at the viewport center.",
    params: [
      {
        name: "options",
        description: "What to create",
        required: true,
        schema: {
          type: "object",
          properties: {
            kind: { type: "string", description: "Window kind id" },
            title: { type: "string", description: "Title bar text" },
            content: {
              type: "string",
              description:
                'Kind-specific content: note text, script source, a JSON file reference for editors ({"project","path"}), a preview entry path',
            },
            rect: {
              type: "object",
              description: "Position and size in page units",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                w: { type: "number" },
                h: { type: "number" },
              },
            },
            tiled: {
              type: "boolean",
              description: "Add it to the active layout (default false)",
            },
          },
          required: ["kind"],
        },
      },
    ],
    returns: WINDOW_INFO,
    mutates: true,
  },
  {
    name: "windows.update",
    description: "Changes a window's title and/or content.",
    params: [
      id(),
      {
        name: "patch",
        description: "Fields to change",
        required: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    ],
    returns: WINDOW_INFO,
    mutates: true,
  },
  {
    name: "windows.close",
    description: "Closes (deletes) a window.",
    params: [id()],
    returns: "{closed: boolean}",
    mutates: true,
  },
  {
    name: "windows.focus",
    description: "Focuses a window and brings it to the front of its layer.",
    params: [id()],
    returns: WINDOW_INFO,
    mutates: true,
  },
  {
    name: "windows.move",
    description:
      "Moves a window to a page position. A tiled window leaves the layout first.",
    params: [id(), num("x", "Left edge, page units"), num("y", "Top edge")],
    returns: WINDOW_INFO,
    mutates: true,
  },
  {
    name: "windows.resize",
    description:
      "Resizes a window (minimum 240 x 160). A tiled window leaves the layout first.",
    params: [id(), num("w", "Width, page units"), num("h", "Height")],
    returns: WINDOW_INFO,
    mutates: true,
  },

  // ----- layout -----
  {
    name: "layout.apply",
    description:
      "Tiles every window with a preset inside the current viewport ('free' floats them all).",
    params: [
      {
        name: "preset",
        description: "Layout preset",
        required: true,
        schema: { type: "string", enum: [...LAYOUT_PRESETS] },
      },
    ],
    returns: LAYOUT_STATE,
    mutates: true,
  },
  {
    name: "layout.tile",
    description:
      "Adds windows to the layout (all windows when ids is omitted). Uses the current preset, or columns when none is active.",
    params: [
      {
        name: "ids",
        description: "Window ids; omit for every window",
        schema: { type: "array", items: { type: "string" } },
      },
    ],
    returns: LAYOUT_STATE,
    mutates: true,
  },
  {
    name: "layout.untile",
    description:
      "Floats windows again (every window when ids is omitted, which also clears the layout).",
    params: [
      {
        name: "ids",
        description: "Window ids; omit for every window",
        schema: { type: "array", items: { type: "string" } },
      },
    ],
    returns: LAYOUT_STATE,
    mutates: true,
  },
  {
    name: "layout.split",
    description:
      "Tiles a window next to another one (left/right/top/bottom), i3 style. Creates a new note window when windowId is omitted.",
    params: [
      id("The window to split"),
      {
        name: "side",
        description: "Where the other window goes",
        required: true,
        schema: { type: "string", enum: [...SIDES] },
      },
      str("windowId", "The window to place there (default: a new note)", false),
    ],
    returns: LAYOUT_STATE,
    mutates: true,
  },
  {
    name: "layout.swap",
    description: "Exchanges the places of two tiled windows.",
    params: [str("a", "First window id"), str("b", "Second window id")],
    returns: LAYOUT_STATE,
    mutates: true,
  },
  {
    name: "layout.getTree",
    description: "The current layout: preset, tree, region and tiled ids.",
    params: [],
    returns: LAYOUT_STATE,
  },

  // ----- workspaces -----
  {
    name: "workspaces.list",
    description: "Saved workspaces (named arrangements).",
    params: [],
    returns: `${WORKSPACE_INFO}[]`,
  },
  {
    name: "workspaces.save",
    description:
      "Saves the current arrangement under a name (updates the workspace when the name exists).",
    params: [str("name", "Workspace name")],
    returns: WORKSPACE_INFO,
    mutates: true,
  },
  {
    name: "workspaces.switch",
    description: "Applies a saved workspace by id or name.",
    params: [str("idOrName", "Workspace id or name")],
    returns: WORKSPACE_INFO,
    mutates: true,
  },
  {
    name: "workspaces.rename",
    description: "Renames a workspace.",
    params: [str("id", "Workspace id"), str("name", "New name")],
    returns: WORKSPACE_INFO,
    mutates: true,
  },
  {
    name: "workspaces.delete",
    description: "Deletes a workspace.",
    params: [str("id", "Workspace id")],
    returns: "{deleted: boolean}",
    mutates: true,
  },

  // ----- projects -----
  {
    name: "projects.list",
    description: "Known projects.",
    params: [],
    returns: `${PROJECT_INFO}[]`,
  },
  {
    name: "projects.open",
    description:
      "Makes a project active: 'sample' creates the sample site, 'saas' the Small Business SaaS sample (five tenants, customer app, admin, site, growth pages, the showcase board), a github.com/owner/repo URL imports a public repository, anything else is the id or name of a known project.",
    params: [
      str("source", "'sample', 'saas', a GitHub URL, or a project id/name"),
    ],
    returns: PROJECT_INFO,
    mutates: true,
  },
  {
    name: "projects.current",
    description: "The active project.",
    params: [],
    returns: `${PROJECT_INFO} or null`,
  },

  // ----- files (active project) -----
  {
    name: "files.list",
    description: "Files and folders of the active project.",
    params: [],
    returns: "{path, type: 'file' | 'dir'}[]",
  },
  {
    name: "files.read",
    description:
      "Reads a file of the active project (the live editor buffer when the file is open).",
    params: [str("path", "Project-relative path")],
    returns: "{path, text}",
  },
  {
    name: "files.write",
    description:
      "Replaces a file's content and saves it. Goes through the shared document, so open editors update.",
    params: [str("path", "Project-relative path"), str("text", "New content")],
    returns: "{path, size}",
    mutates: true,
  },
  {
    name: "files.create",
    description: "Creates a file (folders are created as needed).",
    params: [
      str("path", "Project-relative path"),
      str("text", "Initial content (default empty)", false),
    ],
    returns: "{path}",
    mutates: true,
  },
  {
    name: "files.delete",
    description: "Deletes a file or folder.",
    params: [str("path", "Project-relative path")],
    returns: "{deleted: boolean}",
    mutates: true,
  },
  {
    name: "files.rename",
    description: "Renames or moves a file or folder.",
    params: [str("from", "Current path"), str("to", "New path")],
    returns: "{path}",
    mutates: true,
  },
  {
    name: "files.open",
    description:
      "Opens a file in an editor (or markdown) window, reusing a window that already shows it.",
    params: [
      str("path", "Project-relative path"),
      {
        name: "kind",
        description: "Window kind (default editor)",
        schema: { type: "string", enum: ["editor", "markdown"] },
      },
    ],
    returns: WINDOW_INFO,
    mutates: true,
  },

  // ----- data (active project) -----
  {
    name: "data.tables",
    description:
      "Tables of the active project's data model (data/schema.json) with their columns and row counts.",
    params: [],
    returns: `${TABLE_INFO}[]`,
  },
  {
    name: "data.schema",
    description:
      "The data model: tables with columns (name, type: string | number | boolean | date | json | ref | image, required, unique, default, ref), plus problems found in data/schema.json.",
    params: [],
    returns: "{tables: Table[], errors: string[]}",
  },
  {
    name: "data.setSchema",
    description:
      "Replaces the data model and migrates the row files: new tables get an empty data/<table>.json, removed tables lose theirs, added columns get their default, removed columns are dropped, changed types are converted. Pass renames so renamed tables and columns keep their data.",
    params: [
      {
        name: "schema",
        description:
          "The new schema: {tables: [{name, primaryKey?, display?, columns: [{name, type, required?, unique?, default?, ref?}]}]}",
        required: true,
        schema: {
          type: "object",
          properties: {
            tables: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
          },
          required: ["tables"],
        },
      },
      {
        name: "renames",
        description:
          "Old to new names: {tables: {old: new}, columns: {table: {old: new}}}",
        schema: {
          type: "object",
          properties: {
            tables: {
              type: "object",
              additionalProperties: { type: "string" },
            },
            columns: {
              type: "object",
              additionalProperties: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
        },
      },
    ],
    returns: "{steps: string[]} (what was migrated)",
    mutates: true,
  },
  {
    name: "data.list",
    description: "Rows of a table, filtered, sorted and paginated in memory.",
    params: [
      str("table", "Table name"),
      {
        name: "options",
        description: "Filter, sort and paging",
        schema: QUERY_OPTIONS,
      },
    ],
    returns: "{rows: Row[], total, page, pageCount}",
  },
  {
    name: "data.get",
    description: "One row by primary key, or null.",
    params: [
      str("table", "Table name"),
      str("id", "Primary key (numbers may be passed as strings)"),
    ],
    returns: `${ROW} or null`,
  },
  {
    name: "data.insert",
    description:
      "Adds a row, validated against the schema (types, required, unique, refs). The primary key is generated when left out; defaults fill missing columns.",
    params: [
      str("table", "Table name"),
      {
        name: "row",
        description: "Column values",
        required: true,
        schema: { type: "object", additionalProperties: true },
      },
    ],
    returns: ROW,
    mutates: true,
  },
  {
    name: "data.update",
    description:
      "Changes columns of a row (validated; values typed as text are converted).",
    params: [
      str("table", "Table name"),
      str("id", "Primary key"),
      {
        name: "patch",
        description: "Columns to change",
        required: true,
        schema: { type: "object", additionalProperties: true },
      },
    ],
    returns: ROW,
    mutates: true,
  },
  {
    name: "data.delete",
    description:
      "Deletes a row. Fails when other rows refer to it unless onReferences is 'nullify' (clear those refs) or 'cascade' (delete them too).",
    params: [
      str("table", "Table name"),
      str("id", "Primary key"),
      {
        name: "onReferences",
        description:
          "What to do with rows pointing at this one (default block)",
        schema: { type: "string", enum: ["block", "nullify", "cascade"] },
      },
    ],
    returns: "{deleted: boolean, affected: {table, column, count}[]}",
    mutates: true,
  },
  {
    name: "data.bindings",
    description:
      "Where tables are used: data-source attributes in HTML, bindings in components/*.json and pages/*.json, and paperos.data.<table> calls in scripts, each with file and line; plus unused tables and broken bindings (missing tables or columns).",
    params: [str("table", "Only bindings of this table", false)],
    returns:
      "{bindings: {table, fields, mode, kind, path, line, source}[], sources: {path, kind, name, tables, components, indirect}[], unusedTables: string[], broken: {binding, message}[]}",
  },
  {
    name: "data.open",
    description:
      "Opens a Data window on a table (reusing one when open), or a Schema / Connections window.",
    params: [
      str(
        "table",
        "Table to show (optional for schema and connections)",
        false
      ),
      {
        name: "kind",
        description: "Window kind (default data)",
        schema: { type: "string", enum: ["data", "schema", "connections"] },
      },
    ],
    returns: WINDOW_INFO,
    mutates: true,
  },

  // ----- flow (arrows between windows) -----
  {
    name: "flow.connect",
    description:
      "Draws an arrow from one window to another (bound to both, so it follows them), with an optional label. Arrows can also be drawn by hand with the arrow tool or the connect handle in a title bar.",
    params: [
      str("fromWindowId", "Window the arrow starts at"),
      str("toWindowId", "Window the arrow points at"),
      str("label", "Text on the arrow", false),
    ],
    returns: FLOW_INFO,
    mutates: true,
  },
  {
    name: "flow.disconnect",
    description:
      "Removes an arrow by id, or every arrow between two windows when a second window id is given.",
    params: [
      str("id", "Arrow id, or the first window id"),
      str(
        "toWindowId",
        "The other window (removes the arrows between the two)",
        false
      ),
    ],
    returns: "{removed: number}",
    mutates: true,
  },
  {
    name: "flow.list",
    description:
      "Every arrow on the page that touches a window: its ends (window ids or null for a loose end) and label.",
    params: [],
    returns: `${FLOW_INFO}[]`,
  },

  // ----- sections (frames grouping windows) -----
  {
    name: "sections.create",
    description:
      "Groups windows into a titled section (a frame): the windows move with it and layouts applied while one of them is focused tile inside it.",
    params: [
      str("title", "Section title"),
      {
        name: "windowIds",
        description:
          "Windows to put in the section (the frame fits around them)",
        required: true,
        schema: { type: "array", items: { type: "string" } },
      },
    ],
    returns: SECTION_INFO,
    mutates: true,
  },
  {
    name: "sections.list",
    description:
      "Every section on the page with its bounds and the windows inside.",
    params: [],
    returns: `${SECTION_INFO}[]`,
  },

  // ----- map (the project flowchart) -----
  {
    name: "map.generate",
    description:
      "Builds the project map: sections Data, Code, Design, Components, Pages and UX flows (plus Growth / Ops when those folders exist) as frames of Card windows, with arrows from the bindings, component usage, page links and tokens. Replaces an existing map and saves the 'Map' workspace.",
    params: [],
    returns: MAP_RESULT,
    mutates: true,
  },
  {
    name: "map.regenerate",
    description:
      "Rebuilds the project map from the current project, keeping the position of every card that still has a subject; new cards take free slots, gone ones are removed, arrows are redrawn.",
    params: [],
    returns: MAP_RESULT,
    mutates: true,
  },

  // ----- boards (saved arrangements of sections, left to right, with a tour) -----
  {
    name: "boards.list",
    description:
      "The boards of the active project (boards/*.json): saved arrangements of sections laid out left to right, each holding windows or a grid of windows, with arrows and a tour. onCanvas says whether a board is drawn on the current page.",
    params: [],
    returns: `${BOARD_INFO}[]`,
  },
  {
    name: "boards.open",
    description:
      "Draws a board on the canvas: one frame per section, the windows inside (tiled by the section's grid), the arrows between them; replaces an earlier copy of the same board, zooms to it and saves a 'Board: <title>' workspace.",
    params: [
      str("name", "Board name (boards/<name>.json)"),
      {
        name: "options",
        description: "Where to draw it",
        schema: {
          type: "object",
          properties: {
            origin: {
              type: "object",
              description:
                "Top-left corner in page units (default: right of everything, or where the board already is)",
              properties: { x: { type: "number" }, y: { type: "number" } },
            },
          },
        },
      },
    ],
    returns: BOARD_RESULT,
    mutates: true,
  },
  {
    name: "boards.save",
    description:
      "Captures the current page as a board file: every section (frame) with its windows and their positions, loose windows as a 'Canvas' section, arrows with labels, one tour step per section. Writes boards/<name>.json.",
    params: [
      str("name", "Board name (letters, digits, - and _)"),
      str("title", "Board title (default: the name)", false),
    ],
    returns: BOARD_INFO,
    mutates: true,
  },
  {
    name: "boards.play",
    description:
      "Starts the tour of a board: the camera animates to its first section, which is highlighted with its arrows, and a caption shows the step. Opens the board first when it is not on the canvas. Arrow keys step, Escape stops.",
    params: [
      str("name", "Board name (default: the board on the canvas)", false),
      {
        name: "step",
        description: "Step to start at (0-based, default 0)",
        schema: { type: "integer" },
      },
    ],
    returns: TOUR_INFO,
    mutates: true,
  },
  {
    name: "boards.step",
    description:
      "Moves the playing tour by delta steps (default 1; negative goes back). Stepping past the last section ends the tour.",
    params: [
      {
        name: "delta",
        description: "Steps to move (default 1)",
        schema: { type: "integer" },
      },
    ],
    returns: TOUR_INFO,
    mutates: true,
  },
  {
    name: "boards.stop",
    description: "Ends the tour and removes the highlight.",
    params: [],
    returns: "{stopped: boolean}",
    mutates: true,
  },

  // ----- lineage (where every component on every page gets its data) -----
  {
    name: "lineage.graph",
    description:
      "Where every component on every page gets its data, as three columns: tables (data/schema.json, with columns), components that bind data (a design component used by a page block with a binding or a table prop, or a component declaration) and pages. Edges are labeled: table → component with the bound fields, filter and mode; component → page with the block ids; table → page for page-level bindings. With page, only what feeds that page.",
    params: [
      str(
        "page",
        "Page name (pages/<name>.json) to reduce the graph to",
        false
      ),
    ],
    returns: LINEAGE_GRAPH,
  },
  {
    name: "lineage.open",
    description:
      "Draws the lineage as a board named data-lineage: Tables → Components → Pages sections of cards, left to right, with arrows bound to the cards and labeled with the fields, plus a controls window to focus a page. With options.page, draws 'Data lineage for <page>' instead: the page's tables and components on the left and the real Page Builder and a Preview with the Data sources overlay on the right.",
    params: [
      {
        name: "options",
        description: "What to draw",
        schema: {
          type: "object",
          properties: {
            page: {
              type: "string",
              description:
                "One page's lineage next to its Page Builder and Preview",
            },
          },
        },
      },
    ],
    returns: LINEAGE_RESULT,
    mutates: true,
  },
  {
    name: "lineage.focus",
    description:
      "On the open Data lineage board, dims every card and arrow that does not feed the page; without a page everything is shown again.",
    params: [str("page", "Page name; omit or null for all pages", false)],
    returns: "{page: string | null, dimmed, kept}",
    mutates: true,
  },

  // ----- browser -----
  {
    name: "browser.open",
    description:
      "Opens a Browser window. Addresses are http(s) URLs or internal targets: paperos://preview/<entry> (the project preview; empty entry = the default page), paperos://docs/<file> (README.md, docs/CANVAS_API.md, docs/MCP.md, docs/PLAN.md, docs/BRAND.md), paperos://legacy, paperos://home.",
    params: [
      {
        name: "options",
        description: "What to open",
        schema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Address (default paperos://preview/)",
            },
            title: { type: "string", description: "Window title" },
          },
        },
      },
    ],
    returns: BROWSER_INFO,
    mutates: true,
  },
  {
    name: "browser.navigate",
    description:
      "Goes to an address in the active tab of a Browser window (the focused or first Browser window when id is omitted; opens one when there is none).",
    params: [
      str("url", "Address (http(s) or paperos://...)"),
      str("id", "Browser window id (default: focused or first)", false),
    ],
    returns: BROWSER_INFO,
    mutates: true,
  },
  {
    name: "browser.back",
    description: "Goes back in the active tab of a Browser window.",
    params: [str("id", "Browser window id (default: focused or first)", false)],
    returns: BROWSER_INFO,
    mutates: true,
  },
  {
    name: "browser.forward",
    description: "Goes forward in the active tab of a Browser window.",
    params: [str("id", "Browser window id (default: focused or first)", false)],
    returns: BROWSER_INFO,
    mutates: true,
  },
  {
    name: "browser.reload",
    description: "Reloads the active tab of a Browser window.",
    params: [str("id", "Browser window id (default: focused or first)", false)],
    returns: BROWSER_INFO,
    mutates: true,
  },
  {
    name: "browser.tabs",
    description:
      "The tabs of a Browser window, or of every Browser window when id is omitted.",
    params: [str("id", "Browser window id", false)],
    returns: `${BROWSER_INFO}[]`,
  },
  {
    name: "browser.bookmarks",
    description:
      "The project's bookmarks (browser/bookmarks.json; defaults when the file does not exist).",
    params: [],
    returns: `${BOOKMARK}[]`,
  },
  {
    name: "browser.bookmark",
    description:
      "Adds (or retitles) a bookmark in browser/bookmarks.json, or removes it with remove: true.",
    params: [
      {
        name: "bookmark",
        description: "The bookmark",
        required: true,
        schema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Address" },
            title: { type: "string", description: "Title (default: derived)" },
            remove: { type: "boolean", description: "Remove instead of add" },
          },
          required: ["url"],
        },
      },
    ],
    returns: `${BOOKMARK}[] (the whole list)`,
    mutates: true,
  },

  // ----- terminal -----
  {
    name: "terminal.open",
    description:
      "Opens a Terminal window. The project shell runs in the tab over the project's files (ls, cd, cat, grep, find, tree, echo >, open <file>, preview <page>, data <table>, board <name>, layout <preset>, api <expression>, js). The bridge shell (a real shell on the user's machine) can only be started by the person, from the window.",
    params: [
      {
        name: "options",
        description: "What to open",
        schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Window title" },
            run: {
              type: "array",
              items: { type: "string" },
              description: "Commands to run right away, in order",
            },
          },
        },
      },
    ],
    returns: TERMINAL_INFO,
    mutates: true,
  },
  {
    name: "terminal.run",
    description:
      "Runs a command line in a Terminal window (the focused or first one when id is omitted; opens one when there is none) and returns its output. In the bridge shell the line is typed into the real shell and whatever it printed within 600 ms is returned.",
    params: [
      str("command", "The command line"),
      str("id", "Terminal window id (default: focused or first)", false),
    ],
    returns: "{output, error, prompt}",
    mutates: true,
  },
  {
    name: "terminal.write",
    description:
      "Sends raw input (keystrokes, without an implied newline) to a Terminal window's bridge shell.",
    params: [
      str("data", "Text to send (\\n runs a line, \\u0003 is Ctrl+C)"),
      str("id", "Terminal window id (default: focused or first)", false),
    ],
    returns: "{ok: true}",
    mutates: true,
  },
  {
    name: "terminal.onOutput",
    description:
      "Subscribes to a Terminal window's output. The callback gets (text, kind) with kind 'output' | 'error' | 'system'. Returns an unsubscribe function.",
    params: [
      {
        name: "callback",
        description: "function(text, kind)",
        required: true,
        schema: { description: "function" },
      },
      str("id", "Terminal window id (default: focused or first)", false),
    ],
    returns: "unsubscribe function",
    browserOnly: true,
  },
  {
    name: "terminal.list",
    description: "Every Terminal window with its backend and prompt.",
    params: [],
    returns: `${TERMINAL_INFO}[]`,
  },

  // ----- preview -----
  {
    name: "preview.reload",
    description: "Rebuilds every preview window.",
    params: [],
    returns: "{reloaded: number of preview windows}",
    mutates: true,
  },
  {
    name: "preview.setEntry",
    description: "Sets the entry HTML file of every preview window.",
    params: [str("path", "Project-relative path of an HTML file")],
    returns: "{entry}",
    mutates: true,
  },

  // ----- console -----
  {
    name: "console.log",
    description: "Writes a line to the Console windows.",
    params: [
      str("text", "Text to show"),
      {
        name: "level",
        description: "Level (default log)",
        schema: {
          type: "string",
          enum: ["log", "info", "warn", "error", "debug", "system"],
        },
      },
    ],
    returns: "{ok: true}",
    mutates: true,
  },
  {
    name: "console.clear",
    description: "Clears the Console windows.",
    params: [],
    returns: "{ok: true}",
    mutates: true,
  },

  // ----- commands -----
  {
    name: "commands.list",
    description:
      "Every command the palette offers right now, including dynamic ones (open file, switch workspace).",
    params: [],
    returns: "{id, title, group, shortcut?}[]",
  },
  {
    name: "commands.run",
    description: "Runs a command by id.",
    params: [
      str("id", "Command id (see commands.list)"),
      {
        name: "args",
        description: "Arguments for commands that take them",
        schema: { type: "object", additionalProperties: true },
      },
    ],
    returns: "{ran: boolean}",
    mutates: true,
  },

  // ----- canvas -----
  {
    name: "canvas.camera",
    description: "The camera position and zoom.",
    params: [],
    returns: CAMERA,
  },
  {
    name: "canvas.setCamera",
    description: "Moves the camera (fields left out keep their value).",
    params: [
      {
        name: "camera",
        description: "New camera",
        required: true,
        schema: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number", description: "Zoom (1 = 100%)" },
          },
        },
      },
    ],
    returns: CAMERA,
    mutates: true,
  },
  {
    name: "canvas.zoomTo",
    description:
      "Zooms the camera to fit windows (all windows when ids is omitted).",
    params: [
      {
        name: "ids",
        description: "Window ids; omit for every window",
        schema: { type: "array", items: { type: "string" } },
      },
    ],
    returns: CAMERA,
    mutates: true,
  },
  {
    name: "canvas.screenshot",
    description:
      "Renders windows (all when ids is omitted) to a PNG through tldraw's export and returns it as a data URL. Window bodies render as frames with their titles.",
    params: [
      {
        name: "options",
        description: "What to capture",
        schema: {
          type: "object",
          properties: {
            ids: { type: "array", items: { type: "string" } },
            scale: {
              type: "number",
              description: "Pixels per page unit (default 0.5)",
            },
          },
        },
      },
    ],
    returns: "{dataUrl, width, height}",
  },

  // ----- events -----
  {
    name: "events.on",
    description:
      "Subscribes to an event ('*' for all). The callback gets {name, time, payload}. Returns an unsubscribe function.",
    params: [
      {
        name: "name",
        description: "Event name or '*'",
        required: true,
        schema: { type: "string", enum: [...EVENT_NAMES, "*"] },
      },
      {
        name: "callback",
        description: "function(event)",
        required: true,
        schema: { description: "function" },
      },
    ],
    returns: "unsubscribe function",
    browserOnly: true,
  },
  {
    name: "events.list",
    description: "The event names that exist.",
    params: [],
    returns: "string[]",
  },
  {
    name: "events.poll",
    description:
      "Recent events (the last 200 are kept). Pass the returned cursor to get only newer ones next time.",
    params: [
      {
        name: "since",
        description: "Cursor from the previous call (default 0)",
        schema: { type: "integer" },
      },
    ],
    returns: "{events: {seq, name, time, payload}[], cursor}",
  },
];

export function getTool(name: string): ToolSpec | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** Tools the MCP bridge offers: everything that does not need a callback. */
export function bridgeTools(): ToolSpec[] {
  return TOOLS.filter((t) => !t.browserOnly);
}

/** `windows.list` -> `windows_list` (MCP tool names allow no dots). */
export function toMcpName(name: string): string {
  return name.replace(/\./g, "_");
}

/** `windows_list` -> `windows.list`; null when no such tool exists. */
export function fromMcpName(mcpName: string): string | null {
  const hit = TOOLS.find((t) => toMcpName(t.name) === mcpName);
  return hit ? hit.name : null;
}

/**
 * True when the tool's only parameter is an object: object-style callers
 * (MCP, `invokeTool`) then pass that object directly instead of wrapping it.
 */
export function takesOptionsObject(tool: ToolSpec): boolean {
  return (
    tool.params.length === 1 &&
    tool.params[0].schema.type === "object" &&
    tool.params[0].schema.enum === undefined
  );
}

/** The JSON Schema for an object-style call (what MCP's `inputSchema` wants). */
export function toolInputSchema(tool: ToolSpec): JsonSchema {
  if (takesOptionsObject(tool)) {
    const s = tool.params[0].schema;
    return { ...s, type: "object", properties: s.properties ?? {} };
  }
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const p of tool.params) {
    properties[p.name] = { description: p.description, ...p.schema };
    if (p.required) required.push(p.name);
  }
  return required.length
    ? { type: "object", properties, required }
    : { type: "object", properties };
}

/** Object-style args -> the positional argument list the JS method takes. */
export function argsToPositional(
  tool: ToolSpec,
  args: Record<string, unknown> | undefined
): unknown[] {
  const a = args ?? {};
  if (takesOptionsObject(tool)) return [a];
  const missing = tool.params
    .filter((p) => p.required && a[p.name] === undefined)
    .map((p) => p.name);
  if (missing.length) {
    throw new Error(
      `${tool.name}: missing required argument${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`
    );
  }
  const list = tool.params.map((p) => a[p.name]);
  while (list.length && list[list.length - 1] === undefined) list.pop();
  return list;
}
