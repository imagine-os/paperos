import { defineConfig, devices } from "@playwright/test";

// Run with: npm run e2e
// Chromium must be available to Playwright (PLAYWRIGHT_BROWSERS_PATH or
// `npx playwright install chromium`).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    // A local y-websocket relay for the collaboration test (no public servers in tests).
    {
      command:
        "node tools/paperos-sync/server.mjs --port 17334 --host 127.0.0.1",
      url: "http://127.0.0.1:17334",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
