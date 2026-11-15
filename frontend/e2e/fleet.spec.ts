import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { addHours, readWindow, shownHour } from "./support";
import { machineName } from "../lib/machine-types";

type FleetAnswer = {
  cutoff_percent: number;
  cards: { machines_shown: number; machines_in_alert: number; highest_score: number | null };
  rows: { machine_id: number; status: string; model: string }[];
};

/** The data service's own answer, read the way the page reads it. */
async function fleetApi(request: APIRequestContext, at: string, cutoff: number, extra: Record<string, string> = {}) {
  const meta = await (await request.get("/api/v1/metadata")).json();
  const params = new URLSearchParams({ at, cutoff: String(cutoff), mv: meta.model_version, ...extra });
  const res = await request.get(`/api/v1/fleet?${params}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as FleetAnswer;
}

const num = async (page: Page, id: string) => Number((await page.getByTestId(id).textContent()) ?? "NaN");

async function loaded(page: Page) {
  await expect(page.getByTestId("card-shown")).toBeVisible();
  await expect(page.getByTestId("fleet-ready")).not.toHaveAttribute("aria-busy", "true");
}

/** Status of every row across all pages of the table. */
async function allStatuses(page: Page): Promise<string[]> {
  const out: string[] = [];
  for (;;) {
    out.push(...(await page.getByTestId("fleet-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-status") ?? ""))));
    const next = page.getByRole("button", { name: /Next/ });
    if ((await next.getAttribute("aria-disabled")) === "true") return out;
    await next.click();
  }
}

async function blocking(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
}

test("the cards, charts and table show what the data service answers at the replay start", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto("/");
  await loaded(page);
  const api = await fleetApi(request, w.start, w.cutoff);
  expect(await num(page, "card-shown")).toBe(api.cards.machines_shown);
  expect(await num(page, "card-alert")).toBe(api.cards.machines_in_alert);
  await expect(page.getByTestId("cutoff-value")).toHaveText(`${w.cutoff}% (default)`);
  await expect(page.getByTestId("risk-chart")).toBeVisible();
  await expect(page.getByTestId("trend-chart")).toBeVisible();
  // ranked riskiest first: the first row is the service's rank 1
  await expect(page.getByTestId("fleet-row").first()).toHaveAttribute("data-machine", String(api.rows[0]!.machine_id));
  // every number is labelled; the screen never says live
  await expect(page.locator('[data-value-label="Predicted"]').first()).toBeVisible();
  await expect(page.locator('[data-value-label="Historical"]').first()).toBeVisible();
  expect((await page.locator("body").innerText()).toLowerCase()).not.toMatch(/\blive\b|real-time|savings/);
});

test("the Alert count equals the Alert rows of the filtered table, for every filter", async ({ page, request }) => {
  const w = await readWindow(request);
  const cutoff = 5; // low enough that several machines are in Alert on any bundle
  await page.goto(`/?cutoff=${cutoff}`);
  await loaded(page);
  for (const model of ["", "model1", "model2", "model3", "model4"]) {
    for (const status of ["", "alert", "below_cutoff"]) {
      await page.getByRole("combobox", { name: "Machine model" }).selectOption(model);
      await page.getByRole("combobox", { name: "Status" }).selectOption(status);
      const extra: Record<string, string> = {};
      if (model) extra.machine_model = model;
      if (status) extra.status = status;
      const api = await fleetApi(request, w.start, cutoff, extra);
      await expect.poll(() => num(page, "card-shown")).toBe(api.cards.machines_shown);
      const shown = api.cards.machines_shown;
      expect(await num(page, "card-alert")).toBe(api.cards.machines_in_alert);
      if (shown > 0) {
        const statuses = await allStatuses(page);
        expect(statuses).toHaveLength(shown);
        expect(statuses.filter((s) => s === "alert")).toHaveLength(await num(page, "card-alert"));
        await expect(page.getByTestId("table-count")).toContainText(`of ${shown}`);
        // back to the first page for the next combination
        if (await page.getByRole("button", { name: /Previous/ }).isVisible()) {
          while ((await page.getByRole("button", { name: /Previous/ }).getAttribute("aria-disabled")) !== "true") {
            await page.getByRole("button", { name: /Previous/ }).click();
          }
        }
      } else {
        await expect(page.getByTestId("empty-result")).toBeVisible();
      }
    }
  }
});

test("changing the cut-off updates the count and the table together (and Reset returns to the default)", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto("/");
  await loaded(page);
  const slider = page.getByRole("slider", { name: "Alert cut-off" });
  await slider.focus();
  await page.keyboard.press("Home"); // 0%: every machine is at or above it
  await expect(page.getByTestId("cutoff-value")).toHaveText("0% (custom)");
  await expect.poll(() => num(page, "card-alert")).toBe((await fleetApi(request, w.start, 0)).cards.machines_in_alert);
  expect(await num(page, "card-alert")).toBe(await num(page, "card-shown"));
  expect((await allStatuses(page)).every((s) => s === "alert")).toBe(true);
  await expect(page.getByTestId("cutoff-note")).toContainText("Cut-off changed to 0%");
  await expect(page).toHaveURL(/cutoff=0/);

  await slider.focus(); // paging the table moved focus away
  await page.keyboard.press("End"); // 100%
  const api100 = await fleetApi(request, w.start, 100);
  await expect.poll(() => num(page, "card-alert")).toBe(api100.cards.machines_in_alert);
  expect((await allStatuses(page)).filter((s) => s === "alert")).toHaveLength(api100.cards.machines_in_alert);
  await expect(page.getByTestId("fleet-announcer")).toContainText(/Cut-off 100 percent\./);

  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(page.getByTestId("cutoff-value")).toHaveText(`${w.cutoff}% (default)`);
  await expect.poll(() => num(page, "card-alert")).toBe((await fleetApi(request, w.start, w.cutoff)).cards.machines_in_alert);
  await expect(page).not.toHaveURL(/cutoff=/);
});

test("stepping the replay changes the numbers, and they match the service at each hour", async ({ page, request }) => {
  const w = await readWindow(request);
  const from = addHours(w.last, -400);
  await page.goto(`/?at=${from}&cutoff=${w.cutoff}`);
  await loaded(page);
  await page.getByLabel("Step size").selectOption("24");
  const seen = new Set<string>();
  let hour = from;
  for (let i = 0; i < 8; i++) {
    const api = await fleetApi(request, hour, w.cutoff);
    await expect.poll(() => shownHour(page)).toBe(hour);
    await expect.poll(() => num(page, "card-alert")).toBe(api.cards.machines_in_alert);
    const highest = (await page.getByTestId("card-highest").textContent()) ?? "";
    seen.add(`${highest}|${api.cards.machines_in_alert}`);
    await page.getByRole("button", { name: "Step forward" }).click();
    hour = addHours(hour, 24);
  }
  expect(seen.size).toBeGreaterThan(1);
});

test("a machine row opens Asset Details at the same replay time and cut-off", async ({ page, request }) => {
  const w = await readWindow(request);
  const at = addHours(w.last, -30);
  await page.goto(`/?at=${at}&cutoff=40`);
  await loaded(page);
  const first = page.getByTestId("fleet-row").first();
  const machine = (await first.getAttribute("data-machine"))!;
  await first.getByRole("link", { name: machineName(machine) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Asset Details");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/asset-details");
  expect(url.searchParams.get("machine")).toBe(machine);
  expect(url.searchParams.get("at")).toBe(at);
  expect(url.searchParams.get("cutoff")).toBe("40");
});

test("filters sit in the address, and Clear filters removes them", async ({ page }) => {
  await page.goto("/");
  await loaded(page);
  await page.getByRole("combobox", { name: "Machine model" }).selectOption("model2");
  await expect(page).toHaveURL(/machine_model=model2/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/machine_model=/);
  await expect(page.getByRole("combobox", { name: "Machine model" })).toHaveValue("");
});

test("EMPTY FILTER RESULT: zero everywhere, filters stay in their fields", async ({ page }) => {
  await page.goto("/?cutoff=100&status=alert&machine_model=model1");
  const empty = page.getByTestId("empty-result");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("No machines match these filters at");
  await expect(page.getByTestId("card-shown")).toHaveText("0");
  await expect(page.getByTestId("card-alert")).toHaveText("0");
  await expect(page.getByTestId("card-highest")).toHaveText("None");
  await expect(page.getByTestId("risk-chart-summary")).toContainText("0 machines match these filters. Every bar is 0.");
  await expect(page.getByTestId("trend-chart-summary")).toContainText("the count is 0 at every hour");
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("alert");
  expect(await blocking(page)).toEqual([]);
  await empty.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByTestId("fleet-row").first()).toBeVisible();
});

test("ERROR: a failed request says what failed, keeps the settings and recovers on Try again", async ({ page }) => {
  let broken = true;
  await page.route("**/api/v1/fleet?**", (route) => (broken ? route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "boom", status: 500 }) }) : route.continue()));
  await page.goto("/?status=alert&cutoff=30");
  const err = page.getByTestId("service-error").first();
  await expect(err).toContainText("Couldn't load the fleet at");
  await expect(err).toContainText("Your settings are kept.");
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("alert");
  await expect(page.getByTestId("card-alert")).toHaveCount(0);
  broken = false;
  await err.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("card-alert")).toBeVisible();
});

test("LOADING: grey blocks while the first answer is awaited", async ({ page }) => {
  await page.route("**/api/v1/fleet?**", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByTestId("fleet-loading")).toBeVisible();
  await expect(page.getByTestId("skeleton").first()).toBeVisible();
  await expect(page.getByTestId("card-shown")).toBeVisible();
});

test("charts can be read as tables, and have a text summary", async ({ page }) => {
  await page.goto("/");
  await loaded(page);
  const risk = page.getByTestId("risk-chart");
  await expect(page.getByTestId("risk-chart-summary")).not.toBeEmpty();
  await risk.getByRole("button", { name: "View as table" }).click();
  await expect(risk.getByRole("table")).toBeVisible();
  await expect(risk.getByRole("row")).toHaveCount(11);
  const trend = page.getByTestId("trend-chart");
  await trend.getByRole("radio", { name: "7 days" }).click();
  await expect(trend.getByRole("radio", { name: "7 days" })).toHaveAttribute("aria-checked", "true");
  await trend.getByRole("button", { name: "View as table" }).click();
  await expect(trend.getByRole("table")).toBeVisible();
});

test("axe: Fleet Overview loaded, with the charts as tables and the empty state (desktop)", async ({ page }) => {
  await page.goto("/");
  await loaded(page);
  expect(await blocking(page)).toEqual([]);
  await page.getByTestId("risk-chart").getByRole("button", { name: "View as table" }).click();
  expect(await blocking(page)).toEqual([]);
});

test("axe and layout: Fleet Overview on a phone has a list, a Sort menu and no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await loaded(page);
  expect(await blocking(page)).toEqual([]);
  await expect(page.getByTestId("fleet-table")).toBeHidden();
  await expect(page.getByTestId("fleet-card-row").first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // 44px targets for controls
  for (const loc of [page.getByRole("slider", { name: "Alert cut-off" }), page.getByRole("combobox", { name: "Machine model" }), page.getByRole("combobox", { name: "Status" }), page.getByRole("textbox", { name: "Machine number" }), page.getByRole("combobox", { name: "Sort" }), page.getByRole("button", { name: /Next/ })]) {
    const box = (await loc.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
  }
  await page.getByRole("combobox", { name: "Sort" }).selectOption("machine-asc");
  await expect(page.getByTestId("fleet-card-row").first()).toContainText(machineName(1));
});

test("replay at the start and at the end still show the fleet for that hour", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto(`/?at=${w.first}`);
  await loaded(page);
  await expect(page.getByText("Start of the replay window.")).toBeVisible();
  expect(await num(page, "card-alert")).toBe((await fleetApi(request, w.first, w.cutoff)).cards.machines_in_alert);
  await page.goto(`/?at=${w.last}`);
  await loaded(page);
  await expect(page.getByTestId("end-state")).toBeVisible();
  expect(await num(page, "card-alert")).toBe((await fleetApi(request, w.last, w.cutoff)).cards.machines_in_alert);
});
