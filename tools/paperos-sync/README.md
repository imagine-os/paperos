# paperos-sync

A y-websocket relay for PaperOS rooms. One process, one port, rooms in
memory, no accounts. From a checkout:

```bash
npm run sync            # ws://0.0.0.0:1234
npm run sync -- --port 8080 --host 127.0.0.1
```

Standalone (copies only this folder):

```bash
npm install
npm start
```

Then share rooms with `/app?room=<id>&sync=ws://your-host:1234`, or set
`NEXT_PUBLIC_PAPEROS_SYNC_URL=wss://your-host` at build time to make it the
default transport. See [`docs/COLLAB.md`](../../docs/COLLAB.md).
