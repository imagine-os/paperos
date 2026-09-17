/**
 * Wires the Canvas API into a mounted desktop: builds the host, the event
 * bus and the facade, forwards editor / window-manager / store changes as
 * events, and exposes the API as `window.paperos` for the devtools.
 */
import { react, type Editor } from "tldraw";
import type { WindowShape } from "@/desktop/window-shape";
import { getDataStore } from "@/data/project-fs";
import { onCommandRun } from "@/ide/commands";
import { getProjectStore } from "@/ide/project/store";
import { collectWindowIds } from "@/wm/tree";
import { getWindowManager } from "@/wm/window-manager";
import { getTourController } from "@/boards/tour-controller";
import { getCollabSession } from "@/collab/session";
import { createBrowserHost } from "./browser-host";
import { createCanvasApi, type CanvasApi } from "./canvas-api";
import { createEventBus, type EventBus } from "./events";

declare global {
  interface Window {
    /** The Canvas API (see docs/CANVAS_API.md). Available once the desktop has mounted. */
    paperos?: CanvasApi;
  }
}

export interface InstalledApi {
  api: CanvasApi;
  events: EventBus;
  dispose(): void;
}

let current: InstalledApi | null = null;

/** The API installed by the mounted desktop, if any. */
export function getCanvasApi(): CanvasApi | null {
  return current?.api ?? null;
}

export function installCanvasApi(editor: Editor): InstalledApi {
  if (current) current.dispose();
  const events = createEventBus();
  const api = createCanvasApi(createBrowserHost(editor), events);
  const wm = getWindowManager(editor);
  const projects = getProjectStore();
  const offs: (() => void)[] = [];

  const summary = (s: WindowShape) => ({
    id: s.id,
    kind: s.props.kind,
    title: s.props.title,
  });

  offs.push(
    editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
      if (shape.type === "window")
        events.emit("window.created", summary(shape as WindowShape));
    }),
    editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
      if (shape.type === "window")
        events.emit("window.closed", summary(shape as WindowShape));
    })
  );

  let lastFocused: string | null = wm.focusedId.get();
  offs.push(
    react("api.focus", () => {
      const id = wm.focusedId.get();
      if (id === lastFocused) return;
      lastFocused = id;
      if (id) {
        const w = wm.getWindow(id);
        if (w) events.emit("window.focused", summary(w));
      }
    })
  );

  let lastLayout = JSON.stringify([wm.preset.get(), wm.root.get()]);
  offs.push(
    react("api.layout", () => {
      const preset = wm.preset.get();
      const root = wm.root.get();
      const key = JSON.stringify([preset, root]);
      if (key === lastLayout) return;
      lastLayout = key;
      events.emit("layout.changed", { preset, tiled: collectWindowIds(root) });
    })
  );

  offs.push(
    projects.lastChange.subscribe(() => {
      const c = projects.lastChange.get();
      if (c) events.emit("file.changed", { ...c });
    })
  );

  let lastProject = projects.getActiveId();
  offs.push(
    projects.state.subscribe(() => {
      const id = projects.getActiveId();
      if (id === lastProject) return;
      lastProject = id;
      const meta = id ? projects.get(id) : undefined;
      events.emit("project.changed", { id, name: meta?.name ?? null });
    })
  );

  offs.push(onCommandRun((id) => events.emit("command.run", { id })));

  // tour.changed: each step of a board tour (and its end).
  const tour = getTourController(editor);
  let lastTour = "";
  offs.push(
    react("api.tour", () => {
      const t = tour.state.get();
      const key = t ? `${t.board}:${t.step}` : "";
      if (key === lastTour) return;
      lastTour = key;
      events.emit(
        "tour.changed",
        t
          ? { board: t.board, step: t.step, total: t.total, section: t.section }
          : { board: null, step: -1 }
      );
    })
  );

  // collab.changed: joining, leaving, peers coming and going.
  const collab = getCollabSession();
  let lastRoom = "";
  offs.push(
    collab.state.subscribe(() => {
      const s = collab.state.get();
      const key = `${s.room}:${s.status}:${s.peers}`;
      if (key === lastRoom) return;
      lastRoom = key;
      events.emit("collab.changed", {
        room: s.room,
        status: s.status,
        peers: s.peers,
      });
    })
  );

  // data.changed follows the active project's DataStore.
  let offData: (() => void) | null = null;
  const watchData = () => {
    offData?.();
    offData = null;
    const id = projects.getActiveId();
    if (!id) return;
    const store = getDataStore(id, projects);
    offData = store.changed.subscribe(() =>
      events.emit("data.changed", { project: id })
    );
  };
  watchData();
  offs.push(projects.state.subscribe(watchData), () => offData?.());

  if (typeof window !== "undefined") window.paperos = api;

  const installed: InstalledApi = {
    api,
    events,
    dispose() {
      offs.forEach((f) => f());
      if (typeof window !== "undefined" && window.paperos === api)
        delete window.paperos;
      if (current === installed) current = null;
    },
  };
  current = installed;
  return installed;
}
