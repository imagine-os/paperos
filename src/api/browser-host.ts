/**
 * The Canvas API host for the browser: tldraw editor + window manager +
 * the IDE stores. Kept free of validation (the facade does that) so it is
 * a thin translation layer.
 */
import type { Editor, TLShapeId } from "tldraw";
import { createWindow } from "@/desktop/create-window";
import {
  openDataWindow,
  openConnectionsWindow,
  openSchemaWindow,
} from "@/desktop/kinds/data-common";
import { applyPresetWorkspace } from "@/desktop/preset-workspaces";
import { describeStep } from "@/data/migrate";
import { getDataStore, scanProjectBindings } from "@/data/project-fs";
import { listWindowKinds } from "@/desktop/window-kinds";
import type { WindowShape } from "@/desktop/window-shape";
import { connectWindows, disconnectWindows, listFlows } from "@/desktop/flow";
import { createSection, getSection, listSections } from "@/desktop/sections";
import { getWorkspaceStore } from "@/desktop/workspaces";
import { generateMap } from "@/map/generate";
import { listCommands, runCommand } from "@/ide/commands";
import {
  clearConsole,
  pushConsole,
  type ConsoleLevel,
} from "@/ide/console-store";
import { closeFileDoc, readLiveText, writeLiveText } from "@/ide/docs";
import { openFile } from "@/ide/open-file";
import { reloadPreviews } from "@/ide/preview/preview-state";
import { getProjectStore } from "@/ide/project/store";
import type { ProjectMeta } from "@/ide/project/types";
import { swapWindows } from "@/wm/operations";
import { getWindowManager } from "@/wm/window-manager";
import type { CanvasHost, ProjectRecord, WindowRecord } from "./host";

/** Windows inside a section (frame) have parent-relative x/y; the API speaks page space. */
function record(editor: Editor, s: WindowShape): WindowRecord {
  const b = editor.getShapePageBounds(s.id);
  return {
    id: s.id,
    kind: s.props.kind,
    title: s.props.title,
    content: s.props.content,
    x: b ? b.x : s.x,
    y: b ? b.y : s.y,
    w: s.props.w,
    h: s.props.h,
    tiled: s.props.tiled,
    section: s.parentId.startsWith("shape:") ? s.parentId : null,
  };
}

