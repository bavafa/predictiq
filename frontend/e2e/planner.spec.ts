import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Maintenance Planner against the real stack (synthetic bundle in CI). The tests read what the screen shows
// and check the rule each input is documented to follow (ux-spec, "What each Planner input changes").

async function open(page: Page, query = "?cutoff=5") {
  await page.goto(`/maintenance-planner${query}`);
  await settled(page);
}

async function settled(page: Page) {
  await expect(page.getByTestId("planner-ready")).toBeVisible();
  await expect(page.getByTestId("planner-ready")).not.toHaveAttribute("aria-busy", "true");
}

const machines = (page: Page) => page.getByTestId("plan-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-machine") ?? ""));
const listings = (page: Page) => page.getByTestId("plan-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-listing") ?? ""));
const models = (page: Page) => page.locator('[data-testid="plan-row"] td:nth-child(3)').allTextContents();

async function blocking(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
}

test("a cost per machine model reorders the list and shows Moved marks", async ({ page }) => {
  await open(page);
  const before = await machines(page);
  const ms = await models(page);
  expect(new Set(ms).size).toBeGreaterThan(1); // the test bundle mixes machine models
  const lowest = ms[ms.length - 1]!; // the model of the last listed machine
  // decision 55: the per-model costs start filled in, so the Moved column is already there; the visitor RAISES one
  await expect(page.getByTestId(`cost-${lowest}`)).not.toHaveValue("");
  await page.getByTestId(`cost-${lowest}`).fill("10000000");
  await expect(page.getByTestId("order-note")).toBeVisible();
  await settled(page);
  const after = await machines(page);
  expect(after).not.toEqual(before);
  expect((await models(page))[0]).toBe(lowest); // that model's machines moved to the top
  const moved = (await page.getByTestId("moved").allTextContents()).join(" ");
  expect(moved).toMatch(/▲ up \d+/);
  expect(moved).toMatch(/▼ down \d+/);
});

test("Apply to all models writes the shared cost into every model's field: equal costs, no Moved, order by chance alone", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("cost-model1")).toBeVisible(); // the per-model fields are visible by default
  const ms = await models(page);
  expect(new Set(ms).size).toBeGreaterThan(1);
  await page.getByTestId("failure-cost").fill("20000");
  await expect(page.getByTestId("cost-model2")).toHaveValue("8000"); // typing alone changes nothing
  await page.getByTestId("failure-cost-apply").click();
  for (const m of ["model1", "model2", "model3", "model4"]) await expect(page.getByTestId(`cost-${m}`)).toHaveValue("20000");
  await expect(page.getByTestId("moved")).toHaveCount(0);
  await settled(page);
  // the order is by predicted chance alone: percentages never increase going down the list
  const chances = (await page.getByTestId("plan-row").locator("td:nth-child(4) div:first-child").allTextContents()).map((t) => parseFloat(t));
  expect([...chances].sort((a, b) => b - a)).toEqual(chances);
  // planned cost: spend changes, the order does not
  const before = await machines(page);
  await page.getByTestId("planned-cost").fill("1000");
  await page.getByTestId("planned-cost-apply").click();
  await expect(page.getByTestId("planned-model3")).toHaveValue("1000");
  await settled(page);
  expect(await machines(page)).toEqual(before);
  // an out-of-range shared value is refused and the last result stays
  await page.getByTestId("failure-cost").fill("-5");
  await expect(page.getByTestId("invalid-note")).toBeVisible();
  await page.getByTestId("failure-cost-apply").click({ force: true });
  await expect(page.getByTestId("cost-model1")).toHaveValue("20000");
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.getByTestId("cost-model3")).toHaveValue("12000");
  await expect(page.getByTestId("planned-model3")).toHaveValue("3000");
});

test("crew slots change the shortlist only, not the order", async ({ page }) => {
  await open(page);
  const before = await machines(page);
  await page.getByLabel(/Crew slots available/).fill("2");
  await expect(page.getByTestId("summary-slots")).toContainText("2 of 2 crew slots used");
  await settled(page);
  expect(await machines(page)).toEqual(before);
  expect((await listings(page)).filter((l) => l === "shortlisted")).toHaveLength(2);
  await page.getByRole("button", { name: "More crew slots" }).click();
  await expect(page.getByTestId("summary-slots")).toContainText("3 of 3 crew slots used");
});

