import type { CanvasApi } from "./canvas-api";
import { argsToPositional, getTool, type ToolSpec } from "./schema";

/**
 * Calls a Canvas API method by its dotted name with object-style arguments
 * (what the MCP bridge and other remote callers send). Arguments are mapped
 * onto the JS method's positional parameters using the schema.
 */
export async function invokeTool(
  api: CanvasApi,
  name: string,
  args: Record<string, unknown> | undefined
): Promise<unknown> {
  const tool = getTool(name) ?? fail(`Unknown tool "${name}"`);
  if (tool.browserOnly)
    fail(`"${name}" can only be called from a script in the page`);
  const fn = resolveMethod(api, tool);
  const positional = argsToPositional(tool, args);
  return await fn(...positional);
}

function resolveMethod(
  api: CanvasApi,
  tool: ToolSpec
): (...args: unknown[]) => unknown {
  const [ns, method] = tool.name.split(".");
  const target = (api as unknown as Record<string, Record<string, unknown>>)[
    ns
  ];
  const fn = target?.[method];
  if (typeof fn !== "function") fail(`"${tool.name}" is not implemented`);
  return (fn as (...a: unknown[]) => unknown).bind(target);
}

function fail(message: string): never {
  throw new Error(message);
}
