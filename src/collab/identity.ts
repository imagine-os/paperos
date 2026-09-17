/**
 * Who this browser is in a room: a stable id, a name picked on first join
 * and a color. Kept in localStorage (`paperos-v2:collab-identity`).
 */
import { newUserName, pickColor } from "./participants";

export interface Identity {
  id: string;
  name: string;
  color: string;
}

export const IDENTITY_KEY = "paperos-v2:collab-identity";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function newIdentity(random: () => number = Math.random): Identity {
  const id = `u_${Math.floor(random() * 2 ** 48).toString(36)}`;
  return { id, name: newUserName(random), color: pickColor(id) };
}

export function readIdentity(store: StorageLike | null = storage()): Identity {
  try {
    const raw = store?.getItem(IDENTITY_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Identity>;
      if (
        typeof v.id === "string" &&
        typeof v.name === "string" &&
        typeof v.color === "string"
      )
        return { id: v.id, name: v.name, color: v.color };
    }
  } catch {
    // Fall through to a fresh identity.
  }
  const fresh = newIdentity();
  writeIdentity(fresh, store);
  return fresh;
}

export function writeIdentity(
  identity: Identity,
  store: StorageLike | null = storage()
): void {
  try {
    store?.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Storage blocked: the name lasts for this tab.
  }
}
