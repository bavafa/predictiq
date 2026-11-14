import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { PAGES, VIEWPORTS, openPage } from "./page-support";

// axe-core on all five pages, desktop and mobile, with ZERO violations of any impact (not only serious/critical).
// Tags: WCAG 2.0 A and AA, 2.1 A and AA, 2.2 AA. Main states, loading, waking up, error, empty, charts as tables and
// open dialogs / definitions. axe finds roughly a third of WCAG problems; it does not replace a human review.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`);
}

for (const vp of VIEWPORTS) {
  test.describe(`axe, ${vp.name}`, () => {
    for (const def of PAGES) {
      test(`${def.name}: main state`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        expect(await violations(page)).toEqual([]);
      });
    }

    for (const def of [PAGES[0]!, PAGES[1]!, PAGES[3]!]) {
      test(`${def.name}: every chart shown as a table`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const buttons = page.getByRole("button", { name: "View as table" });
        const n = await buttons.count();
        expect(n).toBeGreaterThan(0);
        for (let i = 0; i < n; i++) await page.getByRole("button", { name: "View as table" }).first().click();
        await expect(page.getByRole("button", { name: "View as chart" })).toHaveCount(n);
        expect(await violations(page)).toEqual([]);
      });
    }

    for (const def of [PAGES[1]!, PAGES[3]!]) {
      test(`${def.name}: every ⓘ definition open`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const buttons = page.getByRole("button", { name: /^What ".*" means$/ });
        const n = await buttons.count();
        expect(n).toBeGreaterThan(0);
        for (let i = 0; i < n; i++) await buttons.nth(i).click();
        await expect(page.locator('button[aria-expanded="true"]')).toHaveCount(n);
        expect(await violations(page)).toEqual([]);
      });
    }

    test("Fleet Overview: filtered to nothing (empty state)", async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/?status=alert&cutoff=100");
      await expect(page.getByTestId("empty-result")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("Asset Details: no machine chosen, and machine not found", async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/asset-details");
      await expect(page.getByTestId("no-machine")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.goto("/asset-details?machine=999");
      await expect(page.getByTestId("machine-not-found")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("Maintenance Planner: nothing at or above the cut-off (empty), and an invalid input", async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/maintenance-planner?cutoff=100");
      await expect(page.getByTestId("planner-empty")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await openPage(page, PAGES[2]!, vp.width, vp.height);
      await page.getByTestId("failure-cost").fill("-5");
      await expect(page.getByTestId("invalid-note")).toBeVisible();
      await page.getByTestId("reduction-toggle").check();
      expect(await violations(page)).toEqual([]);
    });

    for (const def of PAGES.filter((p) => p.name !== "About & Data")) {
      test(`${def.name}: loading state and "waking up" state`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => (release = resolve));
        await page.route("**/api/v1/metadata*", async (route) => {
          await gate;
          await route.continue();
        });
        await page.goto(def.path);
        await expect(page.getByTestId("skeleton").first()).toBeVisible();
        expect(await violations(page)).toEqual([]);
        await expect(page.getByTestId("waking-up")).toBeVisible({ timeout: 8000 }); // after 3 s without an answer
        expect(await violations(page)).toEqual([]);
        release();
        await def.ready(page);
      });

      test(`${def.name}: the data service cannot be reached (error state)`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.route("**/api/v1/metadata*", (route) => route.abort());
        await page.goto(def.path);
        await expect(page.getByTestId("service-error")).toBeVisible();
        await expect(page.getByTestId("service-error")).toContainText("Try again");
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

test("axe: the open mobile Menu panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("axe: a panel that failed to load (Fleet Overview, desktop)", async ({ page }) => {
  await page.route("**/api/v1/fleet?**", (route) =>
    route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "boom", status: 500 }) }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fleet Overview");
  await expect(page.getByTestId("service-error").first()).toContainText("Couldn't load the fleet");
  expect(await violations(page)).toEqual([]);
});
