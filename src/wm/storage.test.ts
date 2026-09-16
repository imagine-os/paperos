import { describe, expect, it } from "vitest";
import { createJsonStore, memoryStorage } from "./storage";

describe("createJsonStore", () => {
  it("uses the fallback, persists and validates", () => {
    const storage = memoryStorage();
    const store = createJsonStore(
      storage,
      "k",
      () => ({ n: 0 }),
      (raw) =>
        typeof (raw as { n?: unknown }).n === "number"
          ? (raw as { n: number })
          : null
    );
    expect(store.get()).toEqual({ n: 0 });
    store.set({ n: 2 });
    expect(JSON.parse(storage.getItem("k")!)).toEqual({ n: 2 });
    storage.setItem("k", JSON.stringify({ n: "bad" }));
    expect(createJsonStore(storage, "k", () => ({ n: 0 })).get()).toEqual({
      n: "bad",
    });
  });

  it("survives a storage that throws", () => {
    const store = createJsonStore(
      {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {},
      },
      "k",
      () => 1
    );
    expect(store.get()).toBe(1);
    store.set(2);
    expect(store.get()).toBe(2);
  });
});