function project(meta: ProjectMeta): ProjectRecord {
  return {
    id: meta.id,
    name: meta.name,
    source: meta.source,
    backend: meta.backend,
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function createBrowserHost(editor: Editor): CanvasHost {
  const wm = getWindowManager(editor);
  const projects = getProjectStore();
  const workspaces = getWorkspaceStore();
  const sid = (id: string) => id as TLShapeId;

  const windowsOfKind = (kind: string) =>
    wm.getWindows().filter((w) => w.props.kind === kind);

  return {
    windows: {
      list: () =>
        editor
          .getCurrentPageShapesSorted()
          .filter((s): s is WindowShape => s.type === "window")
          .map((s) => record(editor, s)),
      get(id) {
        const w = wm.getWindow(sid(id));
        return w ? record(editor, w) : undefined;
      },
      kinds: () => listWindowKinds().map((k) => k.id),
      create(options) {
        const id = createWindow(editor, {
          kind: options.kind,
          title: options.title,
          content: options.content,
          at: options.at,
        });
        if (options.size) {
          editor.updateShape<WindowShape>({
            id,
            type: "window",
            props: { w: options.size.w, h: options.size.h },
          });
        }
        return id;
      },
      update(id, patch) {
        const { x, y, ...props } = patch;
        const shape = wm.getWindow(sid(id));
        let position: { x?: number; y?: number } = {};
        if (shape && (x !== undefined || y !== undefined)) {
          const page = wm.pageRect(shape);
          const local = editor.getPointInParentSpace(shape.id, {
            x: x ?? page.x,
            y: y ?? page.y,
          });
          position = { x: local.x, y: local.y };
        }
        editor.updateShape<WindowShape>({
          id: sid(id),
          type: "window",
          ...position,
          props,
        });
      },
      close: (id) => editor.deleteShape(sid(id)),
      focus: (id) => wm.focusWindow(sid(id)),
      focusedId: () => wm.getFocusedId(),
    },

    layout: {
      preset: () => wm.preset.get(),
      root: () => wm.root.get(),
      region: () => wm.region.get(),
      applyPreset: (p) => wm.applyPreset(p),
      tile: (id, side, target) =>
        wm.tileWindow(sid(id), side, target ? sid(target) : undefined),
      tileAll: () => wm.tileAll(),
      float: (id) => wm.floatWindow(sid(id)),
      untileAll: () => wm.untileAll(),
      swap(a, b) {
        editor.markHistoryStoppingPoint("wm swap");
        wm.root.set(swapWindows(wm.root.get(), a, b));
        wm.apply();
      },
    },

    workspaces: {
      list: () =>
        workspaces.list().map((w) => ({
          id: w.id,
          name: w.name,
          preset: w.preset,
          windowIds: w.windowIds,
        })),
      activeId: () => wm.activeWorkspaceId.get(),
      save(name) {
        const existing = workspaces
          .list()
          .find((w) => w.name.toLowerCase() === name.toLowerCase());
        const ws = existing
          ? workspaces.save(existing.id, wm.snapshot())!
          : workspaces.create(name, wm.snapshot());
        workspaces.setActive(ws.id);
        wm.activeWorkspaceId.set(ws.id);
        return {
          id: ws.id,
          name: ws.name,
          preset: ws.preset,
          windowIds: ws.windowIds,
        };
      },
      apply(id) {
        if (applyPresetWorkspace(editor, id)) return;
        const ws = workspaces.get(id);
        if (!ws) return;
        workspaces.setActive(id);
        wm.applyWorkspace(ws);
      },
      rename: (id, name) => workspaces.rename(id, name),
      remove(id) {
        workspaces.remove(id);
        if (wm.activeWorkspaceId.get() === id) wm.activeWorkspaceId.set(null);
      },
    },

    projects: {
      list: () => projects.list().map(project),
      activeId: () => projects.getActiveId(),
      setActive: (id) => projects.setActive(id),
      openSample: async () => project(await projects.createSampleProject()),
      importGithub: async (url) =>
        project((await projects.importGithub(url)).meta),
    },

    files: {
      async list(p) {
        const s = await projects.session(p);
        if (!s?.backend) throw new Error("Project is not accessible");
        return s.files.get().map((f) => ({ path: f.path, type: f.type }));
      },
      async read(p, path) {
        const text = await readLiveText(p, path, projects);
        if (text === null) throw new Error(`Cannot read "${path}"`);
        return text;
      },
      write: (p, path, text) => writeLiveText(p, path, text, projects),
      create: (p, path, text) => projects.createFile(p, path, text),
      async remove(p, path) {
        await projects.deleteEntry(p, path);
        closeFileDoc(p, path);
      },
      async rename(p, from, to) {
        await projects.renameEntry(p, from, to);
        closeFileDoc(p, from);
      },
      open: (p, path, kind) => openFile(editor, { project: p, path }, { kind }),
    },

    data: {
      tables: (p) => getDataStore(p, projects).tables(),
      async schema(p) {
        const store = getDataStore(p, projects);
        return {
          tables: (await store.schema()).tables,
          errors: await store.schemaErrors(),
        };
      },
      async setSchema(p, schema, renames) {
        const steps = await getDataStore(p, projects).setSchema(
          schema,
          renames
        );
        return steps.map(describeStep);
      },
      list: (p, table, options) =>
        getDataStore(p, projects).query(table, options),
      get: (p, table, id) => getDataStore(p, projects).get(table, id),
      insert: (p, table, row) => getDataStore(p, projects).insert(table, row),
      update: (p, table, id, patch) =>
        getDataStore(p, projects).update(table, id, patch),
      remove: (p, table, id, onReferences) =>
        getDataStore(p, projects).remove(table, id, { onReferences }),
      bindings: (p) => scanProjectBindings(p, projects),
      open(_p, table, kind) {
        if (kind === "schema") return openSchemaWindow(editor, table);
        if (kind === "connections")
          return openConnectionsWindow(editor, table ? { table } : {});
        return openDataWindow(editor, table ? { table } : {});
      },
    },

    flow: {
      connect(from, to, label) {
        const id = connectWindows(editor, sid(from), sid(to), { label });
        return (
          listFlows(editor).find((f) => f.id === id) ?? {
            id,
            from,
            to,
            label: label ?? "",
          }
        );
      },
      disconnect: (a, b) =>
        disconnectWindows(editor, sid(a), b ? sid(b) : undefined),
      list: () => listFlows(editor),
    },

    sections: {
      create(title, windowIds) {
        const id = createSection(editor, title, windowIds.map(sid));
        return getSection(editor, id)!;
      },
      list: () => listSections(editor),
    },

    map: {
      generate: (_project, regenerate) => generateMap(editor, { regenerate }),
    },

    preview: {
      reload() {
        reloadPreviews();
        return windowsOfKind("preview").length;
      },
      setEntry(path) {
        const list = windowsOfKind("preview");
        if (list.length) {
          editor.updateShapes<WindowShape>(
            list.map((w) => ({
              id: w.id,
              type: "window",
              props: { content: path },
            }))
          );
        }
        return list.length;
      },
    },

    console: {
      log: (level, text) => pushConsole(level as ConsoleLevel, text),
      clear: () => clearConsole(),
    },

    commands: {
      list: () =>
        listCommands().map((c) => ({
          id: c.id,
          title: c.title,
          group: c.group,
          ...(c.shortcut ? { shortcut: c.shortcut } : {}),
        })),
      run: (id, args) => runCommand(id, args),
    },

    canvas: {
      camera() {
        const c = editor.getCamera();
        return { x: c.x, y: c.y, z: c.z };
      },
      // No animation: the returned camera must be the final one.
      setCamera: (c) => editor.setCamera(c),
      zoomTo(ids) {
        const bounds = ids
          .map((id) => editor.getShapePageBounds(sid(id)))
          .filter((b) => b !== undefined);
        if (bounds.length === 0) return;
        const union = bounds.reduce((a, b) => a.clone().union(b));
        editor.zoomToBounds(union, { inset: 32 });
      },
      async screenshot(ids, scale) {
        const { blob, width, height } = await editor.toImage(ids.map(sid), {
          format: "png",
          scale,
          background: true,
          padding: 16,
        });
        return { dataUrl: await blobToDataUrl(blob), width, height };
      },
    },
  };
}
