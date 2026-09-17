import { describe, expect, it } from "vitest";
import {
  atom,
  createShapeId,
  createTLStore,
  defaultShapeUtils,
  InstancePresenceRecordType,
  PageRecordType,
  type TLPresenceUserInfo,
  type TLShapeId,
} from "tldraw";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { WindowShapeUtil, type WindowShape } from "@/desktop/window-shape";
import { bindStore, recordsMap, roomHasCanvas } from "./store-sync";

/** Two documents kept in step by hand (what a provider does over the network). */
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

function windowRecord(id: TLShapeId, title: string): WindowShape {
  return {
    id,
    typeName: "shape",
    type: "window",
    x: 10,
    y: 20,
    rotation: 0,
    index: "a1" as WindowShape["index"],
    parentId: "page:page" as WindowShape["parentId"],
    isLocked: false,
    opacity: 1,
    meta: {},
    props: { ...WindowShapeUtil.prototype.getDefaultProps.call(null), title },
  } as WindowShape;
}

const user = (name: string) =>
  atom<TLPresenceUserInfo>("u", { id: name, name, color: "#123456" });

describe("tldraw store <-> room document", () => {
  it("seeds an empty room from the store and mirrors later changes both ways", async () => {
    const { a, b } = linkedDocs();
    const storeA = createTLStore({
      shapeUtils: [...defaultShapeUtils, WindowShapeUtil],
    });
    const storeB = createTLStore({
      shapeUtils: [...defaultShapeUtils, WindowShapeUtil],
    });
    const w1 = createShapeId("w1");
    storeA.put([windowRecord(w1, "One")]);
    expect(roomHasCanvas(a)).toBe(false);

    const offA = bindStore(storeA, a, new Awareness(a), user("A"));
    expect(roomHasCanvas(a)).toBe(true);
    expect(recordsMap(a).has(w1)).toBe(true);
    // Session records never travel.
    expect(
      [...recordsMap(a).values()].some((r) => r.typeName === "instance")
    ).toBe(false);

    // B joins a room that has content: its own document records are replaced.
    const stray = createShapeId("stray");
    storeB.put([windowRecord(stray, "Stray")]);
    const offB = bindStore(storeB, b, new Awareness(b), user("B"));
    expect(storeB.has(w1)).toBe(true);
    expect(storeB.has(stray)).toBe(false);
    expect((storeB.get(w1) as WindowShape).props.title).toBe("One");

    // A change on either side shows up on the other.
    storeA.update(w1, (r) => ({
      ...(r as WindowShape),
      props: { ...(r as WindowShape).props, title: "Renamed" },
    }));
    await tick();
    expect((storeB.get(w1) as WindowShape).props.title).toBe("Renamed");
    const w2 = createShapeId("w2");
    storeB.put([windowRecord(w2, "Two")]);
    await tick();
    expect(storeA.has(w2)).toBe(true);
    storeB.remove([w1]);
    await tick();
    expect(storeA.has(w1)).toBe(false);

    // Pages are document records too.
    const page = PageRecordType.create({
      name: "Second",
      index: "a2" as never,
    });
    storeA.put([page]);
    await tick();
    expect(storeB.has(page.id)).toBe(true);

    offA();
    offB();
    // Unbound: no more mirroring.
    storeA.put([windowRecord(createShapeId("w3"), "Three")]);
    await tick();
    expect(storeB.has(createShapeId("w3"))).toBe(false);
  });

  it("turns remote awareness presence into instance_presence records and cleans up", () => {
    const { a, b } = linkedDocs();
    const storeA = createTLStore({
      shapeUtils: [...defaultShapeUtils, WindowShapeUtil],
    });
    const awarenessA = new Awareness(a);
    const awarenessB = new Awareness(b);
    // Wire awareness by hand as well.
    const { encodeAwarenessUpdate, applyAwarenessUpdate } = awarenessProtocol();
    awarenessB.on(
      "update",
      ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        applyAwarenessUpdate(
          awarenessA,
          encodeAwarenessUpdate(awarenessB, [...added, ...updated, ...removed]),
          "wire"
        );
      }
    );
    const off = bindStore(storeA, a, awarenessA, user("A"));

    const presence = InstancePresenceRecordType.create({
      id: InstancePresenceRecordType.createId("b"),
      currentPageId: "page:page" as never,
      userId: "B",
      userName: "Bob",
      color: "#ff0000",
      cursor: { x: 1, y: 2, type: "default", rotation: 0 },
    });
    awarenessB.setLocalStateField("user", {
      id: "B",
      name: "Bob",
      color: "#ff0000",
    });
    awarenessB.setLocalStateField("presence", presence);
    expect(storeA.has(presence.id)).toBe(true);
    expect(storeA.get(presence.id)).toMatchObject({ userName: "Bob" });

    awarenessB.setLocalStateField("presence", null);
    expect(storeA.has(presence.id)).toBe(false);

    awarenessB.setLocalStateField("presence", presence);
    expect(storeA.has(presence.id)).toBe(true);
    off();
    expect(storeA.has(presence.id)).toBe(false);
  });
});

const tick = () => new Promise((r) => setTimeout(r, 0));

function awarenessProtocol() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("y-protocols/awareness") as typeof import("y-protocols/awareness");
}
