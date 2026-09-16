import { describe, expect, it } from "vitest";
import { memoryKv } from "./kv";
import { MemoryBackend } from "./memory-backend";
import { ProjectStore } from "./store";

describe("MemoryBackend", () => {
  it("stores, lists, renames and removes, persisting to the kv", async () => {
    const kv = memoryKv();
    const b = new MemoryBackend(kv, "p1");
    await b.seed({ "index.html": "<h1>hi</h1>", "src/app.js": "1" });
    await b.mkdir("empty");
    expect((await b.list()).map((e) => `${e.type}:${e.path}`).sort()).toEqual([
      "dir:empty",
      "dir:src",
      "file:index.html",
      "file:src/app.js",
    ]);
    await b.rename("src", "lib");
    expect(await b.read("lib/app.js")).toBe("1");
    await expect(b.read("src/app.js")).rejects.toThrow();
    await b.remove("lib");
    expect((await b.list()).some((e) => e.path.startsWith("lib"))).toBe(false);

    const again = new MemoryBackend(kv, "p1");
    await again.load();
    expect(await again.read("index.html")).toBe("<h1>hi</h1>");
    expect(again.has("empty")).toBe(false);
    expect((await again.list()).some((e) => e.path === "empty")).toBe(true);
  });
});

describe("ProjectStore", () => {
  it("creates the sample project on first run and restores it", async () => {
    const kv = memoryKv();
    const store = new ProjectStore(kv);
    await store.init();
    const [sample] = store.list();
    expect(sample.name).toBe("Sample site");
    expect(store.getActiveId()).toBe(sample.id);
    const files = (await store.session(sample.id))!.files.get();
    expect(files.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        "index.html",
        "styles.css",
        "app.js",
        "README.md",
      ])
    );

    const store2 = new ProjectStore(kv);
    await store2.init();
    expect(store2.list()).toHaveLength(1);
    expect(store2.getActiveId()).toBe(sample.id);
    expect(await store2.readFile(sample.id, "app.js")).toContain("console.log");
  });

  it("writes, renames, deletes and switches projects", async () => {
    const store = new ProjectStore(memoryKv());
    await store.init();
    const id = store.getActiveId()!;
    let changes = 0;
    store.changes.subscribe(() => changes++);
    await store.createFile(id, "notes.txt", "hello");
    await store.createFolder(id, "docs");
    await store.renameEntry(id, "notes.txt", "docs/notes.txt");
    expect(await store.readFile(id, "docs/notes.txt")).toBe("hello");
    await store.deleteEntry(id, "docs");
    const paths = (await store.session(id))!.files.get().map((f) => f.path);
    expect(paths).not.toContain("docs");
    expect(paths).not.toContain("docs/notes.txt");
    expect(changes).toBe(4);

    const other = await store.createMemoryProject(
      "Other",
      { "a.md": "# a" },
      "zip"
    );
    expect(store.getActiveId()).toBe(other.id);
    expect(store.list().map((p) => p.name)).toEqual(["Sample site", "Other"]);
    expect(store.peekFile(other.id, "a.md")).toBe("# a");
    await store.remove(other.id);
    expect(store.getActiveId()).toBe(id);
    expect(store.list()).toHaveLength(1);
  });
});
