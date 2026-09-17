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
- One tool per Canvas API method that takes no callback. Input
  schemas come from `src/api/schema.ts`; `readOnlyHint` is set on queries.
- `canvas_screenshot` returns the PNG as an MCP image (windows render as
  titled frames; their live HTML bodies are not captured).
- `events_poll` returns the last 200 canvas events (`window.created`,
  `layout.changed`, `file.changed`, ...) for agents that want to react.
- Two **local tools** the CLI runs itself, on your machine, instead of
  forwarding to the tab: `browser_fetch` and `browser_screenshot` (below).

## A real browser through the bridge

The Browser window (New window → Browser) shows pages in a sandboxed iframe.
Many sites refuse to be framed (`X-Frame-Options`, `frame-ancestors`); the
window then shows a card with "Open in new tab" and, when the bridge is
connected, "Screenshot via bridge". Agents get the same reach as two MCP
tools:

| Tool                 | What it does                                                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser_fetch`      | `{url, selector?, maxChars?, waitMs?}` → `{url, title, text, via}`. With Playwright: loads the page in headless Chromium and returns its visible text (`selector` narrows it). Without: a plain `fetch` and tag stripping (`via: "fetch"`, no JavaScript ran). |
| `browser_screenshot` | `{url, width?, height?, fullPage?, waitMs?}` → a PNG image plus `{url, title, width, height}`. Needs Playwright; without it the error says how to install it.                                                                                                  |

Playwright is optional and never installed by `npm run mcp:build`. To turn
it on:

```bash
npm --prefix tools/paperos-mcp install playwright
npx --prefix tools/paperos-mcp playwright install chromium
```

The CLI loads it with a dynamic `import("playwright")` at call time, so
nothing changes when it is absent. Both tools only accept `http(s)` URLs,
launch a fresh headless browser per call and close it afterwards.

The tab reaches the same tools over the bridge: the protocol (v2) has
`request` / `response` messages going tab → CLI, next to the agent's
`call` / `result`. The Browser window's "Screenshot via bridge" is
`browser.screenshot` sent that way; the Terminal's bridge shell (M7) uses the
same channel.

## A real shell through the bridge

The Terminal window's **Bridge shell** backend runs a shell on your machine.
The CLI spawns it (`shell.spawn`), forwards what you type (`shell.write`),
streams its output back to the tab as `stream` messages on channel
`shell:<id>` and ends it with `shell.kill`. These `shell.*` tools are
**tab-only**: they are not offered to the agent over MCP (the agent has its
own shell), and they only run after the person clicks **Start shell** in the
Terminal window's confirmation, once per tab session.

- Shell: `$SHELL` (or `powershell.exe` / `%COMSPEC%` on Windows), started
  where the CLI runs (`PAPEROS_SHELL_CWD` overrides the directory).
- With [`node-pty`](https://www.npmjs.com/package/node-pty) installed next
  to the CLI (`npm --prefix tools/paperos-mcp install node-pty`) the shell
  gets a pty: prompts, job control, interactive programs (ANSI codes are
  stripped for display). Without it the shell runs on pipes in line mode.
- `PAPEROS_BRIDGE_NO_SHELL=1` makes the CLI refuse every spawn.
- Shells die when the tab disconnects or the CLI exits.

`paperos.terminal.write()` (and the `terminal_write` MCP tool) can type into
a running bridge shell, so an agent can drive a shell the person started.
Treat that like the rest of the bridge: loopback only, no authentication,
pause the agent from the Agent window when in doubt.

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
done. The bridge shell goes further (a real shell with your user's
privileges), which is why it is opt-in from the Terminal window and never
started by an agent. It listens on loopback only and has no authentication, which is the
usual trade-off for local MCP servers; do not forward the port. Use the
Agent window's Pause switch when you want to look before the agent acts.

## Demo and tests

`node tools/paperos-mcp/scripts/demo.mjs [outDir]` starts the CLI, opens a
headless PaperOS tab with `?bridge=1`, creates windows and applies a layout
through the SDK's MCP client, and saves a screenshot and a video. The
protocol (`src/api/bridge-protocol.ts`) and the tab side
(`src/api/bridge-client.ts`) have unit tests; `npm run api:gen` regenerates
the CLI's copy of the shared modules, and a test fails when they drift.
