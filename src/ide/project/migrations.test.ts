import { describe, expect, it } from "vitest";
import { memoryKv } from "./kv";
import {
  migrate,
  SCHEMA_VERSION,
  VERSION_KEY,
  type Migration,
} from "./migrations";

describe("project store migrations", () => {
  it("stamps a fresh store with the current version and runs nothing", async () => {
    const kv = memoryKv();
    const r = await migrate(kv);
    expect(r).toEqual({
      from: null,
      to: SCHEMA_VERSION,
      ran: [],
      newer: false,
    });
    expect(await kv.get("meta", VERSION_KEY)).toBe(SCHEMA_VERSION);
    // Idempotent.
    expect((await migrate(kv)).ran).toEqual([]);
  });

  it("runs the migrations above the stored version, in order, once", async () => {
    const kv = memoryKv();
    await kv.set("meta", VERSION_KEY, 1);
    await kv.set("meta", "p:a", { id: "a", name: "A" });
    const log: number[] = [];
    const migrations: Migration[] = [
      {
        to: 3,
        description: "add color",
        async run(k) {
          log.push(3);
          const rows = await k.list<{ id: string }>("meta", "p:");
          for (const row of rows)
            await k.set("meta", `p:${row.id}`, { ...row, color: "blue" });
        },
      },
      {
        to: 2,
        description: "rename field",
        async run(k) {
          log.push(2);
          const rows = await k.list<{ id: string; name: string }>("meta", "p:");
          for (const row of rows)
            await k.set("meta", `p:${row.id}`, { id: row.id, title: row.name });
        },
      },
    ];
    const r = await migrate(kv, migrations, 3);
    expect(log).toEqual([2, 3]);
    expect(r).toEqual({
      from: 1,
      to: 3,
      ran: ["rename field", "add color"],
      newer: false,
    });
    expect(await kv.get("meta", "p:a")).toEqual({
      id: "a",
      title: "A",
      color: "blue",
    });
    expect(await kv.get("meta", VERSION_KEY)).toBe(3);
    expect((await migrate(kv, migrations, 3)).ran).toEqual([]);
  });

  it("leaves a store written by a newer build alone", async () => {
    const kv = memoryKv();
    await kv.set("meta", VERSION_KEY, 9);
    const r = await migrate(kv, [], 1);
    expect(r).toEqual({ from: 9, to: 9, ran: [], newer: true });
    expect(await kv.get("meta", VERSION_KEY)).toBe(9);
  });
});
