#!/usr/bin/env node
/**
 * paperos-mcp: an MCP server over stdio plus a local WebSocket bridge the
 * PaperOS tab connects to. No accounts, no network beyond 127.0.0.1.
 *
 *   paperos-mcp [--port 7331] [--host 127.0.0.1]
 *   PAPEROS_BRIDGE_PORT=7331 paperos-mcp
 *
 * Logs go to stderr (stdout is the MCP channel).
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeServer } from "./bridge-server.js";
import { createMcpServer } from "./mcp.js";
import { BRIDGE_DEFAULT_PORT } from "./shared/bridge-protocol.js";

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function parseArgs(argv: string[]) {
  let port = Number(process.env.PAPEROS_BRIDGE_PORT ?? BRIDGE_DEFAULT_PORT);
  let host = process.env.PAPEROS_BRIDGE_HOST ?? "127.0.0.1";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" && argv[i + 1]) port = Number(argv[++i]);
    else if (argv[i] === "--host" && argv[i + 1]) host = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      process.stderr.write(
        "paperos-mcp [--port 7331] [--host 127.0.0.1]\nMCP server over stdio; the PaperOS tab connects to ws://host:port.\n"
      );
      process.exit(0);
    }
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    process.stderr.write(`Invalid port: ${port}\n`);
    process.exit(2);
  }
  return { port, host };
}

async function main() {
  const { port, host } = parseArgs(process.argv.slice(2));
  const log = (line: string) => process.stderr.write(`[paperos-mcp] ${line}\n`);
  const bridge = new BridgeServer({ port, host, log });
  try {
    await bridge.listen();
  } catch (e) {
    log(`cannot listen on ${host}:${port}: ${e instanceof Error ? e.message : String(e)}`);
    log("Is another paperos-mcp running? Pass --port to use a different one (and open PaperOS with ?bridge=1 after changing the tab's URL in the Agent window).");
    process.exit(1);
  }
  const server = createMcpServer(bridge, readVersion());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server ready on stdio; waiting for a PaperOS tab (turn on Agent bridge in the top bar or open ?bridge=1)");

  const shutdown = async () => {
    await bridge.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  transport.onclose = () => void shutdown();
}

void main();
