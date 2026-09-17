import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import {
  startSyncServer,
  type SyncServer,
} from "../../tools/paperos-sync/server.mjs";

let server: SyncServer;

beforeAll(async () => {
  server = await startSyncServer({ port: 0 });
});

afterAll(async () => {
  await server.close();
});

function connect(room: string, doc: Y.Doc) {
  const provider = new WebsocketProvider(
    `ws://127.0.0.1:${server.port}`,
    room,
    doc,
    {
      WebSocketPolyfill: WebSocket as never,
      disableBc: true,
    }
  );
  return provider;
}

const until = (test: () => boolean, ms = 5000) =>
  new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (test()) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > ms) {
        clearInterval(t);
        reject(new Error("timed out"));
      }
    }, 20);
  });

describe("tools/paperos-sync", () => {
  it("relays document updates and awareness between clients of a room", async () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const pa = connect("paperos-test-room", a);
    const pb = connect("paperos-test-room", b);
    await until(() => pa.synced && pb.synced);

    a.getMap("m").set("hello", "world");
    await until(() => b.getMap("m").get("hello") === "world");
    b.getText("t").insert(0, "from b");
    await until(() => a.getText("t").toString() === "from b");

    pa.awareness.setLocalStateField("user", { name: "Amy" });
    await until(() => {
      const states = [...pb.awareness.getStates().values()];
      return states.some(
        (s) => (s as { user?: { name: string } }).user?.name === "Amy"
      );
    });
    expect(server.rooms.get("paperos-test-room")?.conns.size).toBe(2);

    // A late joiner receives the whole document from the server.
    const c = new Y.Doc();
    const pc = connect("paperos-test-room", c);
    await until(() => pc.synced);
    expect(c.getMap("m").get("hello")).toBe("world");
    expect(c.getText("t").toString()).toBe("from b");

    // Leaving removes the awareness state on the others.
    pa.destroy();
    await until(
      () =>
        ![...pb.awareness.getStates().values()].some(
          (s) => (s as { user?: { name: string } }).user?.name === "Amy"
        )
    );
    pb.destroy();
    pc.destroy();
    await until(() => server.rooms.get("paperos-test-room")?.conns.size === 0);
  });

  it("keeps rooms apart and answers HTTP", async () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const pa = connect("room-one", a);
    const pb = connect("room-two", b);
    await until(() => pa.synced && pb.synced);
    a.getMap("m").set("k", 1);
    await new Promise((r) => setTimeout(r, 100));
    expect(b.getMap("m").get("k")).toBeUndefined();
    const res = await fetch(`http://127.0.0.1:${server.port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("PaperOS sync server: ok");
    pa.destroy();
    pb.destroy();
  });
});
