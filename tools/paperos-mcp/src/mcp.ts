/**
 * The MCP server: one tool per Canvas API method (generated from the shared
 * schema), forwarded to the browser tab through the bridge.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { BridgeServer } from "./bridge-server.js";
import type { LocalTool } from "./local-tools.js";
import { NO_TAB_ERROR } from "./shared/bridge-protocol.js";
import {
  API_VERSION,
  bridgeTools,
  fromMcpName,
  toMcpName,
  toolInputSchema,
  type ToolSpec,
} from "./shared/schema.js";

export const STATUS_TOOL = "bridge_status";

export function toMcpTool(spec: ToolSpec): Tool {
  const schema = toolInputSchema(spec);
  return {
    name: toMcpName(spec.name),
    description: `${spec.description} Returns ${spec.returns}.`,
    inputSchema: {
      type: "object",
      properties: (schema.properties ??
        {}) as Tool["inputSchema"]["properties"],
      ...(schema.required?.length ? { required: schema.required } : {}),
    },
    annotations: {
      title: spec.name,
      readOnlyHint: !spec.mutates,
      destructiveHint:
        spec.mutates === true && /close|delete|untile|clear/.test(spec.name),
      openWorldHint: false,
    },
  };
}

/** A tool the CLI runs itself (browser.fetch, ...), as an MCP tool. */
export function localToMcpTool(tool: LocalTool): Tool {
  return {
    name: toMcpName(tool.name),
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      title: tool.name,
      readOnlyHint: tool.readOnly === true,
      destructiveHint: tool.readOnly !== true,
      openWorldHint: tool.name.startsWith("browser."),
    },
  };
}

export function listMcpTools(local: LocalTool[] = []): Tool[] {
  return [
    {
      name: STATUS_TOOL,
      description:
        "Whether a PaperOS tab is connected to this bridge. Call it first when another tool says no tab is connected.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ...bridgeTools().map(toMcpTool),
    ...local.filter((t) => !t.tabOnly).map(localToMcpTool),
  ];
}

const localDotted = (bridge: BridgeServer, name: string): string | null => {
  const hit = bridge.local
    .list()
    .find((t) => !t.tabOnly && toMcpName(t.name) === name);
  return hit ? hit.name : null;
};

function text(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function failure(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Runs one MCP tool call against the bridge; exported for tests. */
export async function runMcpTool(
  bridge: BridgeServer,
  name: string,
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  if (name === STATUS_TOOL) {
    const info = bridge.tabInfo();
    return text({
      state: bridge.state(),
      tab: info
        ? {
            client: info.client,
            apiVersion: info.apiVersion,
            tools: info.tools.length,
          }
        : null,
      hint: info ? undefined : NO_TAB_ERROR,
    });
  }
  const local = localDotted(bridge, name);
  if (local) {
    try {
      const result = await bridge.local.run(local, args ?? {});
      return isScreenshot(result) ? imageResult(result) : text(result ?? null);
    } catch (e) {
      return failure(e instanceof Error ? e.message : String(e));
    }
  }
  const dotted = fromMcpName(name);
  if (!dotted) return failure(`Unknown tool "${name}"`);
  try {
    const result = await bridge.call(dotted, args ?? {});
    if (dotted === "canvas.screenshot" && isScreenshot(result)) {
      const [, mimeType, data] =
        result.dataUrl.match(/^data:([^;]+);base64,(.*)$/) ?? [];
      if (data) {
        return {
          content: [
            { type: "image", data, mimeType: mimeType ?? "image/png" },
            { type: "text", text: `${result.width} x ${result.height} px` },
          ],
        };
      }
    }
    return text(result === undefined ? null : result);
  } catch (e) {
    return failure(e instanceof Error ? e.message : String(e));
  }
}

function imageResult(result: {
  dataUrl: string;
  width: number;
  height: number;
  title?: string;
}): CallToolResult {
  const [, mimeType, data] =
    result.dataUrl.match(/^data:([^;]+);base64,(.*)$/) ?? [];
  if (!data) return text(result);
  return {
    content: [
      { type: "image", data, mimeType: mimeType ?? "image/png" },
      {
        type: "text",
        text: `${result.title ? `${result.title} — ` : ""}${result.width} x ${result.height} px`,
      },
    ],
  };
}

function isScreenshot(
  v: unknown
): v is { dataUrl: string; width: number; height: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { dataUrl?: unknown }).dataUrl === "string"
  );
}

export function createMcpServer(bridge: BridgeServer, version: string): Server {
  const server = new Server(
    { name: "paperos", version },
    {
      capabilities: { tools: {} },
      instructions: [
        "PaperOS is a canvas desktop running in the user's browser. These tools drive it through the Canvas API",
        `(v${API_VERSION}): windows, layouts, workspaces, projects, files, preview, console, commands, camera and events.`,
        "Window ids come from windows_list. If a tool reports that no tab is connected, ask the user to open",
        'PaperOS and turn on "Agent bridge" in the top bar, then call bridge_status.',
        "browser_fetch and browser_screenshot run a real browser on this machine (Playwright) for sites the",
        "PaperOS Browser window cannot embed; browser_open / browser_navigate drive the Browser window itself.",
      ].join(" "),
    }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listMcpTools(bridge.local.list()),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    runMcpTool(
      bridge,
      request.params.name,
      request.params.arguments as Record<string, unknown> | undefined
    )
  );
  return server;
}
