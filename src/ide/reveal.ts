import { signal } from "./signal";

/** A request to scroll an editor to a line (from Connections and the Canvas API). */
export interface RevealRequest {
  project: string;
  path: string;
  line: number;
  seq: number;
}

export const revealRequest = signal<RevealRequest | null>(null);

let seq = 0;

/** Asks the editor showing `path` to put the cursor on `line` (1-based). */
export function revealLine(project: string, path: string, line: number): void {
  revealRequest.set({ project, path, line, seq: ++seq });
}
