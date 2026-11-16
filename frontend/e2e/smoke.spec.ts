import { expect, test } from "@playwright/test";

test("shell, banner, and every route render honestly", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toContainText(
    "PredictIQ is a portfolio demo. All data is simulated and costs are illustrative.",
  );
  await expect(page.getByTestId("plant-status")).toContainText("Plant time:");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Know which machines will fail");
  await expect(page.getByTestId("home-hero")).toBeVisible();
  await page.goto("/alerts");
  await expect(page.getByTestId("alerts")).toBeVisible();
  await page.goto("/assets");
  await expect(page.getByRole("heading", { level: 2, name: "Machines ranked by predicted 24-hour risk" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  for (const name of ["Alerts", "Assets", "Work plan", "Alert accuracy", "About this demo"]) {
    await nav.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  }
  await expect(page.getByRole("link", { name: /Full data record/ })).toHaveAttribute("href", /DATA_PROVENANCE\.md$/);
});
