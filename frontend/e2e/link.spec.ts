import { expect, test } from "@playwright/test";

// A link click moves to another page without a reload. The page must show the machine that was linked, not the
// "Choose a machine" state (the address was changed by the router after the page rendered; older code did not notice).

test("Fleet Overview: a machine link opens that machine on Asset Details", async ({ page }) => {
  await page.goto("/?cutoff=5");
  const link = page.locator('main table a[href*="asset-details"]').first();
  const id = new URL((await link.getAttribute("href"))!, "http://x").searchParams.get("machine");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`machine=${id}`));
  await expect(page.getByTestId("facts")).toBeVisible();
  await expect(page.getByTestId("no-machine")).toHaveCount(0);
});

test("Maintenance Planner: a machine link opens that machine on Asset Details", async ({ page }) => {
  await page.goto("/maintenance-planner?cutoff=5");
  await expect(page.getByTestId("planner-ready")).toBeVisible();
  const link = page.getByTestId("plan-row").first().getByRole("link").first();
  const id = new URL((await link.getAttribute("href"))!, "http://x").searchParams.get("machine");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`machine=${id}`));
  await expect(page.getByTestId("facts")).toBeVisible();
});

test("Back returns to the previous page with its own address", async ({ page }) => {
  await page.goto("/?cutoff=5");
  await page.locator('main table a[href*="asset-details"]').first().click();
  await expect(page.getByTestId("facts")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/cutoff=5/);
  await expect(page.locator("main table").first()).toBeVisible();
});
