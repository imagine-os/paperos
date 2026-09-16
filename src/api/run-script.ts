/**
 * Runs user scripts for the script console. The script body becomes an
 * async function with `paperos` (the Canvas API) and a capturing `console`
 * in scope, so top-level `await` works. Scripts run in the page with the
 * page's privileges: this is the user's own browser, like the devtools.
 */
export interface ScriptLine {
  level: "log" | "info" | "warn" | "error" | "debug" | "result";
  text: string;
}

export interface ScriptResult {
  ok: boolean;
  /** The value of the last `return`, formatted (only when `ok`). */
  value?: string;
  /** Error message (only when not `ok`). */
  error?: string;
  lines: ScriptLine[];
  ms: number;
}

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (
  ...args: string[]
) => (...a: unknown[]) => Promise<unknown>;

/** JSON for objects (indented), String() for the rest; never throws. */
export function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "function")
    return `[function ${value.name || "anonymous"}]`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function formatArgs(args: unknown[]): string {
  return args.map(formatValue).join(" ");
}

export async function runScript(
  code: string,
  scope: Record<string, unknown>,
  onLine?: (line: ScriptLine) => void,
  now: () => number = () => performance.now()
): Promise<ScriptResult> {
  const lines: ScriptLine[] = [];
  const push = (level: ScriptLine["level"], text: string) => {
    const line = { level, text };
    lines.push(line);
    onLine?.(line);
  };
  const capturedConsole = {
    log: (...a: unknown[]) => push("log", formatArgs(a)),
    info: (...a: unknown[]) => push("info", formatArgs(a)),
    warn: (...a: unknown[]) => push("warn", formatArgs(a)),
    error: (...a: unknown[]) => push("error", formatArgs(a)),
    debug: (...a: unknown[]) => push("debug", formatArgs(a)),
    table: (...a: unknown[]) => push("log", formatArgs(a)),
    dir: (...a: unknown[]) => push("log", formatArgs(a)),
  };
  const names = ["console", ...Object.keys(scope)];
  const values = [capturedConsole, ...Object.values(scope)];
  const start = now();
  try {
    const fn = new AsyncFunction(...names, `"use strict";\n${code}`);
    const value = await fn(...values);
    const formatted = formatValue(value);
    if (value !== undefined) push("result", formatted);
    return { ok: true, value: formatted, lines, ms: now() - start };
  } catch (e) {
    const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    push("error", error);
    return { ok: false, error, lines, ms: now() - start };
  }
}
