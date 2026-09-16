import { describe, expect, it } from "vitest";
import { memoryStorage } from "./storage";
import { leaf } from "./tree";
import { createWmStateStore, EMPTY_WM_STATE, WM_STATE_KEY } from "./wm-state";

describe("wm state store", () => {
  it("starts empty and round-trips", () => {
    const storage = memoryStorage();
    const store = createWmStateStore(storage);
    expect(store.get()).toEqual(EMPTY_WM_STATE);
    store.set({
      version: 1,
      preset: "columns",
      root: leaf("shape:a"),
      region: { x: 1, y: 2, w: 3, h: 4 },
      activeWorkspaceId: "ws_desk",
    });
    const again = createWmStateStore(storage);
    expect(again.get()).toMatchObject({
      preset: "columns",
      root: { windowId: "shape:a" },
      region: { x: 1, y: 2, w: 3, h: 4 },
      activeWorkspaceId: "ws_desk",
    });
  });

  it("ignores garbage", () => {
    const storage = memoryStorage();
    storage.setItem(WM_STATE_KEY, JSON.stringify({ version: 1, preset: "x" }));
    expect(createWmStateStore(storage).get()).toEqual(EMPTY_WM_STATE);
    storage.setItem(WM_STATE_KEY, "nope");
    expect(createWmStateStore(storage).get()).toEqual(EMPTY_WM_STATE);
  });

  it("update() derives from the current value", () => {
    const store = createWmStateStore(null);
    store.update((s) => ({ ...s, preset: "grid" }));
    expect(store.get().preset).toBe("grid");
  });
});
