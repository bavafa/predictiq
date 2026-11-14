import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Smoke test against the production build (`next start`).
// Locally (not in CI) an installed system Chrome is reused so no browser download is needed;
// override with PLAYWRIGHT_CHROME_PATH. CI installs Playwright's chromium instead.
const port = Number(process.env.E2E_PORT ?? 3100);
const systemChrome = "/usr/bin/google-chrome";
const executablePath =
  process.env.PLAYWRIGHT_CHROME_PATH || (!process.env.CI && existsSync(systemChrome) ? systemChrome : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } }],
  webServer: {
    command: `npx next start -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
