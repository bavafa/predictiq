#!/usr/bin/env node
// Capture screenshots from the PRODUCTION web build (`npm --prefix frontend run build` first) against a real
// data service process (uvicorn) that this script starts, and stops at the end.
//
//   node scripts/screenshots.mjs                      all five pages, desktop + mobile, mobile menu (default
//                                                     bundle: none, so the pages show their "no model data" state)
//   node scripts/screenshots.mjs --real               the same against the REAL local bundle in
//                                                     artifacts/piq-*/bundle (simulated sample data)
//   node scripts/screenshots.mjs --real --fleet       Fleet Overview only: desktop, mobile and its key states
//                                                     (loading, empty filter result, error, cut-off changed,
//                                                     replay start / end, charts as tables), written to
//                                                     docs/QA_REPORTS/stage3-screenshots/
//   node scripts/screenshots.mjs --real --stage3     the complete Stage 3 set into docs/QA_REPORTS/stage3-screenshots/:
//                                                     Fleet Overview (as --fleet), Asset Details (desktop, mobile and
//                                                     key states) and About & Data (desktop, mobile, metadata failed)
//   node scripts/screenshots.mjs --real --stage4     the Stage 4 set into docs/QA_REPORTS/stage4-screenshots/: Maintenance
//                                                     Planner (desktop, mobile and key states) and the Fleet Overview
//                                                     guide
//   --out <dir>   write somewhere else
//
// Env: PLAYWRIGHT_CORE (default /home/box/.local/lib/node_modules/playwright-core)
//      CHROME_PATH     (default /usr/bin/google-chrome)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const real = args.includes("--real");
const stage3 = args.includes("--stage3");
const stage4 = args.includes("--stage4");
const fleetOnly = args.includes("--fleet") || stage3;
const outArg = args.indexOf("--out");
const outDir = outArg >= 0 ? resolve(args[outArg + 1]) : join(root, "docs", "QA_REPORTS", stage4 ? "stage4-screenshots" : fleetOnly ? "stage3-screenshots" : "skeleton-screenshots");
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

/** The newest real (non-synthetic) bundle under artifacts/, or null. */
function realBundle() {
  const artifacts = join(root, "artifacts");
  if (!existsSync(artifacts)) return null;
  for (const name of readdirSync(artifacts).sort().reverse()) {
    const meta = join(artifacts, name, "bundle", "meta.json");
    if (name.startsWith("piq-") && existsSync(meta) && JSON.parse(readFileSync(meta, "utf8")).synthetic === false) {
      return dirname(meta);
    }
  }
  return null;
}

