import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOLS } from "./schema";

const root = join(__dirname, "../..");

describe("generated artifacts stay in sync with src/api", () => {
  it("docs/CANVAS_API.md documents every tool", () => {
    const md = readFileSync(join(root, "docs/CANVAS_API.md"), "utf8");
    for (const t of TOOLS) expect(md, t.name).toContain(`#### \`${t.name}\``);
    expect(md).toContain(`${TOOLS.length} methods`);
  });

  it("the MCP CLI has verbatim copies of the shared modules (npm run api:gen)", () => {
    for (const f of ["schema.ts", "bridge-protocol.ts"]) {
      const source = readFileSync(join(root, "src/api", f), "utf8");
      const copy = readFileSync(
        join(root, "tools/paperos-mcp/src/shared", f),
        "utf8"
      );
      expect(copy, `${f} differs: run npm run api:gen`).toBe(source);
    }
  });
});
