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
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
