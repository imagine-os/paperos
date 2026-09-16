/**
 * The command registry behind the command palette (Ctrl+K). Commands are
 * plain objects; static ones are registered once, dynamic ones (open file by
 * name, switch workspace) come from sources that are asked when the palette
 * opens. M3 exposes this same registry through the Canvas API.
 */

export interface Command {
  id: string;
  title: string;
  /** Shown as a prefix in the palette ("Window", "Layout", "File"...). */
  group: string;
  /** Extra words that should match this command. */
  keywords?: string;
  shortcut?: string;
  /** Commands registered by scripts and plugins may take arguments. */
  run: (args?: Record<string, unknown>) => void | Promise<void>;
}

export type CommandSource = () => Command[];

const commands = new Map<string, Command>();
const sources = new Set<CommandSource>();

export function registerCommand(cmd: Command): () => void {
  commands.set(cmd.id, cmd);
  return () => void commands.delete(cmd.id);
}

export function registerCommands(list: Command[]): () => void {
  const offs = list.map(registerCommand);
  return () => offs.forEach((f) => f());
}

/** Registers a function that produces commands on demand (files, workspaces...). */
export function registerCommandSource(source: CommandSource): () => void {
  sources.add(source);
  return () => void sources.delete(source);
}

/** Static commands plus whatever the sources produce right now. */
export function listCommands(): Command[] {
  const all = [...commands.values()];
  for (const s of sources) all.push(...s());
  return all;
}

export function getCommand(id: string): Command | undefined {
  return listCommands().find((c) => c.id === id);
}

const runListeners = new Set<(id: string) => void>();

/** Called with the command id whenever `runCommand` runs one (the Canvas API's `command.run` event). */
export function onCommandRun(listener: (id: string) => void): () => void {
  runListeners.add(listener);
  return () => void runListeners.delete(listener);
}

export async function runCommand(
  id: string,
  args?: Record<string, unknown>
): Promise<boolean> {
  const cmd = getCommand(id);
  if (!cmd) return false;
  runListeners.forEach((l) => l(id));
  await cmd.run(args);
  return true;
}

/**
 * Subsequence fuzzy score: every query character must appear in order.
 * Higher is better; consecutive matches and word starts score more, and a
 * match on the title beats one on keywords or group. 0 means no match.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return 0;
    const wordStart = idx === 0 || /[\s\-_/.:]/.test(t[idx - 1]);
    streak = idx === ti ? streak + 1 : 0;
    score +=
      1 + streak * 2 + (wordStart ? 3 : 0) - Math.min(idx - ti, 10) * 0.1;
    ti = idx + 1;
  }
  return score + Math.max(0, 20 - t.length) * 0.05;
}

export function scoreCommand(query: string, cmd: Command): number {
  const title = fuzzyScore(query, cmd.title) * 2;
  const rest = fuzzyScore(query, `${cmd.group} ${cmd.keywords ?? ""}`);
  return Math.max(title, rest);
}

/** Commands matching `query`, best first. An empty query lists everything in registration order. */
export function searchCommands(
  query: string,
  list: Command[] = listCommands()
): Command[] {
  if (!query.trim()) return list;
  return list
    .map((cmd, i) => ({ cmd, i, s: scoreCommand(query.trim(), cmd) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.cmd);
}
