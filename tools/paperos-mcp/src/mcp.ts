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
      properties: (schema.properties ?? {}) as Tool["inputSchema"]["properties"],
      ...(schema.required?.length ? { required: schema.required } : {}),
    },
    annotations: {
      title: spec.name,
      readOnlyHint: !spec.mutates,
      destructiveHint: spec.mutates === true && /close|delete|untile|clear/.test(spec.name),
      openWorldHint: false,
    },
  };
}

export function listMcpTools(): Tool[] {
  return [
    {
      name: STATUS_TOOL,
      description:
        "Whether a PaperOS tab is connected to this bridge. Call it first when another tool says no tab is connected.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ...bridgeTools().map(toMcpTool),
  ];
}

function text(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
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
      tab: info ? { client: info.client, apiVersion: info.apiVersion, tools: info.tools.length } : null,
      hint: info ? undefined : NO_TAB_ERROR,
    });
  }
  const dotted = fromMcpName(name);
  if (!dotted) return failure(`Unknown tool "${name}"`);
  try {
    const result = await bridge.call(dotted, args ?? {});
    if (dotted === "canvas.screenshot" && isScreenshot(result)) {
      const [, mimeType, data] = result.dataUrl.match(/^data:([^;]+);base64,(.*)$/) ?? [];
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

function isScreenshot(v: unknown): v is { dataUrl: string; width: number; height: number } {
  return typeof v === "object" && v !== null && typeof (v as { dataUrl?: unknown }).dataUrl === "string";
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
        "PaperOS and turn on \"Agent bridge\" in the top bar, then call bridge_status.",
      ].join(" "),
    }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listMcpTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    runMcpTool(bridge, request.params.name, request.params.arguments as Record<string, unknown> | undefined)
  );
  return server;
}
