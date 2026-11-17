import { defineConfig, devices } from "@playwright/test";

const port = "3018";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "landing.spec.ts",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL, ...devices["iPhone 13"], browserName: "chromium" },
  webServer: {
    command: "node .next/standalone/server.js",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: "", PORT: port, HOSTNAME: "127.0.0.1" },
  },
});
