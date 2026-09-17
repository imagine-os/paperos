/**
 * Schema version of the project store (IndexedDB `paperos-v2:projects`).
 * `migrate()` runs at store init: a fresh store is stamped with the current
 * version; an older store runs every migration whose `to` is above its
 * version, in order; a newer store (from a newer build in another tab) is
 * left alone and reported. Adding a migration means one entry here and a
 * bump of `SCHEMA_VERSION`.
 */
import type { KvStore } from "./kv";

export const VERSION_KEY = "__schema_version";
export const SCHEMA_VERSION = 1;

export interface Migration {
  /** The version the store is at once this migration has run. */
  to: number;
  description: string;
  run(kv: KvStore): Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  // { to: 2, description: "...", async run(kv) { ... } },
];

export interface MigrationReport {
  from: number | null;
  to: number;
  ran: string[];
  /** The store was written by a newer build; nothing was changed. */
  newer: boolean;
}

export async function migrate(
  kv: KvStore,
  migrations: Migration[] = MIGRATIONS,
  target = SCHEMA_VERSION
): Promise<MigrationReport> {
  const stored = await kv.get<number>("meta", VERSION_KEY);
  const from = typeof stored === "number" ? stored : null;
  if (from !== null && from > target)
    return { from, to: from, ran: [], newer: true };
  const ran: string[] = [];
  let version = from ?? 0;
  if (from === null) {
    // A fresh store (or one from before versioning): stamp it.
    version = target;
  } else {
    for (const m of [...migrations].sort((a, b) => a.to - b.to)) {
      if (m.to <= version || m.to > target) continue;
      await m.run(kv);
      version = m.to;
      ran.push(m.description);
    }
  }
  if (version !== from) await kv.set("meta", VERSION_KEY, version);
  return { from, to: version, ran, newer: false };
}
