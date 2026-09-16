// Static export for GitHub Pages: `PAPEROS_STATIC=1 next build` (cross-platform)
// plus the `.nojekyll` marker so Pages serves the `_next/` directory.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const next = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);
const result = spawnSync(next, ["build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PAPEROS_STATIC: "1" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync(path.join(root, "out", ".nojekyll"), "");
console.log(
  "Static export written to out/ (base path " +
    (process.env.PAPEROS_BASE_PATH ?? "/paperos") +
    ")"
);
