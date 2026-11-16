import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// End-to-end tests run against a REAL stack (started below): FastAPI via uvicorn serving a bundle, and the
// production Next.js build (`next start`) proxying /api/v1 to it. Start them with `npm run e2e`, which builds
// first and runs every mode (scripts/e2e.mjs). E2E_MODE says which bundle the API serves:
//   synthetic  the generated test bundle (CI)            none  no bundle: the "no model data" state
//   real       the real local bundle, opt-in: `npm run e2e:real`
// Locally (not in CI) an installed system Chrome is reused so no browser download is needed;
// override with PLAYWRIGHT_CHROME_PATH. CI installs Playwright's chromium instead.
const port = Number(process.env.E2E_PORT ?? 3100);
const apiPort = Number(process.env.E2E_API_PORT ?? 8765);
const mode = process.env.E2E_MODE ?? "synthetic";
const bundleDir = process.env.E2E_BUNDLE_DIR ?? "";
const systemChrome = "/usr/bin/google-chrome";
const executablePath =
  process.env.PLAYWRIGHT_CHROME_PATH || (!process.env.CI && existsSync(systemChrome) ? systemChrome : undefined);

export default defineConfig({
  testDir: "./e2e",
  testMatch: mode === "none" ? "no-model.spec.ts" : undefined,
  testIgnore: mode === "none" ? undefined : "no-model.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    // The "Time controls" panel starts closed for a new visitor; the tests start with it open (the
    // default-closed path has its own test in shell.spec.ts, which clears this).
    storageState: {
      cookies: [],
      origins: [{ origin: `http://127.0.0.1:${port}`, localStorage: [
            { name: "piq-time-panel", value: "on" },
            { name: "piq-model-details", value: "on" },
          ] }],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } }],
  webServer: [
    {
      // The data service. Never reuse a server that is already running: it could be serving other data.
      // A long keep-alive: Next's proxy reuses sockets for about 5 s and uvicorn's default of 5 s closes them at
      // the same moment, which seemed to leave proxied requests hanging for minutes in parallel runs. Only the
      // local test stack needs this; on Vercel there is no such proxy.
      command: `uv run uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port ${apiPort} --timeout-keep-alive 75`,
      cwd: "..",
      env: { PREDICTIQ_BUNDLE_DIR: bundleDir },
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next start -p ${port} -H 127.0.0.1`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
