import type { Editor } from "tldraw";
import {
  registerCommands,
  registerCommandSource,
  type Command,
} from "@/ide/commands";
import { openFile } from "@/ide/open-file";
import { getProjectStore } from "@/ide/project";
import { toggleTheme } from "@/ide/theme";
import { PRESETS } from "@/wm/presets";
import type { Side } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { createWindow } from "./create-window";
import { applyIdeWorkspace } from "./ide-workspace";
import {
  canOpenFolder,
  importGithubProject,
  importZipProject,
  openFolderProject,
  openSampleProject,
} from "./project-actions";
import { listWindowKinds } from "./window-kinds";
import { getWorkspaceStore } from "./workspaces";

const SIDES: [Side, string][] = [
  ["left", "left"],
  ["right", "right"],
  ["top", "up"],
  ["bottom", "down"],
];

/**
 * Registers every command the palette offers: window-manager actions, new
 * windows per kind, project opening, theme, and dynamic sources for files
 * and workspaces. Returns a disposer.
 */
export function registerIdeCommands(editor: Editor): () => void {
  const wm = () => getWindowManager(editor);
  const list: Command[] = [];

  for (const kind of listWindowKinds()) {
    if (kind.hidden) continue;
    list.push({
      id: `window.new.${kind.id}`,
      title: `New ${kind.label} window`,
      group: "Window",
      keywords: "open create",
      shortcut: kind.id === "note" ? "Alt+N" : undefined,
      run: () => void createWindow(editor, { kind: kind.id }),
    });
  }

  for (const p of PRESETS) {
    list.push({
      id: `layout.${p.id}`,
      title: `Layout: ${p.label}`,
      group: "Layout",
      keywords: "tile arrange",
      run: () => wm().applyPreset(p.id),
    });
  }
  list.push(
    {
      id: "layout.tile-all",
      title: "Tile all windows",
      group: "Layout",
      run: () => wm().tileAll(),
    },
    {
      id: "layout.untile-all",
      title: "Untile all windows",
      group: "Layout",
      run: () => wm().untileAll(),
    },
    {
      id: "layout.show",
      title: "Show layout region",
      group: "Layout",
      run: () => wm().showRegion(),
    },
    {
      id: "layout.ide",
      title: "Apply IDE workspace",
      group: "Layout",
      keywords: "reset default",
      run: () => void applyIdeWorkspace(editor),
    }
  );

  for (const [side, name] of SIDES) {
    list.push(
      {
        id: `window.focus.${name}`,
        title: `Focus window ${name}`,
        group: "Window",
        shortcut: `Alt+${cap(name)}`,
        run: () => wm().moveFocus(side),
      },
      {
        id: `window.swap.${name}`,
        title: `Swap window ${name}`,
        group: "Window",
        shortcut: `Alt+Shift+${cap(name)}`,
        run: () => wm().swapFocused(side),
      }
    );
  }
  list.push(
    {
      id: "window.toggle-tile",
      title: "Tile / float focused window",
      group: "Window",
      shortcut: "Alt+Enter",
      run: () => {
        const id = wm().getFocusedId();
        if (id) wm().toggleTile(id);
      },
    },
    {
      id: "window.focus-mode",
      title: "Focus mode (zoom to window)",
      group: "Window",
      shortcut: "Alt+F",
      run: () => wm().focusMode(),
    },
    {
      id: "window.close",
      title: "Close focused window",
      group: "Window",
      run: () => {
        const id = wm().getFocusedId();
        if (id) editor.deleteShape(id);
      },
    }
  );

  list.push(
    {
      id: "project.open-folder",
      title: "Open folder...",
      group: "Project",
      keywords: "directory disk",
      run: () =>
        void (canOpenFolder()
          ? openFolderProject()
          : window.alert(
              "Folder access needs a Chromium browser. Use Import ZIP instead."
            )),
    },
    {
      id: "project.open-sample",
      title: "Open sample project",
      group: "Project",
      run: () => void openSampleProject(),
    },
    {
      id: "project.import-zip",
      title: "Import ZIP...",
      group: "Project",
      run: () => void importZipProject(),
    },
    {
      id: "project.import-github",
      title: "Import GitHub repository...",
      group: "Project",
      keywords: "clone url",
      run: () => void importGithubProject(),
    }
  );

  list.push({
    id: "view.toggle-theme",
    title: "Toggle light / dark theme",
    group: "View",
    keywords: "dark light mode appearance",
    run: () => {
      toggleTheme();
    },
  });

  const offStatic = registerCommands(list);

  const offFiles = registerCommandSource(() => {
    const store = getProjectStore();
    const project = store.getActiveId();
    const session = store.peekSession(project);
    if (!project || !session) return [];
    return session.files
      .get()
      .filter((f) => f.type === "file")
      .map((f) => ({
        id: `file.open.${f.path}`,
        title: f.path,
        group: "File",
        keywords: "open edit",
        run: () => void openFile(editor, { project, path: f.path }),
      }));
  });

  const offWorkspaces = registerCommandSource(() => {
    const store = getWorkspaceStore();
    return store.list().map((ws) => ({
      id: `workspace.${ws.id}`,
      title: `Workspace: ${ws.name}`,
      group: "Workspace",
      keywords: "switch",
      run: () => {
        if (ws.id === "ws_ide" || (ws.name === "IDE" && !ws.root)) {
          void applyIdeWorkspace(editor);
          return;
        }
        store.setActive(ws.id);
        wm().applyWorkspace(ws);
      },
    }));
  });

  const offProjects = registerCommandSource(() =>
    getProjectStore()
      .list()
      .map((p) => ({
        id: `project.switch.${p.id}`,
        title: `Switch to project: ${p.name}`,
        group: "Project",
        run: () => void getProjectStore().setActive(p.id),
      }))
  );

  return () => {
    offStatic();
    offFiles();
    offWorkspaces();
    offProjects();
  };
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
