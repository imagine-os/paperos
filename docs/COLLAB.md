# Collaboration (rooms)

Two or more people, and the agents they bring, share one PaperOS canvas and
project live: the same windows, the same files, cursors and names, all with
free infrastructure. Nothing leaves your browser until you create or join a
room; local-only stays the default.

## Try it

1. Click **Share** in the top bar, then **Create a room**. The Share window
   shows the room id (`amber-fox-417`), its link and who is here.
2. **Copy link** and open it in another browser, another device or send it
   to someone: `/app?room=amber-fox-417`. The link works on GitHub Pages,
   Vercel and `localhost` alike.
3. The joiner is asked once; the room's canvas and project then replace what
   they had (their own project stays in the Open menu). Both now see the same
   windows, drag them together, type in the same editors and watch the same
   preview.

The **Collaborate** board in the sample project (Boards menu) lays this out
as a tour. Scripts and agents use `paperos.collab.*` (see
[`CANVAS_API.md`](CANVAS_API.md)): `create`, `join`, `leave`, `status`,
`participants`, `setName`, and the `collab.changed` event.

## How it works

One Yjs document per room (`src/collab/`):

| Part                     | In the room document                                                                                                                               | Local side                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Canvas (`store-sync`)    | `tldraw`: a `Y.Map` of every document-scoped tldraw record (pages, shapes, bindings)                                                               | tldraw store; remote changes arrive via `mergeRemoteChanges`, so they never echo or land on the undo stack |
| Project (`project-sync`) | `meta` (project id and name), `files` (path -> `Y.Text`), `dirs` (empty folders)                                                                   | a memory project with the room's project id, mirrored to IndexedDB                                         |
| Presence                 | awareness: `user` (name, color), `presence` (tldraw cursor and selection), `focus` (focused window and file), `agent`, `cursor` (editor selection) | tldraw draws the other cursors; title bars show chips; editors show remote carets                          |

- **Windows are shared records.** A window created, moved, retitled or
  closed by anyone changes on every canvas. Window ids are tldraw shape ids,
  so the same id means the same window for everyone.
- **Files are shared buffers.** In a room, every open file's document is the
  room's `Y.Text` for that path (`setDocSource()` in `src/ide/docs.ts`): the
  editor, the preview, the Markdown window, the Data window and the Terminal
  all work on it. A shared document is never "dirty": the mirror writes each
  peer's local backend a few hundred milliseconds after the last change, so
  the Files window, the bundler and `paperos.files.read` see the same text
  everywhere. Local mutations (new file, rename, delete, a write from the
  shell or the Data window) are applied to the room the same way.
- **The first one in seeds the room** with their canvas and project. Everyone
  after adopts the room's project under its id (so file references in shared
  windows resolve), and the room's canvas replaces theirs. Rejoining a room
  you already have a copy of is instant, and works offline: `y-indexeddb`
  keeps every room under `paperos-v2:room:<id>`.
- **Leaving keeps a copy.** The canvas and the room's project stay in the
  browser as they were at that moment; the room continues without you.
- **Layouts stay personal.** The tiling tree lives outside the document
  (PLAN decision 8), so each person tiles their own way; window positions
  and sizes are shared because they are shape properties.
- **Conflict-free by construction.** Yjs merges concurrent edits to the same
  text and the same records; there is no locking and nothing to resolve by
  hand.

## Transports

`src/collab/providers.ts` puts every transport behind one small interface;
`src/collab/config.ts` picks one.

| Transport          | When                                                                                                     | Infrastructure                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `webrtc` (default) | No `sync=` in the link, no sync server configured                                                        | Peers connect directly (`y-webrtc`); a signaling server only introduces them. Default: y-webrtc's public `wss://y-webrtc-eu.fly.dev`. |
| `websocket`        | The link has `sync=<url>`, the Share window says "Sync server", or `NEXT_PUBLIC_PAPEROS_SYNC_URL` is set | A `y-websocket` relay: `tools/paperos-sync`, or any y-websocket-compatible server.                                                    |

