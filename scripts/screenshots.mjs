#!/usr/bin/env node
// Capture desktop (1440x900) and mobile (390x844) screenshots of all five pages, plus the
// mobile menu open, from the PRODUCTION build (`npm --prefix frontend run build` first).
//
// It starts the data service (uvicorn, port 8000) and `next start` (port 3200) itself and
// stops both at the end. /api/v1/metadata is answered by the real FastAPI process.
//
// Usage: node scripts/screenshots.mjs
// Env:   PLAYWRIGHT_CORE (default /home/box/.local/lib/node_modules/playwright-core)
//        CHROME_PATH     (default /usr/bin/google-chrome)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "QA_REPORTS", "skeleton-screenshots");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? "/home/box/.local/lib/node_modules/playwright-core");

const WEB = "http://127.0.0.1:3200";
const API = "http://127.0.0.1:8000";
const pages = [
  ["fleet-overview", "/"],
  ["asset-details", "/asset-details"],
  ["maintenance-planner", "/maintenance-planner"],
  ["model-performance", "/model-performance"],
  ["about-data", "/about-data"],
];

function start(cmd, args, cwd) {
  // detached = own process group, so stop() also ends grandchildren (npx -> next-server).
  const child = spawn(cmd, args, { cwd, stdio: "ignore", detached: true });
  child.on("error", (e) => console.error(`failed to start ${cmd}:`, e.message));
  return child;
}

function stop(child) {
  try {
    process.kill(-child.pid);
  } catch {
    /* already gone */
  }
}

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${url}`);
}

// Refuse to run against a stale server left on our ports (it could serve an old build).
for (const url of [`${API}/api/v1/health`, WEB]) {
  const inUse = await fetch(url).then(() => true, () => false);
  if (inUse) {
    console.error(`${url} already answers; stop whatever uses that port and retry.`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
const api = start("uv", ["run", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", "8000"], root);
const web = start("npx", ["next", "start", "-p", "3200", "-H", "127.0.0.1"], join(root, "frontend"));
let browser;
try {
  await waitFor(`${API}/api/v1/health`);
  await waitFor(WEB);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome" });

  const sizes = [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ];
  for (const [label, viewport] of sizes) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    // Forward the browser's /api/v1 calls to the real FastAPI process (production `next start`
    // has no proxy configured; on Vercel a rewrite does this).
    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const res = await fetch(API + url.pathname + url.search);
      await route.fulfill({
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body: Buffer.from(await res.arrayBuffer()),
      });
    });
    for (const [name, path] of pages) {
      await page.goto(WEB + path, { waitUntil: "networkidle" });
      // On mobile the sidebar (and its footer) is hidden, so wait for it to be attached only.
      await page.getByText(/none yet/).waitFor({ state: "attached" });
      await page.screenshot({ path: join(outDir, `${name}-${label}.png`), fullPage: true });
      console.log("saved", `${name}-${label}.png`);
    }
    if (label === "mobile") {
      await page.goto(WEB + "/", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByRole("button", { name: /Close menu/ }).waitFor();
      await page.screenshot({ path: join(outDir, "menu-open-mobile.png") });
      console.log("saved menu-open-mobile.png");
    }
    await ctx.close();
  }
} finally {
  await browser?.close();
  stop(api);
  stop(web);
}
