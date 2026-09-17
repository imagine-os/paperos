#!/usr/bin/env node
/**
 * PaperOS sync server: a y-websocket relay for rooms. One process, one
 * port, no accounts, no database. Clients connect to ws://host:port/<room>;
 * the server keeps each room's Yjs document in memory, relays updates and
 * awareness (cursors, names) between the clients of a room and answers the
 * y-websocket sync protocol, so `WebsocketProvider` from y-websocket works
 * unchanged. Peers keep their own copy of every room in IndexedDB, so a
 * restarted server is refilled by the first client that reconnects.
 *
 *   node tools/paperos-sync/server.mjs --port 1234 --host 0.0.0.0
 *
 * Dependencies (yjs, y-protocols, lib0, ws) resolve from the repository's
 * node_modules when run from a checkout, or from this folder after
 * `npm --prefix tools/paperos-sync install`.
 */
import http from "node:http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const PING_MS = 30000;

/** @typedef {{ doc: Y.Doc, awareness: awarenessProtocol.Awareness, conns: Map<import("ws").WebSocket, Set<number>> }} Room */

/**
 * Starts the server. Resolves with the bound port and a `close()`.
 * @param {{ port?: number, host?: string, log?: (line: string) => void }} [options]
 */
export function startSyncServer(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const log = options.log ?? (() => {});
  /** @type {Map<string, Room>} */
  const rooms = new Map();

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`PaperOS sync server: ok (${rooms.size} rooms)\n`);
  });
  const wss = new WebSocketServer({ noServer: true });

  /** @param {string} name */
  const getRoom = (name) => {
    let room = rooms.get(name);
    if (!room) {
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);
      awareness.setLocalState(null);
      room = { doc, awareness, conns: new Map() };
      const r = room;
      doc.on("update", (/** @type {Uint8Array} */ update) => {
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MESSAGE_SYNC);
        syncProtocol.writeUpdate(enc, update);
        broadcast(r, encoding.toUint8Array(enc));
      });
      awareness.on(
        "update",
        (
          /** @type {{added: number[], updated: number[], removed: number[]}} */ change,
          /** @type {unknown} */ origin
        ) => {
          const changed = [
            ...change.added,
            ...change.updated,
            ...change.removed,
          ];
          if (
            origin &&
            typeof origin === "object" &&
            r.conns.has(/** @type {never} */ (origin))
          ) {
            const ids = r.conns.get(/** @type {never} */ (origin));
            if (ids) {
              change.added.forEach((id) => ids.add(id));
              change.removed.forEach((id) => ids.delete(id));
            }
          }
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            enc,
            awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
          );
          broadcast(r, encoding.toUint8Array(enc));
        }
      );
      rooms.set(name, room);
      log(`room ${name}: created`);
    }
    return room;
  };

  /** @param {Room} room @param {Uint8Array} message */
  const broadcast = (room, message) => {
    for (const conn of room.conns.keys()) send(room, conn, message);
  };

  /** @param {Room} room @param {import("ws").WebSocket} conn @param {Uint8Array} message */
  const send = (room, conn, message) => {
    if (conn.readyState !== conn.OPEN && conn.readyState !== conn.CONNECTING) {
      closeConn(room, conn);
      return;
    }
    try {
      conn.send(message, (err) => err && closeConn(room, conn));
    } catch {
      closeConn(room, conn);
    }
  };

  /** @param {Room} room @param {import("ws").WebSocket} conn */
  const closeConn = (room, conn) => {
    const ids = room.conns.get(conn);
    if (ids) {
      room.conns.delete(conn);
      awarenessProtocol.removeAwarenessStates(room.awareness, [...ids], null);
    }
    try {
      conn.close();
    } catch {
      // already closed
    }
  };

  wss.on("connection", (conn, req) => {
    const name =
      decodeURIComponent((req.url ?? "/").slice(1).split("?")[0]) || "default";
    const room = getRoom(name);
    conn.binaryType = "arraybuffer";
    room.conns.set(conn, new Set());
    log(`room ${name}: +1 (${room.conns.size} connected)`);

    conn.on("message", (/** @type {ArrayBuffer | Buffer} */ data) => {
      try {
        const message = new Uint8Array(/** @type {ArrayBuffer} */ (data));
        const dec = decoding.createDecoder(message);
        const enc = encoding.createEncoder();
        switch (decoding.readVarUint(dec)) {
          case MESSAGE_SYNC:
            encoding.writeVarUint(enc, MESSAGE_SYNC);
            syncProtocol.readSyncMessage(dec, enc, room.doc, conn);
            if (encoding.length(enc) > 1)
              send(room, conn, encoding.toUint8Array(enc));
            break;
          case MESSAGE_AWARENESS:
            awarenessProtocol.applyAwarenessUpdate(
              room.awareness,
              decoding.readVarUint8Array(dec),
              conn
            );
            break;
        }
      } catch (e) {
        log(
          `room ${name}: bad message (${e instanceof Error ? e.message : e})`
        );
      }
    });

    let alive = true;
    const ping = setInterval(() => {
      if (!alive) {
        closeConn(room, conn);
        clearInterval(ping);
        return;
      }
      alive = false;
      try {
        conn.ping();
      } catch {
        closeConn(room, conn);
        clearInterval(ping);
      }
    }, PING_MS);
    conn.on("pong", () => (alive = true));
    conn.on("close", () => {
      closeConn(room, conn);
      clearInterval(ping);
      log(`room ${name}: -1 (${room.conns.size} connected)`);
    });

    // Sync step 1 and the current awareness states.
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    send(room, conn, encoding.toUint8Array(enc));
    const states = room.awareness.getStates();
    if (states.size > 0) {
      const aw = encoding.createEncoder();
      encoding.writeVarUint(aw, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aw,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [
          ...states.keys(),
        ])
      );
      send(room, conn, encoding.toUint8Array(aw));
    }
  });

  server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req)
    );
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 1234, host, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address
          ? address.port
          : (options.port ?? 1234);
      resolve({
        port,
        host,
        rooms,
        close: () =>
          new Promise((done) => {
            for (const room of rooms.values())
              for (const conn of room.conns.keys()) closeConn(room, conn);
            wss.close();
            server.close(() => done());
          }),
      });
    });
  });
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const port = Number(flag("port", process.env.PORT ?? "1234"));
  const host = flag("host", process.env.HOST ?? "0.0.0.0");
  startSyncServer({
    port,
    host,
    log: (line) => console.log(`[paperos-sync] ${line}`),
  })
    .then((s) =>
      console.log(
        `[paperos-sync] listening on ws://${host}:${s.port} (rooms live in memory; clients keep their own copies)`
      )
    )
    .catch((e) => {
      console.error(`[paperos-sync] ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    });
}
