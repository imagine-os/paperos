/** The subset of the Web Storage API the stores need; lets tests use memory. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** `localStorage` when available (it throws in some private modes), else null. */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "__paperos_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export interface JsonStore<T> {
  get(): T;
  set(next: T): void;
  update(fn: (current: T) => T): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A tiny typed store backed by one storage key. `parse` validates whatever is
 * on disk and returns null to fall back to `fallback()`. Writes are
 * synchronous; failures (quota, blocked storage) are swallowed so the app
 * keeps working without persistence.
 */
export function createJsonStore<T>(
  storage: StorageLike | null,
  key: string,
  fallback: () => T,
  parse: (raw: unknown) => T | null = (raw) => raw as T
): JsonStore<T> {
  const listeners = new Set<() => void>();

  const load = (): T => {
    try {
      const raw = storage?.getItem(key);
      if (raw) {
        const parsed = parse(JSON.parse(raw));
        if (parsed !== null) return parsed;
      }
    } catch {
      // Corrupt or unreadable: start fresh.
    }
    return fallback();
  };

  let value = load();

  const persist = () => {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked; keep the in-memory value.
    }
  };

  return {
    get: () => value,
    set(next) {
      value = next;
      persist();
      listeners.forEach((l) => l());
    },
    update(fn) {
      this.set(fn(value));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
