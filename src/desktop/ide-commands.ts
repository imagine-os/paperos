import type { Editor } from "tldraw";
import {
  registerCommands,
  registerCommandSource,
  type Command,
} from "@/ide/commands";
import { parseFileRef } from "@/ide/file-ref";
import { openFile } from "@/ide/open-file";
import { getProjectStore } from "@/ide/project";
import { toggleTheme } from "@/ide/theme";
import { PRESETS } from "@/wm/presets";
import type { Side } from "@/wm/types";
import { getWindowManager } from "@/wm/window-manager";
import { generateMap } from "@/map/generate";
import {
  boardsOnCanvas,
  listBoards,
  openBoard,
  readBoard,
} from "@/boards/build";
import { getTourController } from "@/boards/tour-controller";
import { getCollabSession } from "@/collab/session";
import { lineagePages, openLineage } from "@/lineage/open";
import { createWindow } from "./create-window";
import { applyDataWorkspace } from "./data-workspace";
import { applyDesignWorkspace } from "./design-workspace";
import { createSection } from "./sections";
import { applyIdeWorkspace } from "./ide-workspace";
import {
  openConnectionsWindow,
  openKindWindow,
  parseContent,
} from "./kinds/data-common";
import { createState as createBrowserState } from "@/browser/tabs";
import { applyPresetWorkspace } from "./preset-workspaces";
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
    },
    {
      id: "layout.data",
      title: "Apply Data workspace",
      group: "Layout",
      keywords: "tables schema connections",
      run: () => void applyDataWorkspace(editor),
    },
    {
      id: "layout.design",
      title: "Apply Design workspace",
      group: "Layout",
      keywords: "tokens components pages builder",
      run: () => void applyDesignWorkspace(editor),
    }
  );

  const openShare = () => openKindWindow(editor, "share", "", { reuse: true });
  list.push(
    {
      id: "share.open",
      title: "Share: open the Share window",
      group: "Share",
      keywords: "collaborate room live multiplayer",
      run: () => void openShare(),
    },
    {
      id: "share.create",
      title: "Share: create a room",
      group: "Share",
      keywords: "collaborate room live multiplayer invite",
      run: async () => {
        openShare();
        await getCollabSession().create();
      },
    },
    {
      id: "share.join",
      title: "Share: join a room...",
      group: "Share",
      keywords: "collaborate room live multiplayer link",
      run: async () => {
        const text = window.prompt("Room id or link");
        if (!text?.trim()) return;
        if (
          !window.confirm(
            `Join room "${text.trim()}"?\n\nIts canvas and project replace what you see here. Your own project stays in the Open menu.`
          )
        )
          return;
        openShare();
        await getCollabSession().join(text);
      },
    },
    {
      id: "share.copy-link",
      title: "Share: copy the room link",
      group: "Share",
      keywords: "collaborate invite",
      run: async () => {
        const link = getCollabSession().state.get().link;
        if (!link) return;
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          window.prompt("Room link", link);
        }
      },
    },
    {
      id: "share.leave",
      title: "Share: leave the room",
      group: "Share",
      keywords: "collaborate disconnect",
      run: () => void getCollabSession().leave(),
    }
  );

  list.push({
    id: "data.connections-for-file",
    title: "Show connections for current file",
    group: "Data",
    keywords: "bindings tables usage",
    run: () => {
      const id = wm().getFocusedId();
      const w = id ? wm().getWindow(id) : undefined;
      if (!w) return;
      const ref = parseFileRef(w.props.content);
      if (ref) {
        openConnectionsWindow(editor, { source: ref.path });
        return;
      }
      if (w.props.kind === "data") {
        const table = parseContent<{ table?: string }>(w.props.content).table;
        openConnectionsWindow(editor, table ? { table } : {});
        return;
      }
      openConnectionsWindow(editor, {});
    },
  });

  const openBrowser = (url: string, title: string) =>
    openKindWindow(editor, "browser", createBrowserState(url), { title });
  list.push(
    {
      id: "browser.open-preview",
      title: "Open the Preview in the Browser window",
      group: "Browser",
      keywords: "web tabs url site page",
      run: () => void openBrowser("paperos://preview/", "Browser"),
    },
    {
      id: "browser.open-docs",
      title: "Open the PaperOS docs in the Browser window",
      group: "Browser",
      keywords: "readme canvas api mcp plan help",
      run: () => void openBrowser("paperos://docs/README.md", "Browser: docs"),
    },
    {
      id: "browser.open-landing",
      title: "Open the PaperOS landing page in the Browser window",
      group: "Browser",
      keywords: "home site",
      run: () => void openBrowser("paperos://home", "Browser"),
    }
  );

  list.push(
    {
      id: "terminal.open",
      title: "Open a Terminal (project shell)",
      group: "Terminal",
      keywords: "shell command line console cli",
      run: () =>
        void openKindWindow(
          editor,
          "terminal",
          JSON.stringify({ backend: "project" }),
          { title: "Terminal", reuse: false }
        ),
    },
    {
      id: "terminal.open-here",
      title: "Open a Terminal in the current file's folder",
      group: "Terminal",
      keywords: "shell cd folder directory",
      run: () => {
        const id = wm().getFocusedId();
        const w = id ? wm().getWindow(id) : undefined;
        const ref = w ? parseFileRef(w.props.content) : null;
        const dir = ref ? ref.path.split("/").slice(0, -1).join("/") : "";
        void openKindWindow(
          editor,
          "terminal",
          JSON.stringify({
            backend: "project",
            run: dir ? [`cd /${dir}`] : [],
          }),
          { title: dir ? `Terminal: /${dir}` : "Terminal", reuse: false }
        );
      },
    }
  );

  list.push(
    {
      id: "map.generate",
      title: "Generate project map",
      group: "Map",
      keywords: "flowchart overview sections arrows board",
      run: () => void generateMap(editor),
    },
    {
      id: "map.regenerate",
      title: "Regenerate project map (keep positions)",
      group: "Map",
      keywords: "flowchart refresh update",
      run: () => void generateMap(editor, { regenerate: true }),
    },
    {
      id: "section.from-selection",
      title: "Group selected windows into a section",
      group: "Map",
      keywords: "frame group flowchart",
      run: () => {
        const ids = editor
          .getSelectedShapes()
          .filter((s) => s.type === "window")
          .map((s) => s.id);
        const focused = wm().getFocusedId();
        const members = ids.length ? ids : focused ? [focused] : [];
        if (!members.length) {
          window.alert("Select one or more windows first.");
          return;
        }
        const title = window.prompt("Section title:", "Section");
        if (!title) return;
        const id = createSection(editor, title.trim(), members);
        editor.select(id);
      },
    },
    {
      id: "section.from-workspace",
      title: "Section from workspace (frame the tiled windows)",
      group: "Map",
      keywords: "frame layout region",
      run: () => {
        const ids = wm().getTiledIds();
        if (!ids.length) {
          window.alert("No tiled windows: apply a layout first.");
          return;
        }
        const active = wm().activeWorkspaceId.get();
        const name = active ? getWorkspaceStore().get(active)?.name : undefined;
        const title = window.prompt("Section title:", name ?? "Workspace");
        if (!title) return;
        const region = wm().region.get();
        const id = createSection(
          editor,
          title.trim(),
          ids,
          region ?? undefined
        );
        editor.select(id);
      },
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
      id: "project.open-saas",
      title: "Open sample: Small Business SaaS",
      group: "Project",
      keywords: "template tenant multi-tenant showcase",
      run: () => void openSampleProject("saas"),
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
        if (applyPresetWorkspace(editor, ws.id)) return;
        store.setActive(ws.id);
        wm().applyWorkspace(ws);
      },
    }));
  });

  // Boards of the active project: open and play. The list is refreshed on demand.
  let boardNames: { name: string; title: string }[] = [];
  let pageNames: { name: string; title: string }[] = [];
  const refreshBoards = () => {
    const project = getProjectStore().getActiveId();
    if (!project) {
      boardNames = [];
      pageNames = [];
      return;
    }
    void listBoards(project, editor).then((list) => {
      boardNames = list.map((b) => ({ name: b.name, title: b.title }));
    });
    void lineagePages(project).then((list) => {
      pageNames = list;
    });
  };
  refreshBoards();
  const offBoardRefresh = getProjectStore().changes.subscribe(refreshBoards);
  const offBoardProject = getProjectStore().state.subscribe(refreshBoards);
  const offBoards = registerCommandSource(() => [
    ...boardNames.map((b) => ({
      id: `board.open.${b.name}`,
      title: `Open board: ${b.title}`,
      group: "Boards",
      keywords: "board flow sections arrange",
      run: () => {
        const project = getProjectStore().getActiveId();
        if (!project) return;
        void readBoard(project, b.name).then((board) =>
          openBoard(editor, board, { project })
        );
      },
    })),
    ...boardNames.map((b) => ({
      id: `board.play.${b.name}`,
      title: `Play board: ${b.title}`,
      group: "Boards",
      keywords: "tour present camera",
      run: () => {
        const project = getProjectStore().getActiveId();
        if (!project) return;
        void readBoard(project, b.name).then((board) => {
          if (!boardsOnCanvas(editor).includes(b.name))
            openBoard(editor, board, { project });
          getTourController(editor).play(board);
        });
      },
    })),
    {
      id: "board.stop",
      title: "Stop board tour",
      group: "Boards",
      run: () => void getTourController(editor).stop(),
    },
    {
      id: "lineage.open",
      title: "Data lineage",
      group: "Boards",
      keywords: "data lineage tables components pages sources bindings",
      run: () => {
        const project = getProjectStore().getActiveId();
        if (project) void openLineage(editor, { project });
      },
    },
    ...pageNames.map((p) => ({
      id: `lineage.open.${p.name}`,
      title: `Data lineage for ${p.title}`,
      group: "Boards",
      keywords: "data lineage page sources bindings",
      run: () => {
        const project = getProjectStore().getActiveId();
        if (project) void openLineage(editor, { project, page: p.name });
      },
    })),
  ]);

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
    offBoards();
    offBoardRefresh();
    offBoardProject();
    offProjects();
  };
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
