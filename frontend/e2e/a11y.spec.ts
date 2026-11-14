import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = ["/", "/asset-details", "/maintenance-planner", "/model-performance", "/about-data"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

async function blockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) }));
}

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`axe: no serious or critical violations on ${route} (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });
  }
}

test("axe: the open mobile menu dialog has no serious or critical violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
});

test("focus: Escape closes the mobile menu and returns focus to the Menu button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeHidden();
  await expect(menu).toBeFocused();
});

test("focus: the chart table toggle keeps focus on its button, both ways", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("card-shown")).toBeVisible();
  const risk = page.getByTestId("risk-chart");
  await risk.getByRole("button", { name: "View as table" }).click();
  await expect(risk.getByRole("button", { name: "View as chart" })).toBeFocused();
  await risk.getByRole("button", { name: "View as chart" }).click();
  await expect(risk.getByRole("button", { name: "View as table" })).toBeFocused();
});
