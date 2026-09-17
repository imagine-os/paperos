/**
 * tldraw store <-> Yjs. The room document holds every document-scoped record
 * (document, pages, shapes, bindings, assets) in one `Y.Map` keyed by record
 * id; session records (camera, instance, pointer) stay local. Remote changes
 * enter the store through `mergeRemoteChanges`, so they neither echo back
 * nor land on the undo stack (and the store's integrity checker runs after
 * each batch). Presence goes through awareness: the local
 * `instance_presence` derivation is published as the `presence` field and
 * every remote `presence` becomes a record in the store, which is what makes
 * tldraw draw the other cursors and selections.
 */
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import {
  createPresenceStateDerivation,
  react,
  type Atom,
  type TLInstancePresence,
  type TLPresenceUserInfo,
  type TLRecord,
  type TLStore,
} from "tldraw";
import type { AwarenessState } from "./participants";

export const RECORDS_KEY = "tldraw";

/** Transaction origin of this binding's own writes (so it ignores them coming back). */
export const STORE_ORIGIN = "paperos-store";

export function recordsMap(doc: Y.Doc): Y.Map<TLRecord> {
  return doc.getMap<TLRecord>(RECORDS_KEY);
}

export function roomHasCanvas(doc: Y.Doc): boolean {
  return recordsMap(doc).size > 0;
}

/**
 * Binds a store to a room document. When the room has records they replace
 * the store's document records; otherwise the store seeds the room. Returns
 * a disposer that also removes the remote presence records it added.
 */
export function bindStore(
  store: TLStore,
  doc: Y.Doc,
  awareness: Awareness,
  user: Atom<TLPresenceUserInfo>
): () => void {
  const records = recordsMap(doc);
  const documentTypes = store.scopedTypes.document;
  const isDocument = (r: TLRecord) => documentTypes.has(r.typeName);

  if (records.size === 0) {
    doc.transact(() => {
      for (const r of store.allRecords())
        if (isDocument(r)) records.set(r.id, r);
    }, STORE_ORIGIN);
  } else {
    const incoming = [...records.values()];
    const ids = new Set(incoming.map((r) => r.id));
    store.mergeRemoteChanges(() => {
      store.put(incoming);
      const stale = store
        .allRecords()
        .filter((r) => isDocument(r) && !ids.has(r.id))
        .map((r) => r.id);
      if (stale.length) store.remove(stale);
    });
  }

  // Local -> room.
  const offStore = store.listen(
    ({ changes }) => {
      doc.transact(() => {
        for (const r of Object.values(changes.added)) records.set(r.id, r);
        for (const [, to] of Object.values(changes.updated))
          records.set(to.id, to);
        for (const r of Object.values(changes.removed)) records.delete(r.id);
      }, STORE_ORIGIN);
    },
    { source: "user", scope: "document" }
  );

  // Room -> local. Applied in a microtask: remote events can arrive while the
  // store is mid-transaction (the integrity checker's own puts, a provider
  // delivering synchronously), and `mergeRemoteChanges` must not nest.
  const changed = new Set<string>();
  let scheduled = false;
  let disposed = false;
  const flush = () => {
    scheduled = false;
    if (disposed || changed.size === 0) return;
    const put: TLRecord[] = [];
    const remove: TLRecord["id"][] = [];
    for (const key of changed) {
      const r = records.get(key);
      if (r) put.push(r);
      else if (store.has(key as TLRecord["id"]))
        remove.push(key as TLRecord["id"]);
    }
    changed.clear();
    if (!put.length && !remove.length) return;
    store.mergeRemoteChanges(() => {
      if (put.length) store.put(put);
      if (remove.length) store.remove(remove);
    });
  };
  const onRecords = (event: Y.YMapEvent<TLRecord>, tx: Y.Transaction) => {
    if (tx.origin === STORE_ORIGIN) return;
    event.keysChanged.forEach((key) => changed.add(key));
    if (!scheduled && changed.size) {
      scheduled = true;
      queueMicrotask(flush);
    }
  };
  records.observe(onRecords);

  // Presence out.
  const presence = createPresenceStateDerivation(user)(store);
  const offPresence = react("collab.presence", () => {
    awareness.setLocalStateField("presence", presence.get());
  });

  // Presence in.
  const presenceIds = new Map<number, TLInstancePresence["id"]>();
  const applyPresence = (change: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    const states = awareness.getStates() as Map<number, AwarenessState>;
    const put: TLInstancePresence[] = [];
    const remove: TLInstancePresence["id"][] = [];
    for (const id of [...change.added, ...change.updated]) {
      if (id === awareness.clientID) continue;
      const p = states.get(id)?.presence as TLInstancePresence | undefined;
      if (p && p.typeName === "instance_presence") {
        put.push(p);
        presenceIds.set(id, p.id);
      } else if (presenceIds.has(id)) {
        remove.push(presenceIds.get(id)!);
        presenceIds.delete(id);
      }
    }
    for (const id of change.removed) {
      const pid = presenceIds.get(id);
      if (pid) remove.push(pid);
      presenceIds.delete(id);
    }
    if (!put.length && !remove.length) return;
    store.mergeRemoteChanges(() => {
      if (put.length) store.put(put);
      const present = remove.filter((id) => store.has(id));
      if (present.length) store.remove(present);
    });
  };
  awareness.on("change", applyPresence);
  applyPresence({
    added: [...awareness.getStates().keys()],
    updated: [],
    removed: [],
  });

  return () => {
    disposed = true;
    changed.clear();
    offStore();
    records.unobserve(onRecords);
    offPresence();
    awareness.off("change", applyPresence);
    awareness.setLocalStateField("presence", null);
    const ids = [...presenceIds.values()].filter((id) => store.has(id));
    presenceIds.clear();
    if (ids.length) store.mergeRemoteChanges(() => store.remove(ids));
  };
}
