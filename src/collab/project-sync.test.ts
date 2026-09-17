import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { memoryKv } from "@/ide/project/kv";
import { ProjectStore } from "@/ide/project/store";
import {
  adoptRoomProject,
  bindProject,
  ensureRoomText,
  roomFileMap,
  roomFiles,
  roomProjectMeta,
  seedRoomProject,
} from "./project-sync";

function linkedDocs() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "wire") Y.applyUpdate(b, u, "wire");
  });
  b.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "wire") Y.applyUpdate(a, u, "wire");
  });
  return { a, b };
}

async function sampleStore() {
  const store = new ProjectStore(memoryKv());
  await store.init();
  return { store, id: store.getActiveId()! };
}

/** Timers that fire immediately (the mirror's debounce collapses to a microtask). */
const immediate = {
  setTimeout: ((fn: () => void) => {
    const t = setTimeout(fn, 0);
    return t;
  }) as typeof setTimeout,
  clearTimeout,
};

const settle = () => new Promise((r) => setTimeout(r, 20));

describe("project <-> room document", () => {
  it("seeds a room from a project and lets a joiner adopt it under the same id", async () => {
    const { a, b } = linkedDocs();
    const creator = await sampleStore();
    expect(roomProjectMeta(a)).toBeNull();
    await seedRoomProject(a, creator.store, creator.id);
    expect(roomProjectMeta(a)).toEqual({
      projectId: creator.id,
      projectName: "Sample site",
    });
    const files = roomFileMap(a);
    expect(files["index.html"]).toContain("<html");
    expect(Object.keys(files).length).toBeGreaterThan(5);

    const joiner = await sampleStore();
    expect(joiner.store.get(creator.id)).toBeUndefined();
    const adopted = await adoptRoomProject(b, joiner.store);
    expect(adopted).toBe(creator.id);
    expect(joiner.store.getActiveId()).toBe(creator.id);
    expect(joiner.store.get(creator.id)).toMatchObject({
      name: "Sample site",
      source: "room",
      backend: "memory",
    });
    expect(await joiner.store.readFile(creator.id, "index.html")).toBe(
      files["index.html"]
    );
    // The joiner's own project is still there.
    expect(joiner.store.list().length).toBe(2);

    // Rejoining with a local copy: the room wins.
    await joiner.store.writeFile(creator.id, "index.html", "stale");
    await joiner.store.writeFile(creator.id, "local-only.txt", "mine");
    await adoptRoomProject(b, joiner.store);
    expect(await joiner.store.readFile(creator.id, "index.html")).toBe(
      files["index.html"]
    );
    await expect(
      joiner.store.readFile(creator.id, "local-only.txt")
    ).rejects.toThrow();
  });

  it("mirrors text edits, new files, renames and deletes both ways", async () => {
    const { a, b } = linkedDocs();
    const creator = await sampleStore();
    await seedRoomProject(a, creator.store, creator.id);
    const joiner = await sampleStore();
    const id = await adoptRoomProject(b, joiner.store);
    const offA = bindProject(a, creator.store, id, immediate);
    const offB = bindProject(b, joiner.store, id, immediate);

    // A room text edit (an editor keystroke on the creator's side) lands in both backends.
    const text = roomFiles(a).get("README.md")!;
    text.insert(0, "# Shared\n");
    await settle();
    expect(await creator.store.readFile(id, "README.md")).toMatch(/^# Shared/);
    expect(await joiner.store.readFile(id, "README.md")).toMatch(/^# Shared/);

    // A local write (shell, Data window, a save) goes to the room and the other side.
    await joiner.store.writeFile(id, "notes.txt", "hello");
    await settle();
    expect(roomFiles(a).get("notes.txt")?.toString()).toBe("hello");
    expect(await creator.store.readFile(id, "notes.txt")).toBe("hello");

    // Folders, renames and deletes.
    await creator.store.createFolder(id, "docs");
    await settle();
    expect(
      (await joiner.store.session(id))!.files
        .get()
        .some((f) => f.path === "docs")
    ).toBe(true);
    await creator.store.renameEntry(id, "notes.txt", "docs/notes.txt");
    await settle();
    expect(roomFiles(b).has("notes.txt")).toBe(false);
    expect(roomFiles(b).get("docs/notes.txt")?.toString()).toBe("hello");
    expect(await joiner.store.readFile(id, "docs/notes.txt")).toBe("hello");
    await expect(joiner.store.readFile(id, "notes.txt")).rejects.toThrow();

    await joiner.store.deleteEntry(id, "docs");
    await settle();
    expect(roomFiles(a).has("docs/notes.txt")).toBe(false);
    await expect(
      creator.store.readFile(id, "docs/notes.txt")
    ).rejects.toThrow();

    // A text created through the room (a new editor) becomes a file everywhere.
    const fresh = ensureRoomText(b, "fresh.js");
    fresh.insert(0, "export const x = 1;");
    await settle();
    expect(await creator.store.readFile(id, "fresh.js")).toBe(
      "export const x = 1;"
    );

    offA();
    offB();
    text.insert(0, "after");
    await settle();
    expect(await joiner.store.readFile(id, "README.md")).toMatch(/^# Shared/);
  });
});
