import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { fmt, tooSmall } from "./page-support";

// Run with NO bundle in the data service (E2E_MODE=none): every data question answers 503.
const SCREENS = ["/", "/asset-details", "/maintenance-planner", "/model-performance"];

test("the data service really has no model data", async ({ request }) => {
  const meta = await (await request.get("/api/v1/metadata")).json();
  expect(meta.model_available).toBe(false);
  const res = await request.get("/api/v1/fleet?mv=x&at=2015-11-01T00:00");
  expect(res.status()).toBe(503);
  expect(res.headers()["content-type"]).toContain("application/problem+json");
});

for (const route of SCREENS) {
  test(`${route} says the model data isn't installed, with no numbers and no replay controls`, async ({ page }) => {
    await page.goto(route);
    const state = page.getByTestId("no-model-data");
    await expect(state).toBeVisible();
    await expect(state).toContainText("The model data isn't installed in this preview");
    await expect(state).not.toContainText(/[0-9]/);
    await expect(page.getByText("Not built yet")).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Play|Pause|Start)$/ })).toHaveCount(0);
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.getByTestId("replay-time")).toHaveText("—");
    await expect(page.getByTestId("model-version")).toHaveText("none yet");
    await expect(page.getByText("Historical replay").first()).toBeVisible();
    const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations;
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
}

for (const vp of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  for (const route of [...SCREENS, "/real-plant", "/about-data"]) {
    test(`${route} with no model data: notice present and axe finds nothing at all (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("note").filter({ hasText: "Portfolio demo — simulated historical sample data; estimated economics are illustrative." })).toBeVisible();
      const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
      const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`)).toEqual([]);
    });
  }
}

test("mobile: every control in the no-model state is at least 44x44 (docs/ux-spec.md, Accessibility, Mobile)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [...SCREENS, "/real-plant", "/about-data"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab"); // brings the Skip to content link into view so it is measured too
    expect(await tooSmall(page).then(fmt), route).toBe("");
  }
});

test("the link to About & Data from the state works", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("no-model-data").getByRole("link", { name: /About & Data/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About & Data");
});

test("mobile: the state fits without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("no-model-data")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