function start(cmd, args, cwd, env = {}) {
  // detached = own process group, so stop() also ends grandchildren (npx -> next-server).
  const child = spawn(cmd, args, { cwd, stdio: "ignore", detached: true, env: { ...process.env, ...env } });
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

// Refuse to run against a stale server left on our ports (it could serve an old build or other data).
for (const url of [`${API}/api/v1/health`, WEB]) {
  const inUse = await fetch(url).then(() => true, () => false);
  if (inUse) {
    console.error(`${url} already answers; stop whatever uses that port and retry.`);
    process.exit(1);
  }
}

let bundle = join(root, ".screenshots-no-bundle"); // a path that does not exist means "no bundle"
if (real) {
  const found = realBundle();
  if (!found) {
    console.error("No real bundle in artifacts/ (run scripts/fetch_bundle.py or scripts/build_bundle.py).");
    process.exit(1);
  }
  bundle = found;
}

mkdirSync(outDir, { recursive: true });
const api = start("uv", ["run", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", "8000"], root, { PREDICTIQ_BUNDLE_DIR: bundle });
const web = start("npx", ["next", "start", "-p", "3200", "-H", "127.0.0.1"], join(root, "frontend"));
let browser;

const sizes = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // Forward the browser's /api/v1 calls to the real FastAPI process (the production `next start` of a build
  // made without API_PROXY_URL has no proxy; on Vercel a rewrite does this).
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const req = route.request();
    const body = req.postDataBuffer();
    const res = await fetch(API + url.pathname + url.search, {
      method: req.method(),
      headers: body ? { "content-type": req.headers()["content-type"] ?? "application/json" } : undefined,
      body: body ?? undefined,
    });
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  return [ctx, page];
}

const save = async (page, name, options = { fullPage: true }) => {
  await page.screenshot({ path: join(outDir, `${name}.png`), ...options });
  console.log("saved", `${name}.png`);
};

/** Wait until a page's own content has settled. Without a bundle every body is the no-model-data notice. */
async function settled(page, path) {
  if (!real) {
    await page.getByTestId("no-model-data").or(page.getByText(/none yet/)).first().waitFor({ state: "attached" });
  } else if (path === "/") {
    await page.getByTestId("card-shown").waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="fleet-ready"]')?.getAttribute("aria-busy") !== "true");
  } else {
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  await page.waitForTimeout(250);
}

async function capturePages() {
  for (const [label, viewport] of sizes) {
    const [ctx, page] = await newPage(viewport);
    for (const [name, path] of pages) {
      await page.goto(WEB + path, { waitUntil: "networkidle" });
      await settled(page, path);
      await save(page, `${name}-${label}`);
    }
    if (label === "mobile") {
      await page.goto(WEB + "/", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByRole("button", { name: /Close menu/ }).waitFor();
      await save(page, "menu-open-mobile", { fullPage: false });
    }
    await ctx.close();
  }
}

async function captureFleet() {
  const meta = await (await fetch(`${API}/api/v1/metadata`)).json();
  const hour = (t) => t.slice(0, 16);
  const first = hour(meta.replay_window.start);
  const last = hour(meta.replay_window.end);
  const ready = async (page) => {
    await page.getByTestId("card-shown").waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="fleet-ready"]')?.getAttribute("aria-busy") !== "true");
    await page.waitForTimeout(300);
  };

  for (const [label, viewport] of sizes) {
    const [ctx, page] = await newPage(viewport);
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `fleet-overview-${label}`);

    // cut-off changed (custom), with the note
    await page.goto(WEB + "/?cutoff=20", { waitUntil: "networkidle" });
    await ready(page);
    await page.getByRole("slider", { name: "Alert cut-off" }).focus();
    await page.keyboard.press("ArrowRight"); // 21%: a real change in this session shows the note
    await page.getByTestId("cutoff-note").waitFor();
    await ready(page);
    await save(page, `fleet-overview-state-cutoff-changed-${label}`);

    // filtered to nothing
    await page.goto(WEB + "/?cutoff=100&status=alert&machine_model=model1", { waitUntil: "networkidle" });
    await page.getByTestId("empty-result").waitFor();
    await page.waitForTimeout(300);
    await save(page, `fleet-overview-state-empty-${label}`);

    // replay start of the window and end of the window
    await page.goto(WEB + `/?at=${first}`, { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `fleet-overview-state-replay-start-${label}`);
    await page.goto(WEB + `/?at=${last}`, { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `fleet-overview-state-replay-end-${label}`);

    // charts as tables
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    await ready(page);
    for (const id of ["risk-chart", "trend-chart"]) await page.getByTestId(id).getByRole("button", { name: "View as table" }).click();
    await save(page, `fleet-overview-state-charts-as-tables-${label}`);
    await ctx.close();
  }

  // loading and error (desktop)
  {
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.route("**/api/v1/fleet?**", async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.fallback().catch(() => {}); // on to the forwarder registered first
    });
    // The handler registered last runs first: this one holds the request, then falls back to the forwarder.
    await page.goto(WEB + "/", { waitUntil: "domcontentloaded" });
    await page.getByTestId("fleet-loading").waitFor();
    await page.waitForTimeout(300);
    await save(page, "fleet-overview-state-loading-desktop");
    await ctx.close();
  }
  {
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.route("**/api/v1/fleet?**", (route) =>
      route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "Internal error", status: 500 }) }),
    );
    await page.goto(WEB + "/?status=alert", { waitUntil: "networkidle" });
    await page.getByTestId("service-error").first().waitFor();
    await save(page, "fleet-overview-state-error-desktop");
    await ctx.close();
  }
}

const problem500 = { status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "Internal error", status: 500 }) };

/** A machine and hour on the real bundle with a recorded failure, an error and a repair in the last 7 days (Alert if possible). */
async function pickBusyMachine(meta) {
  const mv = meta.model_version;
  const from = Date.parse(meta.replay_window.start.slice(0, 16) + ":00Z");
  const to = Date.parse(meta.replay_window.end.slice(0, 16) + ":00Z");
  const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
  let fallback = null;
  for (let ms = from + 24 * 3600e3; ms <= to; ms += 37 * 3600e3) {
    for (let m = 1; m <= 100; m += 1) {
      const a = await (await fetch(`${API}/api/v1/assets/${m}?at=${iso(ms)}&cutoff=${meta.default_cutoff_percent}&mv=${mv}`)).json();
      if (a.failures.length > 0 && a.errors.length > 0 && a.repairs.length > 0) {
        if (a.status === "alert") return { machine: m, at: iso(ms) };
        fallback ??= { machine: m, at: iso(ms) };
      }
    }
  }
  if (!fallback) throw new Error("no machine with a failure, an error and a repair in the replay window");
  return fallback;
}

