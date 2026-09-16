/**
 * The smallest key-value interface the project store needs. The browser
 * implementation is IndexedDB (`paperos-v2:projects`); tests use memory.
 */
export interface KvStore {
  get<T>(store: string, key: string): Promise<T | undefined>;
  set<T>(store: string, key: string, value: T): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  /** All values whose key starts with `prefix`. */
  list<T>(store: string, prefix?: string): Promise<T[]>;
  /** Removes every key starting with `prefix`. */
  clear(store: string, prefix: string): Promise<void>;
}

export const PROJECTS_DB = "paperos-v2:projects";
export const KV_STORES = ["meta", "files"] as const;

export function memoryKv(): KvStore {
  const data = new Map<string, Map<string, unknown>>();
  const table = (s: string) => {
    let t = data.get(s);
    if (!t) data.set(s, (t = new Map()));
    return t;
  };
  return {
    async get(store, key) {
      return table(store).get(key) as never;
    },
    async set(store, key, value) {
      table(store).set(key, value);
    },
    async delete(store, key) {
      table(store).delete(key);
    },
    async list(store, prefix = "") {
      return [...table(store).entries()]
        .filter(([k]) => k.startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([, v]) => v as never);
    },
    async clear(store, prefix) {
      for (const k of [...table(store).keys()])
        if (k.startsWith(prefix)) table(store).delete(k);
    },
  };
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB-backed store. Opened lazily; each call is its own transaction. */
export function indexedDbKv(
  dbName = PROJECTS_DB,
  factory: IDBFactory = indexedDB
): KvStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = factory.open(dbName, 1);
        req.onupgradeneeded = () => {
          for (const s of KV_STORES)
            if (!req.result.objectStoreNames.contains(s))
              req.result.createObjectStore(s);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  };
  const tx = async (store: string, mode: IDBTransactionMode) =>
    (await open()).transaction(store, mode).objectStore(store);
  const range = (prefix: string) =>
    prefix ? IDBKeyRange.bound(prefix, prefix + "￿") : undefined;

  return {
    async get(store, key) {
      return request((await tx(store, "readonly")).get(key)) as never;
    },
    async set(store, key, value) {
      await request((await tx(store, "readwrite")).put(value, key));
    },
    async delete(store, key) {
      await request((await tx(store, "readwrite")).delete(key));
    },
    async list(store, prefix = "") {
      return request(
        (await tx(store, "readonly")).getAll(range(prefix))
      ) as never;
    },
    async clear(store, prefix) {
      const s = await tx(store, "readwrite");
      const keys = await request(s.getAllKeys(range(prefix)));
      await Promise.all(keys.map((k) => request(s.delete(k))));
    },
  };
}

/** IndexedDB when the browser has it, else an in-memory store for the session. */
export function browserKv(): KvStore {
  if (typeof indexedDB === "undefined") return memoryKv();
  return indexedDbKv();
}
