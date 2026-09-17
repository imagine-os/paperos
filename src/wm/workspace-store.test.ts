import { describe, expect, it } from "vitest";
import { leaf, split } from "./tree";
import { memoryStorage } from "./storage";
import {
  createWorkspaceStore,
  parseWorkspace,
  WORKSPACES_KEY,
  type WorkspaceSnapshot,
} from "./workspace-store";

const snapshot: WorkspaceSnapshot = {
  preset: "columns",
  root: split("horizontal", [leaf("shape:a"), leaf("shape:b")]),
  windowIds: ["shape:a", "shape:b"],
  region: { x: 0, y: 0, w: 1000, h: 600 },
  camera: { x: 10, y: 20, z: 1 },
};

describe("workspace store", () => {
  it("creates IDE, Data, Desk and Grid on first run", () => {
    const store = createWorkspaceStore(
      memoryStorage(),
      WORKSPACES_KEY,
      () => 5
    );
    expect(store.list().map((w) => [w.name, w.preset])).toEqual([
      ["IDE", "split-tree"],
      ["Data", "split-tree"],
      ["Desk", "free"],
      ["Grid", "grid"],
    ]);
    expect(store.getActiveId()).toBeNull();
  });

  it("creates, saves, renames, duplicates, deletes and persists", () => {
    const storage = memoryStorage();
    let t = 100;
    const store = createWorkspaceStore(storage, WORKSPACES_KEY, () => t);
    const ws = store.create("  Work  ", snapshot);
    expect(ws.name).toBe("Work");
    expect(store.getActiveId()).toBe(ws.id);
    expect(store.get(ws.id)?.root).toEqual(snapshot.root);

    t = 200;
    store.save(ws.id, { ...snapshot, preset: "grid" });
    expect(store.get(ws.id)).toMatchObject({ preset: "grid", updatedAt: 200 });
    expect(store.save("missing", snapshot)).toBeUndefined();

    store.rename(ws.id, "Focus");
    store.rename(ws.id, "   ");
    expect(store.get(ws.id)?.name).toBe("Focus");

    const copy = store.duplicate(ws.id)!;
    expect(copy.name).toBe("Focus copy");
    expect(copy.id).not.toBe(ws.id);
    const names = store.list().map((w) => w.name);
    expect(names.indexOf(copy.name)).toBe(names.indexOf("Focus") + 1);
    expect(store.duplicate("missing")).toBeUndefined();

    // Reload from the same storage.
    const again = createWorkspaceStore(storage, WORKSPACES_KEY, () => t);
    expect(again.list().map((w) => w.name)).toEqual([
      "IDE",
      "Data",
      "Desk",
      "Grid",
      "Focus",
      "Focus copy",
    ]);
    expect(again.getActiveId()).toBe(ws.id);

    again.remove(ws.id);
    expect(again.getActiveId()).toBeNull();
    expect(again.list().map((w) => w.name)).toEqual([
      "IDE",
      "Data",
      "Desk",
      "Grid",
      "Focus copy",
    ]);
  });

  it("notifies subscribers and allows unsubscribing", () => {
    const store = createWorkspaceStore(memoryStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.setActive("ws_grid");
    expect(calls).toBe(1);
    off();
    store.setActive(null);
    expect(calls).toBe(1);
  });

  it("falls back to defaults when the stored value is corrupt", () => {
    const storage = memoryStorage();
    storage.setItem(WORKSPACES_KEY, "{not json");
    expect(createWorkspaceStore(storage).list()).toHaveLength(4);
    storage.setItem(WORKSPACES_KEY, JSON.stringify({ version: 99 }));
    expect(createWorkspaceStore(storage).list()).toHaveLength(4);
  });

  it("drops invalid items and keeps valid ones", () => {
    const storage = memoryStorage();
    storage.setItem(
      WORKSPACES_KEY,
      JSON.stringify({
        version: 1,
        activeId: "gone",
        items: [
          { id: "ok", name: "Ok", preset: "grid", root: null },
          { id: "bad", name: "Bad", preset: "nope" },
          { id: "bad2", name: "Bad", preset: "grid", root: { type: "leaf" } },
        ],
      })
    );
    const store = createWorkspaceStore(storage);
    expect(store.list().map((w) => w.id)).toEqual(["ok"]);
    expect(store.getActiveId()).toBeNull();
  });

  it("works without any storage", () => {
    const store = createWorkspaceStore(null);
    const ws = store.create("Memory", snapshot);
    expect(store.get(ws.id)).toBeTruthy();
  });
});

describe("parseWorkspace", () => {
  it("validates trees, regions and cameras", () => {
    expect(parseWorkspace(null)).toBeNull();
    expect(parseWorkspace({ id: "x" })).toBeNull();
    const ok = parseWorkspace({
      id: "x",
      name: "X",
      preset: "split-tree",
      root: snapshot.root,
      windowIds: ["shape:a", 3],
      region: { x: 0, y: 0, w: 1 },
      camera: { x: 1, y: 2, z: 3 },
    })!;
    expect(ok.windowIds).toEqual(["shape:a"]);
    expect(ok.region).toBeNull();
    expect(ok.camera).toEqual({ x: 1, y: 2, z: 3 });
    expect(
      parseWorkspace({
        id: "x",
        name: "X",
        preset: "grid",
        root: {
          type: "split",
          id: "s",
          direction: "diagonal",
          children: [],
          ratios: [],
        },
      })
    ).toBeNull();
    expect(
      parseWorkspace({
        id: "x",
        name: "X",
        preset: "grid",
        root: {
          type: "grid",
          id: "g",
          rows: 1,
          cols: 1,
          children: [leaf("a")],
        },
      })?.root
    ).toMatchObject({ type: "grid" });
  });
});
