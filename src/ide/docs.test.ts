import { describe, expect, it } from "vitest";
import {
  attachProvider,
  closeFileDoc,
  dirtyDocs,
  getFileDoc,
  peekLiveText,
  readLiveText,
} from "./docs";
import { memoryKv } from "./project/kv";
import { ProjectStore } from "./project/store";

async function sampleStore() {
  const store = new ProjectStore(memoryKv());
  await store.init();
  return { store, id: store.getActiveId()! };
}

describe("file documents", () => {
  it("loads backend content, tracks dirty state and saves", async () => {
    const { store, id } = await sampleStore();
    const d = getFileDoc(id, "app.js", store);
    expect(getFileDoc(id, "app.js", store)).toBe(d);
    // Until the document has loaded, reads fall through to the backend.
    expect(d.loaded).toBe(false);
    expect(peekLiveText(id, "app.js")).toBeNull();
    expect(await readLiveText(id, "app.js", store)).toContain("console.log");
    await d.ready;
    expect(d.loaded).toBe(true);
    expect(d.text.toString()).toContain("console.log");
    expect(d.dirty.get()).toBe(false);

    d.text.insert(0, "// edited\n");
    expect(d.dirty.get()).toBe(true);
    expect(dirtyDocs(id)).toEqual([d]);
    expect(peekLiveText(id, "app.js")).toMatch(/^\/\/ edited/);
    expect(await readLiveText(id, "styles.css", store)).toContain(
      "color-scheme"
    );

    await d.save();
    expect(d.dirty.get()).toBe(false);
    expect(await store.readFile(id, "app.js")).toMatch(/^\/\/ edited/);
    closeFileDoc(id, "app.js");
    expect(peekLiveText(id, "app.js")).toBeNull();
  });

  it("reports missing files and reloads external changes", async () => {
    const { store, id } = await sampleStore();
    const missing = getFileDoc(id, "nope.txt", store);
    await missing.ready;
    expect(missing.error.get()).toMatch(/No such file/);
    closeFileDoc(id, "nope.txt");

    const d = getFileDoc(id, "README.md", store);
    await d.ready;
    await store.writeFile(id, "README.md", "# changed");
    // Dirty compares against the last content this document saw, not the disk.
    expect(d.dirty.get()).toBe(false);
    await d.reload();
    expect(d.text.toString()).toBe("# changed");
    expect(d.dirty.get()).toBe(false);
    closeFileDoc(id, "README.md");
  });

  it("calls the provider hook once per document", async () => {
    const { store, id } = await sampleStore();
    const seen: string[] = [];
    attachProvider((_doc, key) => {
      seen.push(key);
    });
    const d = getFileDoc(id, "styles.css", store);
    await d.ready;
    expect(seen).toEqual([`paperos-v2:doc:${id}:styles.css`]);
    attachProvider(null);
    closeFileDoc(id, "styles.css");
  });
});

describe("shared documents", () => {
  it("binds files to a room text, never dirty, and rebinds on reset", async () => {
    const { setDocSource, resetFileDocs, docsGeneration } =
      await import("./docs");
    const Y = await import("yjs");
    const { store, id } = await sampleStore();
    const room = new Y.Doc();
    const shared = room.getMap<InstanceType<typeof Y.Text>>("files");
    shared.set("app.js", new Y.Text("shared content"));
    setDocSource((project, path) =>
      project === id && shared.has(path)
        ? { doc: room, text: shared.get(path)! }
        : null
    );
    const gen = docsGeneration.get();
    resetFileDocs(id);
    expect(docsGeneration.get()).toBe(gen + 1);

    const d = getFileDoc(id, "app.js", store);
    expect(d.shared).toBe(true);
    expect(d.doc).toBe(room);
    await d.ready;
    expect(d.text.toString()).toBe("shared content");
    d.text.insert(0, "x");
    expect(d.dirty.get()).toBe(false);
    expect(peekLiveText(id, "app.js")).toBe("xshared content");
    await d.save();
    expect(await store.readFile(id, "app.js")).toBe("xshared content");
    // Reload never overwrites the room's buffer with the backend.
    await store.writeFile(id, "app.js", "disk");
    await d.reload();
    expect(d.text.toString()).toBe("xshared content");

    // Files the room does not know stay local documents.
    const local = getFileDoc(id, "styles.css", store);
    expect(local.shared).toBe(false);
    await local.ready;

    setDocSource(null);
    resetFileDocs(id);
    // The room document survives closing its file documents.
    expect(shared.get("app.js")!.toString()).toBe("xshared content");
    const again = getFileDoc(id, "app.js", store);
    expect(again.shared).toBe(false);
    await again.ready;
    expect(again.text.toString()).toBe("disk");
    closeFileDoc(id, "app.js");
  });
});
