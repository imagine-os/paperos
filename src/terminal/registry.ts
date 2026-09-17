/**
 * Terminal sessions by window id. The Terminal window component and the
 * Canvas API host share these, so `paperos.terminal.run()` reaches the
 * same shell the window shows.
 */
import type { Editor } from "tldraw";
import { getBridgeClient } from "@/api/bridge-client";
import { signal } from "@/ide/signal";
import { getProjectStore } from "@/ide/project/store";
import { desktopShellHost } from "./desktop-shell-host";
import { memoryShellFs } from "./fs";
import { projectShellFs } from "./project-shell-fs";
import { ProjectShell, type ShellHost } from "./shell";
import { TerminalSession } from "./session";

const sessions = new Map<string, TerminalSession>();

/** Bumps when sessions are created or disposed. */
export const terminalsChanged = signal(0);

const NO_PROJECT_HOST: ShellHost = {
  openFile: () => {},
  preview: () => {},
  openData: () => {},
  openBoard: () => {},
  layout: () => {},
  api: async () => {
    throw new Error("No project is open");
  },
  evalJs: async () => {
    throw new Error("No project is open");
  },
};

export function getTerminalSession(
  editor: Editor,
  windowId: string
): TerminalSession {
  const existing = sessions.get(windowId);
  if (existing) return existing;
  const store = getProjectStore();
  const project = store.getActiveId();
  const meta = project ? store.get(project) : undefined;
  const shell = project
    ? new ProjectShell(
        projectShellFs(project, store),
        desktopShellHost(editor, project)
      )
    : new ProjectShell(memoryShellFs(), NO_PROJECT_HOST);
  const session = new TerminalSession(
    windowId,
    shell,
    getBridgeClient(),
    meta?.name ?? null
  );
  sessions.set(windowId, session);
  terminalsChanged.update((n) => n + 1);
  return session;
}

export function peekTerminalSession(
  windowId: string
): TerminalSession | undefined {
  return sessions.get(windowId);
}

export function listTerminalSessions(): TerminalSession[] {
  return [...sessions.values()];
}

export function disposeTerminalSession(windowId: string): void {
  const s = sessions.get(windowId);
  if (!s) return;
  s.dispose();
  sessions.delete(windowId);
  terminalsChanged.update((n) => n + 1);
}