**Passwords.** A room can have a password. With `webrtc`, y-webrtc encrypts
signaling with it, so peers without it cannot connect. With both transports
the room name carries a hash of the password (`roomKey()`), so a peer with
the wrong password lands in a different, empty room and sees "Waiting for
the room's content". Passwords never travel in links.

**Public signaling and privacy.** The public signaling server only sees
that two browsers want to find each other for room `paperos-<id>`; the
canvas and files travel over the direct WebRTC connection. Behind strict
NATs WebRTC may not connect (there is no TURN server); a sync server is the
answer then.

## Self-host the sync server in one command

```bash
npm run sync                         # ws://0.0.0.0:1234
npm run sync -- --port 8080          # or PORT=8080
```

`tools/paperos-sync/server.mjs` is a y-websocket relay in one file (its
dependencies, `ws`, `yjs`, `y-protocols` and `lib0`, are already in the
repository's `node_modules`; standalone, `npm --prefix tools/paperos-sync
install`). Rooms live in memory: a restarted server is refilled by the first
peer that reconnects, because every peer keeps its own copy. Put it behind
any TLS-terminating proxy for `wss://` when the app is served over HTTPS
(browsers refuse `ws://` from an HTTPS page, except to `localhost`).

Use it in one of three ways:

- Per link: `/app?room=<id>&sync=wss://your-host`.
- Per browser: the Share window's "Sync server" choice and URL are remembered
  (`paperos-v2:collab-transport`).
- For everyone: build with `NEXT_PUBLIC_PAPEROS_SYNC_URL=wss://your-host`, and
  rooms use it by default. `NEXT_PUBLIC_PAPEROS_SIGNALING=wss://...` does the
  same for a self-hosted signaling server (`npx y-webrtc` ships one) when you
  stay peer-to-peer.

## Swap in a hosted backend later

Anything that speaks Yjs is a provider. `PROVIDERS` in
`src/collab/providers.ts` maps a transport kind to a factory that returns
`{ kind, endpoint, status, peers, whenSynced, destroy }`. To use a hosted
service (Liveblocks Yjs, Y-Sweet, Hocuspocus, PartyKit...), add one entry
that wraps that vendor's provider:

```ts
// src/collab/providers.ts
export const PROVIDERS = { webrtc, websocket, liveblocks };
```

and select it (a `kind` in `config.ts`, or a `NEXT_PUBLIC_...` variable).
The session, the store and project sync, presence and the UI do not change.
Room persistence on the server side is the vendor's job; y-indexeddb keeps
working locally.

## Names, colors, agents

Each browser gets an identity on first join (`paperos-v2:collab-identity`):
a stable id, a generated name ("Quiet Otter") you can change in the Share
window or with `paperos.collab.setName()`, and a color from a fixed palette.
An agent connected to a tab over the MCP bridge appears as an extra
participant, "<name>'s agent", with a robot badge: it acts through that
tab, so its edits carry that tab's identity.

## Testing

- Unit tests (`src/collab/*.test.ts`): room ids and links, transport
  selection, awareness -> participants, the tldraw store binding (two
  stores through two documents), the project mirror (two project stores
  through two documents), shared file documents, and the sync server
  itself (two `y-websocket` clients in Node).
- End to end (`e2e/collab.spec.ts`): two browser contexts join one room
  through a local `tools/paperos-sync` instance that `playwright.config.ts`
  starts (`npm run e2e`); no public server is used. A window created in one
  appears in the other, an edit in one editor shows in the other with the
  remote caret, the Share window lists both, the title-bar chip shows who is
  on the file, and leaving keeps the copy.

## Limits and notes

- Peer-to-peer rooms are only reachable while at least one peer is online;
  with a sync server the room is available as long as the server runs.
- The tiling layout, workspaces and the camera are per person. Sections
  (frames) and arrows are shared like windows.
- Folder projects: the creator's folder receives the mirror's writes; joiners
  get a memory copy of the project.
- Binary files are not part of projects yet, so they are not shared either.
- There is no access control beyond the room id and password: anyone with
  the link (and the password) is a full participant.