test("the alert cut-off changes which machines are listed, matching the Alert count", async ({ page, request }) => {
  const meta = await (await request.get("/api/v1/metadata")).json();
  const counts: number[] = [];
  for (const cutoff of [1, 100]) {
    await page.goto(`/maintenance-planner?cutoff=${cutoff}`);
    await expect(page.getByTestId("planner-ready")).toBeVisible();
    await expect(page.getByTestId("planner-ready")).not.toHaveAttribute("aria-busy", "true");
    const rows = (await machines(page)).length;
    const api = await (await request.get(`/api/v1/fleet?at=${meta.replay_start.slice(0, 16)}&cutoff=${cutoff}&mv=${meta.model_version}`)).json();
    expect(rows).toBe(api.cards.machines_in_alert);
    counts.push(rows);
  }
  expect(counts[0]).toBeGreaterThan(counts[1]!);
});

test("also listing machines below the cut-off adds marked rows that are never shortlisted", async ({ page }) => {
  await open(page, "?cutoff=60");
  const base = (await machines(page)).length;
  await page.getByLabel(/Also list machines below the cut-off/).check();
  await expect.poll(async () => (await machines(page)).length).toBeGreaterThan(base);
  await settled(page);
  const l = await listings(page);
  expect(l).toContain("below_cutoff");
  expect(l.filter((x) => x === "shortlisted").length).toBeLessThanOrEqual(5);
});

test("the risk-reduction toggle shows and hides the net benefit, labelled as an estimate", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("net-benefit-summary")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: /net benefit/i })).toHaveCount(0);
  await page.getByTestId("reduction-toggle").check();
  await expect(page.getByTestId("net-benefit-summary")).toContainText("Expected net benefit (estimate)");
  await expect(page.getByRole("columnheader", { name: /Expected net benefit \(estimate\)/ })).toBeVisible();
  await page.getByTestId("reduction-toggle").uncheck();
  await expect(page.getByTestId("net-benefit-summary")).toHaveCount(0);
});

test("an invalid input is refused with a message and the list keeps the last valid result", async ({ page }) => {
  await open(page);
  const before = await machines(page);
  const field = page.getByTestId("failure-cost");
  await field.fill("-500");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").first()).toContainText("Enter a whole number from 0 to 10,000,000.");
  await expect(page.getByTestId("invalid-note")).toHaveText("Showing results for your last valid inputs.");
  expect(await machines(page)).toEqual(before);
  await field.fill("12000");
  await expect(page.getByTestId("invalid-note")).toHaveCount(0);
});

test("the page labels money as illustrative and never claims savings or live data", async ({ page }) => {
  await open(page);
  await page.getByTestId("reduction-toggle").check();
  await page.getByRole("button", { name: "How this is calculated" }).click();
  await expect(page.getByTestId("formula")).toBeVisible();
  const text = (await page.locator("main").innerText()).replace("It is not a saving.", "").toLowerCase();
  expect(text).not.toMatch(/saving|saved|return on investment|avoided cost|real-time|\blive\b/);
  await expect(page.getByTestId("planner-banner")).toContainText("illustrative");
});

test("a machine link opens Asset Details at the same time and cut-off", async ({ page }) => {
  await open(page, "?cutoff=5");
  const id = (await machines(page))[0]!;
  await page.getByTestId("plan-row").first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/asset-details\\?.*machine=${id}`));
  await expect(page).toHaveURL(/cutoff=5/);
});

test("the error state keeps the assumptions and Try again recovers", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/plan**", (route) =>
    fail ? route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "boom", status: 500 }) }) : route.fallback(),
  );
  await page.goto("/maintenance-planner?cutoff=5");
  await expect(page.getByTestId("service-error")).toContainText("Couldn't load the predicted chances for");
  await expect(page.getByTestId("plan-table")).toHaveCount(0);
  await expect(page.getByTestId("planned-cost")).toHaveValue("2500");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await settled(page);
});

for (const vp of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`axe: the Planner has no serious or critical violations (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);
    expect(await blocking(page)).toEqual([]);
      await page.getByTestId("reduction-toggle").check();
    await page.getByTestId("failure-cost").fill("-1");
    await page.getByRole("button", { name: "How this is calculated" }).click();
    await settled(page);
    expect(await blocking(page)).toEqual([]);
  });
}

test("mobile: no sideways scrolling and the buttons and disclosure are at least 44px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByTestId("plan-cards")).toBeVisible();
  await expect(page.getByTestId("plan-table")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  for (const name of ["Fewer crew slots", "More crew slots", "Reset to defaults", "How this is calculated"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  for (const box of await page.getByRole("button", { name: "Apply to all models" }).all()) {
    expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  for (const id of ["failure-cost", "planned-cost", "crew-slots", "cost-model1", "planned-model1"]) {
    expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
