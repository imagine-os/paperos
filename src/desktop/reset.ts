/**
 * "Reset local data": everything PaperOS keeps in this browser goes:
 * localStorage keys (`paperos-v2:*`), the project store and the per-file
 * and per-room Yjs databases (`paperos-v2*`), tldraw's document
 * (`TLDRAW_DOCUMENT_v2paperos-v2`) and user data. The page reloads into a
 * first run.
 */
export const LOCAL_PREFIX = "paperos-v2";
export const TLDRAW_DB = "TLDRAW_DOCUMENT_v2paperos-v2";

/** Names of the IndexedDB databases PaperOS owns (best effort: the API is optional). */
export async function listOwnDatabases(
  factory: IDBFactory | undefined = typeof indexedDB === "undefined"
    ? undefined
    : indexedDB
): Promise<string[]> {
  const known = new Set<string>([`${LOCAL_PREFIX}:projects`, TLDRAW_DB]);
  if (factory && typeof factory.databases === "function") {
    try {
      for (const db of await factory.databases())
        if (db.name && isOwnDatabase(db.name)) known.add(db.name);
    } catch {
      // Not supported: the known names still go.
    }
  }
  return [...known];
}

export function isOwnDatabase(name: string): boolean {
  return name.startsWith(LOCAL_PREFIX) || name === TLDRAW_DB;
}

export function isOwnStorageKey(key: string): boolean {
  return key.startsWith(LOCAL_PREFIX) || key.startsWith("TLDRAW_");
}

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = factory.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

export async function resetLocalData(
  options: { reload?: boolean } = {}
): Promise<{ keys: number; databases: string[] }> {
  let keys = 0;
  try {
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && isOwnStorageKey(k)) remove.push(k);
    }
    for (const k of remove) window.localStorage.removeItem(k);
    keys = remove.length;
  } catch {
    // Storage blocked.
  }
  const databases = await listOwnDatabases();
  if (typeof indexedDB !== "undefined")
    await Promise.all(databases.map((n) => deleteDatabase(indexedDB, n)));
  if (options.reload !== false) {
    const url = new URL(window.location.href);
    url.search = "";
    window.location.replace(url.toString());
  }
  return { keys, databases };
}
