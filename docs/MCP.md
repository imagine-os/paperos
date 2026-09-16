# Agent bridge (MCP)

PaperOS keeps all of its state in the browser, so an agent cannot reach the
canvas from the outside. The **agent bridge** closes that gap with no vendor,
account or server: a small Node CLI, `tools/paperos-mcp`, runs on your
machine, speaks [MCP](https://modelcontextprotocol.io) over stdio to the
agent and opens a WebSocket on `127.0.0.1:7331` that your PaperOS tab
connects to. Every Canvas API method (see [`CANVAS_API.md`](CANVAS_API.md))
becomes an MCP tool named `<namespace>_<method>`: `windows_create`,
`layout_apply`, `files_write`, `canvas_screenshot`...

```
agent (Claude Desktop, Claude Code, ...)
   │  MCP over stdio
   ▼
paperos-mcp  ── ws://127.0.0.1:7331 ──▶  PaperOS tab (Agent bridge: connected)
                                              │
                                              ▼
                                         window.paperos (Canvas API)
```

Nothing is deployed: the Vercel build stays a static-ish Next app and the
bridge only accepts loopback connections.

## Quick start

1. Build the CLI once (installs its two dependencies, `@modelcontextprotocol/sdk`
   and `ws`, and compiles it):

   ```bash
   npm run mcp:build
   ```

2. Register it with your agent.

   **Claude Desktop** (`claude_desktop_config.json`):

   ```json
   {
     "mcpServers": {
       "paperos": {
         "command": "node",
         "args": ["/absolute/path/to/paperos/tools/paperos-mcp/dist/index.js"]
       }
     }
   }
   ```

   **Claude Code**:

   ```bash
   claude mcp add paperos -- node /absolute/path/to/paperos/tools/paperos-mcp/dist/index.js
   ```

   Or, from inside `tools/paperos-mcp`, the `npx` form works too:
   `{"command": "npx", "args": ["-y", "."]}` (the package's `prepare` step
   builds `dist/`).

   The agent starts the CLI itself; you do not run it by hand. To try it
   without an agent, `npm run mcp` starts the same process on your terminal
   (it waits for MCP messages on stdin).

3. Open PaperOS (`npm run dev`, <http://localhost:3000>) and click **Agent
   bridge: off** in the top bar. The dot turns amber while the tab waits for
   the CLI and green once connected. Opening the app with `?bridge=1` turns
   the bridge on too, and the choice is remembered in the browser.

4. Ask the agent to do something: "list the windows on my PaperOS canvas and
   tile them in a grid". Open an **Agent** window (New window → Agent) to
   watch the tool calls arrive; its **Pause** switch makes every call fail
   without touching the canvas.

## What the agent gets

- `bridge_status`: whether a tab is connected. Tools called with no tab
  connected return a clear error saying how to connect one.
- One tool per Canvas API method that takes no callback (41 of them). Input
  schemas come from `src/api/schema.ts`; `readOnlyHint` is set on queries.
- `canvas_screenshot` returns the PNG as an MCP image (windows render as
  titled frames; their live HTML bodies are not captured).
- `events_poll` returns the last 200 canvas events (`window.created`,
  `layout.changed`, `file.changed`, ...) for agents that want to react.

## Options

| Setting                         | Default     | Notes                                                                              |
| ------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `--port`, `PAPEROS_BRIDGE_PORT` | `7331`      | The tab connects to `ws://127.0.0.1:<port>`; today the tab only knows the default. |
| `--host`, `PAPEROS_BRIDGE_HOST` | `127.0.0.1` | Non-loopback clients are refused regardless.                                       |

Only one tab is served at a time: a newer tab replaces the previous one.
Calls time out after 30 s if the tab does not answer.

## Security

The bridge runs Canvas API calls in your browser tab with the tab's
privileges: whatever the agent asks (write a file, close every window) is
done. It listens on loopback only and has no authentication, which is the
usual trade-off for local MCP servers; do not forward the port. Use the
Agent window's Pause switch when you want to look before the agent acts.

## Demo and tests

`node tools/paperos-mcp/scripts/demo.mjs [outDir]` starts the CLI, opens a
headless PaperOS tab with `?bridge=1`, creates windows and applies a layout
through the SDK's MCP client, and saves a screenshot and a video. The
protocol (`src/api/bridge-protocol.ts`) and the tab side
(`src/api/bridge-client.ts`) have unit tests; `npm run api:gen` regenerates
the CLI's copy of the shared modules, and a test fails when they drift.
