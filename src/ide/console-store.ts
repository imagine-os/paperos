import { signal } from "./signal";

export type ConsoleLevel =
  "log" | "info" | "warn" | "error" | "debug" | "result" | "system";

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  text: string;
  time: number;
}

const MAX_ENTRIES = 500;
let nextId = 1;

/** Output from the preview iframe(s), shown by Console windows. */
export const consoleEntries = signal<ConsoleEntry[]>([]);

/** Set by the most recent Preview window; runs a snippet inside its iframe. */
export const consoleEvalTarget = signal<((code: string) => void) | null>(null);

export function pushConsole(level: ConsoleLevel, text: string): void {
  consoleEntries.update((list) => {
    const next = [...list, { id: nextId++, level, text, time: Date.now() }];
    return next.length > MAX_ENTRIES
      ? next.slice(next.length - MAX_ENTRIES)
      : next;
  });
}

export function clearConsole(): void {
  consoleEntries.set([]);
}

/** Message shape the preview bridge posts to the parent window. */
export interface PreviewMessage {
  source: "paperos-preview";
  type: "console" | "ready" | "navigate";
  level?: ConsoleLevel;
  args?: string[];
  /** navigate: the `#/route` a link pointed at and the page it names, if any. */
  route?: string;
  page?: string | null;
}

export function isPreviewMessage(data: unknown): data is PreviewMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as PreviewMessage).source === "paperos-preview"
  );
}
