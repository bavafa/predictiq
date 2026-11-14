import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { expectTableMatches, readSaved } from "./model-support";
import { readWindow } from "./support";

async function loaded(page: Page) {
  await expect(page.getByTestId("comparison-table")).toBeVisible();
  await expect(page.getByTestId("mp-charts")).toBeVisible();
}

async function blocking(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, nodes: v.nodes.map((x) => x.target) }));
}

test("the table equals the saved evaluation at the default cut-off, and header facts are shown (desktop)", async ({ page, request }) => {
  const saved = await readSaved(request);
  const w = await readWindow(request);
  await page.goto("/model-performance");
  await loaded(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Model Performance");
  await expect(page.getByRole("heading", { level: 2, name: "Main model vs simple baseline" })).toBeVisible();
  await expectTableMatches(page, saved, w.cutoff);
  await expect(page.getByTestId("fact-version")).toHaveText(saved.metrics.model_version);
  await expect(page.getByTestId("fact-target")).toContainText("24 hours");
  await expect(page.getByTestId("period-line")).toContainText("Test period:");
  await expect(page.getByTestId("replay-time")).toHaveAttribute("datetime", w.start); // read-only replay time
  await expect(page.getByRole("columnheader", { name: "Better is" })).toBeVisible();
  await expect(page.getByTestId("better-rule")).toBeHidden();
  await expect(page.getByTestId("accuracy")).toContainText("Why accuracy misleads when failures are rare");
  await expect(page.getByTestId("limitations")).toBeVisible();
  expect(await blocking(page)).toEqual([]);
});

test("changing the cut-off with the keyboard updates every cut-off row for both models", async ({ page, request }) => {
  const saved = await readSaved(request);
  const w = await readWindow(request);
  await page.goto("/model-performance");
  await loaded(page);
  await page.getByRole("slider", { name: "Alert cut-off" }).focus();
  await page.keyboard.press("PageDown");
  const other = Math.max(0, w.cutoff - 10);
  await expect(page).toHaveURL(new RegExp(`cutoff=${other}`));
  await expectTableMatches(page, saved, other);
  await expect(page.getByTestId("chart-precision-recall-summary")).toContainText(`At the ${other}% cut-off`);
  await page.getByRole("button", { name: "Reset to default" }).click();
  await expectTableMatches(page, saved, w.cutoff);
});

test("mobile: the table keeps three columns, the rule moves under it, nothing scrolls sideways, axe passes", async ({ page, request }) => {
  const saved = await readSaved(request);
  const w = await readWindow(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/model-performance");
  await loaded(page);
  await expectTableMatches(page, saved, w.cutoff);
  await expect(page.getByRole("columnheader", { name: "Better is" })).toBeHidden();
  const visible = await page.getByTestId("comparison-table").locator("thead th").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length);
  expect(visible).toBe(3);
  await expect(page.getByTestId("better-rule")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await blocking(page)).toEqual([]);
  // Every control on this screen is at least 44px tall and wide.
  const small = await page.locator("main button, main input[type=range], main a").evaluateAll((els) =>
    els
      .map((e) => ({ el: e as HTMLElement, r: (e as HTMLElement).getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .filter(({ el, r }) => (r.height < 43.5 || r.width < 43.5) && el.tagName !== "A")
      .map(({ el }) => el.textContent?.trim() || el.getAttribute("aria-label") || el.tagName),
  );
  expect(small).toEqual([]);
});

test("keyboard: Tab reaches the cut-off slider and the ⓘ buttons; Enter opens a definition and Escape closes it", async ({ page }) => {
  await page.goto("/model-performance");
  await loaded(page);
  const seen = { slider: false, info: false };
  for (let i = 0; i < 60 && !(seen.slider && seen.info); i += 1) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return `${el?.getAttribute("type") ?? ""}|${el?.getAttribute("aria-label") ?? ""}`;
    });
    if (label.startsWith("range|") || label.includes("Alert cut-off")) seen.slider = true;
    if (/What ".*" means/.test(label)) seen.info = true;
  }
  expect(seen).toEqual({ slider: true, info: true });
  const info = page.getByRole("button", { name: 'What "Precision" means' });
  await info.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main").getByRole("note")).toContainText("the share");
  await page.keyboard.press("Escape");
  await expect(page.locator("main").getByRole("note")).toHaveCount(0);
  await expect(info).toBeFocused();
});

test("the charts have text summaries and a table view, and the calibration chart says circles and squares", async ({ page }) => {
  await page.goto("/model-performance");
  await loaded(page);
  for (const id of ["chart-precision-recall", "chart-alerts-per-day", "chart-pr-curves", "chart-calibration"]) {
    const fig = page.getByTestId(id);
    await expect(fig.getByTestId(`${id}-summary`)).not.toBeEmpty();
    await fig.getByRole("button", { name: "View as table" }).click();
    await expect(fig.getByRole("table")).toBeVisible();
  }
  await expect(page.getByTestId("chart-calibration")).toContainText("Circles: main model. Squares: simple baseline.");
});

test("loading state: header, cut-off control and test period show; table and charts are grey blocks", async ({ page }) => {
  await page.route("**/api/v1/model/**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.fallback();
  });
  await page.goto("/model-performance");
  await expect(page.getByTestId("mp-loading")).toBeVisible();
  await expect(page.getByTestId("mp-facts")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Alert cut-off" })).toBeVisible();
  await expect(page.getByTestId("period-line")).toContainText("Test period:");
  await expect(page.getByTestId("limitations")).toBeVisible();
  await expect(page.getByTestId("comparison-table")).toHaveCount(0);
  await loaded(page);
});

test("error state: a plain message and Try again, no table or numbers; Try again recovers", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/model/**", (route) =>
    fail ? route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "boom", status: 500 }) }) : route.fallback(),
  );
  await page.goto("/model-performance");
  await expect(page.getByTestId("service-error")).toContainText("Couldn't load the saved evaluation results.");
  await expect(page.getByTestId("comparison-table")).toHaveCount(0);
  await expect(page.getByTestId("mp-charts")).toHaveCount(0);
  await expect(page.getByTestId("limitations")).toBeVisible();
  expect(await blocking(page)).toEqual([]);
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await loaded(page);
});

test("results not available: says so and shows no numbers", async ({ page }) => {
  await page.route("**/api/v1/model/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schema: 1, models: {} }) }));
  await page.goto("/model-performance");
  await expect(page.getByTestId("results-not-available")).toContainText("Results appear after the model is evaluated");
  await expect(page.getByTestId("comparison-table")).toHaveCount(0);
  await expect(page.getByTestId("mp-charts")).toHaveCount(0);
  expect(await blocking(page)).toEqual([]);
});
