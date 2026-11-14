import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
