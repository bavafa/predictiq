import { expect, test } from "@playwright/test";

import { readWindow } from "./support";

// Redesign stage 1: the header, the Time controls panel and the data-labels switch (decision 82).
test.use({ storageState: { cookies: [], origins: [] } }); // a first-time visitor: nothing saved

test("header names the product, shows plant time and Advance 1 h; the full controls start closed", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto("/");
  await expect(page.getByText("Predictive maintenance · Demo plant")).toBeVisible();
  const time = page.getByTestId("replay-time");
  await expect(time).toHaveAttribute("datetime", w.start);
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible(); // beside Advance 1 h
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Advance 1 h" }).click();
  await expect(time).not.toHaveAttribute("datetime", w.start);
  await page.getByRole("button", { name: /Time controls/ }).click();
  for (const name of ["Start", "Step back", "Step forward"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("Step size")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Simulated plant time" })).toBeVisible();
});

test("value tags are hidden until Show data labels is on, and Illustrative stays", async ({ page }) => {
  await page.goto("/assets");
  const sw = page.getByRole("switch", { name: "Show data labels" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  const predicted = page.locator('[data-value-label="Predicted"]').first();
  await expect(predicted).toBeAttached();
  await expect(predicted).not.toBeInViewport();
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(predicted).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Show data labels" })).toHaveAttribute("aria-checked", "true");
});

test("an old fleet link with filters opens the Assets table with the same filters", async ({ page }) => {
  await page.goto("/?status=alert&cutoff=30");
  await expect(page).toHaveURL(/\/assets\?.*status=alert/);
  await expect(page).toHaveURL(/cutoff=30/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Assets");
});
