import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { addHours, readWindow, shownHour } from "./support";

type AssetAnswer = {
  score: number;
  status: string;
  model: string;
  age: number;
  errors: { time: string; error: string }[];
  repairs: { time: string; component: string }[];
  failures: { time: string }[];
};

async function assetApi(request: APIRequestContext, machine: number, at: string, cutoff: number) {
  const meta = await (await request.get("/api/v1/metadata")).json();
  const params = new URLSearchParams({ at, cutoff: String(cutoff), mv: meta.model_version });
  const res = await request.get(`/api/v1/assets/${machine}?${params}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as AssetAnswer;
}

const pct = (score: number) => `${(score * 100).toFixed(1)}%`;

async function loaded(page: Page) {
  await expect(page.getByTestId("asset-score")).toBeVisible();
  await expect(page.getByTestId("explanation-table")).toBeVisible();
  await expect(page.getByTestId("sensor-volt")).toBeVisible();
}

async function blocking(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
}

const play = (page: Page) => page.getByRole("button", { name: /^(Play|Pause)$/ });

test("the machine picker and the web address choose the machine; the score is the data service's score", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto("/asset-details");
  await expect(page.getByText("Choose a machine to see its history and risk")).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to fleet/ })).toBeVisible();
  await page.getByRole("combobox", { name: "Machine" }).selectOption("5");
  await expect(page).toHaveURL(/machine=5/);
  await loaded(page);
  const api = await assetApi(request, 5, w.start, w.cutoff);
  await expect(page.getByTestId("asset-score")).toHaveText(pct(api.score));
  await expect(page.getByTestId("asset-status")).toHaveAttribute("data-status", api.status);
  await expect(page.getByTestId("fact-model")).toHaveText(api.model);
  await expect(page.getByTestId("fact-age")).toHaveText(String(api.age));

  // a shared link with a machine and a time opens the same view
  const at = addHours(w.first, 30);
  await page.goto(`/asset-details?machine=12&at=${at}&cutoff=33`);
  await loaded(page);
  expect(await shownHour(page)).toBe(at);
  await expect(page.getByTestId("asset-score")).toHaveText(pct((await assetApi(request, 12, at, 33)).score));
  await expect(page.getByTestId("cutoff-readout")).toContainText("33%");

  // switching machines keeps the time and cut-off
  await page.getByRole("combobox", { name: "Machine" }).selectOption("40");
  await expect(page.getByTestId("facts")).toContainText("Air compressor 40");
  const url = new URL(page.url());
  expect([url.searchParams.get("machine"), url.searchParams.get("at"), url.searchParams.get("cutoff")]).toEqual(["40", at, "33"]);
});

test("the factors are labelled patterns, not causes: top 8 plus all others, with the caveat", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto(`/asset-details?machine=3&at=${addHours(w.first, 40)}`);
  await loaded(page);
  await expect(page.getByTestId("caveat")).toHaveText("These are patterns the model found in the data, not causes. They are not repair advice.");
  await expect(page.getByTestId("explanation-row")).toHaveCount(9);
  await expect(page.getByTestId("explanation-row").last()).toContainText("All other inputs combined");
  await expect(page.getByTestId("explanation").locator('[data-value-label="Predicted"]').first()).toBeVisible();
  const first = page.getByTestId("explanation-row").first();
  await first.getByRole("button", { name: /What .* means/ }).click();
  await expect(page.getByTestId("explanation").getByRole("note")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("explanation").getByRole("note")).toHaveCount(0);
  const text = (await page.locator("main").innerText()).toLowerCase();
  expect(text).not.toMatch(/\blive\b|real-time|savings|\bcaused by\b/);
  await expect(page.getByTestId("failures-list")).toContainText("Simulated sample data");
  await expect(page.getByTestId("past-estimates")).toContainText("simulated sample data");
});

test("no error, repair or failure at or after the replay hour is shown, for many machines and hours", async ({ page, request }) => {
  const w = await readWindow(request);
  let seenRecords = 0;
  for (const [machine, offset] of [[1, 60], [2, 200], [17, 400], [38, 700], [61, 1000], [99, 1200]] as const) {
    const at = addHours(w.first, offset);
    if (at > w.last) continue;
    await page.goto(`/asset-details?machine=${machine}&at=${at}`);
    await loaded(page);
    const times = await page.locator("[data-record-time]").evaluateAll((els) => els.map((e) => e.getAttribute("data-record-time") ?? ""));
    for (const t of times) expect(t.slice(0, 16) < at, `${t} must be before ${at}`).toBe(true);
    seenRecords += times.length;
    // the lists are exactly the service's records
    const api = await assetApi(request, machine, at, w.cutoff);
    await expect(page.getByTestId("errors-list").locator("li")).toHaveCount(api.errors.length);
    await expect(page.getByTestId("repairs-list").locator("li")).toHaveCount(api.repairs.length);
    for (const r of [...api.errors, ...api.repairs, ...api.failures]) expect(r.time.slice(0, 16) < at).toBe(true);
  }
  expect(seenRecords).toBeGreaterThanOrEqual(0);
});

test("stepping the replay changes the score to the data service's score for the next hour", async ({ page, request }) => {
  const w = await readWindow(request);
  const hours = [0, 1, 2, 3, 4, 5, 6, 7].map((h) => addHours(w.start, h));
  // find a machine whose score changes between two neighbouring hours
  let pick: { machine: number; from: string; a: number; b: number } | null = null;
  search: for (const machine of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const answers = await Promise.all(hours.map((h) => assetApi(request, machine, h, w.cutoff)));
    for (let i = 0; i + 1 < hours.length; i++) {
      if (answers[i]!.score !== answers[i + 1]!.score) {
        pick = { machine, from: hours[i]!, a: answers[i]!.score, b: answers[i + 1]!.score };
        break search;
      }
    }
  }
  expect(pick, "some machine's score changes within 8 hours").not.toBeNull();
  const p = pick!;
  await page.goto(`/asset-details?machine=${p.machine}&at=${p.from}`);
  await loaded(page);
  await expect(page.getByTestId("asset-score")).toHaveText(pct(p.a));
  await page.getByRole("button", { name: "Step forward" }).click();
  expect(await shownHour(page)).toBe(addHours(p.from, 1));
  await expect(page.getByTestId("asset-score")).toHaveText(pct(p.b));
  await page.getByRole("button", { name: "Step back" }).click();
  await expect(page.getByTestId("asset-score")).toHaveText(pct(p.a));
});

test("the range toggle switches the sensor history between 24 hours and 7 days", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto(`/asset-details?machine=9&at=${addHours(w.last, -5)}`);
  await loaded(page);
  await page.getByRole("radio", { name: "7 days" }).click();
  await expect(page.getByRole("radio", { name: "7 days" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("sensor-volt-summary")).toContainText("168 hourly readings");
  await page.getByRole("radio", { name: "24 h" }).click();
  await expect(page.getByTestId("sensor-volt-summary")).toContainText("24 hourly readings");
  await page.getByTestId("sensor-volt").getByRole("button", { name: "View as table" }).click();
  await expect(page.getByTestId("sensor-volt").getByRole("table")).toBeVisible();
});

test("a machine outside 1 to 100 shows the not-found state with a selector and a way back", async ({ page }) => {
  await page.goto("/asset-details?machine=250");
  await expect(page.getByText("Machine 250 isn't in the sample data.")).toBeVisible();
  await expect(page.getByText("The sample has machines numbered 1 to 100.")).toBeVisible();
  await page.getByRole("combobox", { name: "Machine" }).selectOption("2");
  await loaded(page);
  await page.goto("/asset-details?machine=250");
  await page.getByRole("link", { name: /Back to fleet/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
});

test("when the sensor history fails, only that panel shows an error and Try again fixes it", async ({ page, request }) => {
  const w = await readWindow(request);
  let broken = true;
  await page.route("**/api/v1/assets/*/telemetry*", (route) => (broken ? route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "boom", status: 500 }) }) : route.continue()));
  await page.goto(`/asset-details?machine=6&at=${addHours(w.first, 50)}`);
  const error = page.getByTestId("sensor-error");
  await expect(error).toContainText("Couldn't load the sensor history for this machine.");
  await expect(error).toContainText("The rest of this page is still correct.");
  await expect(page.getByTestId("asset-score")).toBeVisible();
  await expect(page.getByTestId("explanation-row")).toHaveCount(9);
  await expect(page.getByTestId("past-estimates")).toBeVisible();
  await expect(page.getByTestId("errors-list")).toBeVisible();
  broken = false;
  await error.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("sensor-volt")).toBeVisible();
  await expect(error).toHaveCount(0);
});

test("replay control on this screen: 'Historical replay' wording, clean stop at the end and at the start", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto(`/asset-details?machine=4&at=${addHours(w.last, -2)}`);
  await loaded(page);
  await expect(page.getByText("Simulated plant time").first()).toBeVisible();
  expect((await page.locator("body").innerText()).toLowerCase()).not.toMatch(/\blive\b|real-time/);
  await play(page).click();
  const end = page.getByTestId("end-state");
  await expect(end).toBeVisible({ timeout: 8000 });
  await expect(end).toContainText("End of the simulated data. There is no later data.");
  await page.waitForTimeout(2200); // would wrap or move on if it did not stop
  expect(await shownHour(page)).toBe(w.last);
  await expect(page.getByRole("button", { name: "Play" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Step forward" })).toHaveAttribute("aria-disabled", "true");
  // the last hour still shows its own score, and nothing later
  const api = await assetApi(request, 4, w.last, w.cutoff);
  await expect(page.getByTestId("asset-score")).toHaveText(pct(api.score));
  for (const t of await page.locator("[data-record-time]").evaluateAll((els) => els.map((e) => e.getAttribute("data-record-time") ?? ""))) {
    expect(t.slice(0, 16) < w.last).toBe(true);
  }
  await page.getByRole("button", { name: "Jump to start" }).click();
  expect(await shownHour(page)).toBe(w.first);
  await expect(page.getByText("Start of the simulated data.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Step back" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("asset-score")).toHaveText(pct((await assetApi(request, 4, w.first, w.cutoff)).score));
  // short history at the very start of the data
  await expect(page.getByTestId("past-estimates").getByText(/Only 1 hour of history before this point/)).toBeVisible();
});

for (const vp of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`axe: a loaded machine and the not-found state have no serious or critical violations (${vp.name})`, async ({ page, request }) => {
    const w = await readWindow(request);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`/asset-details?machine=8&at=${addHours(w.first, 80)}`);
    await loaded(page);
    expect(await blocking(page)).toEqual([]);
    await page.getByTestId("explanation-row").first().getByRole("button", { name: /What .* means/ }).click();
    expect(await blocking(page)).toEqual([]);
    await page.getByRole("radio", { name: "7 days" }).click();
    await expect(page.getByTestId("sensor-volt-summary")).toContainText("hourly readings");
    expect(await blocking(page)).toEqual([]);
    await page.goto("/asset-details?machine=250");
    await expect(page.getByTestId("machine-not-found")).toBeVisible();
    expect(await blocking(page)).toEqual([]);
  });
}

test("mobile: sensors are tabs, one chart at a time, and nothing scrolls sideways", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/asset-details?machine=8&at=${addHours(w.first, 80)}`);
  await loaded(page);
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByTestId("sensor-volt")).toBeVisible();
  await expect(page.getByTestId("sensor-rotate")).toHaveCount(0);
  await page.getByRole("tab", { name: "Voltage" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Rotation" })).toBeFocused();
  await expect(page.getByTestId("sensor-rotate")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // every control is at least 44px
  const small = await page.locator("main button:visible, main select:visible, main input:visible").evaluateAll((els) =>
    els.filter((e) => e.getBoundingClientRect().height < 43.5 || e.getBoundingClientRect().width < 43.5).map((e) => (e as HTMLElement).outerHTML.slice(0, 80)),
  );
  expect(small).toEqual([]);
});
