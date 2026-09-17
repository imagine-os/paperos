/**
 * Tools the CLI runs itself, on the user's machine, instead of forwarding
 * to the tab: things a browser tab cannot do. They are reachable two ways:
 * as MCP tools for the agent (`browser_fetch`, ...) and through the bridge's
 * `request` messages for the PaperOS tab (the Browser window's "Screenshot
 * via bridge", the Terminal's bridge shell).
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface LocalToolContext {
  log: (line: string) => void;
  /** Pushes a message to the connected tab (streams); false when no tab. */
  push: (message: unknown) => boolean;
}

export interface LocalTool {
  /** Dotted name (`browser.fetch`); the MCP name replaces dots with underscores. */
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  readOnly?: boolean;
  /** Only for the tab (not listed as an MCP tool). */
  tabOnly?: boolean;
  run(args: Record<string, unknown>, ctx: LocalToolContext): Promise<unknown>;
}

export class LocalTools {
  private readonly tools = new Map<string, LocalTool>();

  constructor(private readonly ctx: LocalToolContext) {}

  register(tool: LocalTool): void {
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): LocalTool | undefined {
    return this.tools.get(name);
  }

  list(): LocalTool[] {
    return [...this.tools.values()];
  }

  async run(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown local tool "${name}"`);
    return tool.run(args ?? {}, this.ctx);
  }
}

export function str(
  args: Record<string, unknown>,
  key: string,
  required = true
): string {
  const v = args[key];
  if (typeof v === "string" && v.length > 0) return v;
  if (required) throw new Error(`${key} must be a non-empty string`);
  return "";
}

export function num(
  args: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