async function captureAsset() {
  const meta = await (await fetch(`${API}/api/v1/metadata`)).json();
  const hour = (t) => t.slice(0, 16);
  const first = hour(meta.replay_window.start);
  const last = hour(meta.replay_window.end);
  const { machine, at } = await pickBusyMachine(meta);
  console.log(`asset screenshots: machine ${machine} at ${at}`);
  const base = `/asset-details?machine=${machine}&at=${at}`;
  const ready = async (page) => {
    await page.getByTestId("asset-score").waitFor();
    await page.getByTestId("explanation-table").waitFor();
    await page.getByTestId("sensor-volt").waitFor();
    await page.waitForTimeout(400);
  };

  for (const [label, viewport] of sizes) {
    const [ctx, page] = await newPage(viewport);
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `asset-details-${label}`);

    await page.goto(WEB + base + "&cutoff=20", { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `asset-details-state-cutoff-changed-${label}`);

    await page.goto(WEB + "/asset-details", { waitUntil: "networkidle" });
    await page.getByTestId("no-machine").waitFor();
    await save(page, `asset-details-state-no-machine-${label}`);

    await page.goto(WEB + "/asset-details?machine=250", { waitUntil: "networkidle" });
    await page.getByTestId("machine-not-found").waitFor();
    await save(page, `asset-details-state-not-found-${label}`);

    await page.goto(WEB + `/asset-details?machine=${machine}&at=${first}`, { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `asset-details-state-replay-start-${label}`);
    await page.goto(WEB + `/asset-details?machine=${machine}&at=${last}`, { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `asset-details-state-replay-end-${label}`);

    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await ready(page);
    await page.getByRole("radio", { name: "7 days" }).click();
    await page.getByTestId("sensor-volt-summary").getByText(/168 hourly readings/).waitFor();
    await page.waitForTimeout(400);
    await save(page, `asset-details-state-7-days-${label}`);
    await page.getByRole("radio", { name: "24 h" }).click();
    await page.getByTestId("sensor-volt-summary").getByText(/24 hourly readings/).waitFor();
    await page.getByTestId("past-estimates").getByRole("button", { name: "View as table" }).click();
    // every sensor chart on screen (all of them on desktop, the chosen tab on mobile)
    const sensorTables = page.getByTestId("sensor-tabs").or(page.getByTestId("sensor-grid")).getByRole("button", { name: "View as table" });
    for (let n = await sensorTables.count(); n > 0; n--) await sensorTables.first().click();
    await save(page, `asset-details-state-charts-as-tables-${label}`);

    if (label === "mobile") {
      await page.goto(WEB + base, { waitUntil: "networkidle" });
      await ready(page);
      await page.getByRole("tab", { name: "Rotation" }).click();
      await page.getByTestId("sensor-rotate").waitFor();
      await save(page, "asset-details-state-rotation-tab-mobile");
    }
    await ctx.close();
  }

  {
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await ready(page);
    await page.getByTestId("explanation-row").first().getByRole("button", { name: /What .* means/ }).click();
    await save(page, "asset-details-state-input-definition-desktop");
    await ctx.close();
  }
  {
    // loading: the machine's answers are held back
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.route("**/api/v1/assets/**", async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.fallback().catch(() => {});
    });
    await page.goto(WEB + base, { waitUntil: "domcontentloaded" });
    await page.getByTestId("skeleton").first().waitFor();
    await page.waitForTimeout(600);
    await save(page, "asset-details-state-loading-desktop");
    await ctx.close();
  }
  {
    // partial: the sensor history fails, the rest of the page stays
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.route("**/api/v1/assets/*/telemetry**", (route) => route.fulfill(problem500));
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await page.getByTestId("sensor-error").waitFor();
    await page.getByTestId("asset-score").waitFor();
    await page.waitForTimeout(300);
    await save(page, "asset-details-state-partial-desktop");
    await ctx.close();
  }
  {
    // panel error: the explanation fails
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.route("**/api/v1/assets/*/explanation**", (route) => route.fulfill(problem500));
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await page.getByTestId("explanation-error").waitFor();
    await page.waitForTimeout(300);
    await save(page, "asset-details-state-panel-error-desktop");
    await ctx.close();
  }
}

const PLAN_READY = '[data-testid="planner-ready"]';

async function captureStage4() {
  // A cut-off low enough that the list is long, and an hour where the machine models are mixed in it.
  const base = "/maintenance-planner?cutoff=20";
  const ready = async (page) => {
    await page.locator(PLAN_READY).waitFor();
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("aria-busy") !== "true", PLAN_READY);
    await page.waitForTimeout(350);
  };

  for (const [label, viewport] of sizes) {
    const [ctx, page] = await newPage(viewport);
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    await page.getByTestId("guide").waitFor();
    await page.getByTestId("card-shown").waitFor();
    await page.waitForTimeout(300);
    await save(page, `fleet-overview-guide-${label}`, { fullPage: false });

    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await ready(page);
    await save(page, `maintenance-planner-${label}`);

    // per-model cost: raise the model of the last listed machine so machines move up
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await ready(page);
    const lastModel = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-testid="plan-row"]')];
      const cards = [...document.querySelectorAll('[data-testid="plan-card"]')];
      const row = rows.at(-1);
      if (row) return row.querySelector("td:nth-child(3)").textContent;
      return /model [a-z0-9]+/.exec(cards.at(-1).textContent)[0].split(" ")[1];
    });
    await page.getByText("Set cost per machine model (optional)").click();
    await page.getByTestId(`cost-${lastModel}`).fill("40000");
    await page.getByTestId("order-note").waitFor();
    await ready(page);
    await save(page, `maintenance-planner-state-per-model-cost-${label}`);

    // effectiveness on
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await ready(page);
    await page.getByTestId("reduction-toggle").check();
    await page.getByTestId("net-benefit-summary").waitFor();
    await ready(page);
    await save(page, `maintenance-planner-state-effectiveness-on-${label}`);

    // invalid input
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await ready(page);
    await page.getByTestId("failure-cost").fill("-500");
    await page.getByTestId("invalid-note").waitFor();
    await save(page, `maintenance-planner-state-invalid-input-${label}`);

    // no machines at or above the cut-off
    await page.goto(WEB + "/maintenance-planner?cutoff=100", { waitUntil: "networkidle" });
    await page.getByTestId("planner-empty").waitFor();
    await page.waitForTimeout(300);
    await save(page, `maintenance-planner-state-empty-${label}`);
    await ctx.close();
  }

  {
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.route("**/api/v1/plan**", async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.fallback().catch(() => {});
    });
    await page.goto(WEB + base, { waitUntil: "domcontentloaded" });
    await page.getByTestId("planner-loading").waitFor();
    await page.waitForTimeout(400);
    await save(page, "maintenance-planner-state-loading-desktop");
    await ctx.close();
  }
  {
    const [ctx, page] = await newPage(sizes[0][1]);
    await page.route("**/api/v1/plan**", (route) => route.fulfill(problem500));
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await page.getByTestId("planner-error").waitFor();
    await save(page, "maintenance-planner-state-error-desktop");
    await ctx.close();
  }
  {
    const [ctx, page] = await newPage(sizes[1][1]);
    await page.route("**/api/v1/plan**", (route) => route.fulfill(problem500));
    await page.goto(WEB + base, { waitUntil: "networkidle" });
    await page.getByTestId("planner-error").waitFor();
    await save(page, "maintenance-planner-state-error-mobile");
    await ctx.close();
  }
}

