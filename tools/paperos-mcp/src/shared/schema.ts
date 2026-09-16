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
  "WindowInfo {id, kind, title, content, x, y, w, h, tiled, focused}";
const LAYOUT_STATE =
  "LayoutState {preset, root (layout tree or null), region, tiled: window ids}";
const WORKSPACE_INFO = "WorkspaceInfo {id, name, preset, windowCount, active}";
const PROJECT_INFO = "ProjectInfo {id, name, source, backend, active}";
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
      "Creates a window of a registered kind (files, editor, preview, console, markdown, note, script, plugins, agent, or a plugin kind). Without a rect it cascades at the viewport center.",
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
      "Makes a project active: 'sample' creates the sample site, a github.com/owner/repo URL imports a public repository, anything else is the id or name of a known project.",
    params: [str("source", "'sample', a GitHub URL, or a project id/name")],
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
