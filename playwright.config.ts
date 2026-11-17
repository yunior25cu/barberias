import { defineConfig, devices } from "@playwright/test";
const port = process.env.PLAYWRIGHT_PORT ?? "3000";
if (!/^\d{2,5}$/.test(port) || Number(port) > 65535) throw new Error("PLAYWRIGHT_PORT must be a valid TCP port.");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL, ...devices["iPhone 13"], browserName: "chromium" },
  webServer: { command: `npm run dev -- --port ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000, env: { NEXT_DIST_DIR: ".next-e2e" } },
});