async function captureAbout() {
  for (const [label, viewport] of sizes) {
    const [ctx, page] = await newPage(viewport);
    await page.goto(WEB + "/about-data", { waitUntil: "networkidle" });
    await page.getByTestId("model-facts").getByText(/piq-/).waitFor();
    await page.waitForTimeout(250);
    await save(page, `about-data-${label}`);
    await ctx.close();
  }
  const [ctx, page] = await newPage(sizes[1][1]);
  await page.route("**/api/v1/metadata", (route) => route.fulfill(problem500));
  await page.goto(WEB + "/about-data", { waitUntil: "networkidle" });
  await page.getByText(/couldn.t load right now/).waitFor();
  await save(page, "about-data-state-metadata-failed-mobile");
  await ctx.close();
}

try {
  await waitFor(`${API}/api/v1/health`);
  await waitFor(WEB);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome" });
  if (stage4) {
    if (!real) throw new Error("--stage4 needs --real");
    await captureStage4();
  } else if (fleetOnly) {
    if (!real) throw new Error("--fleet needs --real (the Fleet Overview has nothing to show without model data)");
    await captureFleet();
    if (stage3) {
      await captureAsset();
      await captureAbout();
    }
  } else {
    await capturePages();
  }
} finally {
  await browser?.close();
  stop(api);
  stop(web);
}
