import { expect, test } from "@playwright/test";

test("shell, banner, and every route render honestly", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("note")).toContainText(
    "Portfolio demo — simulated historical sample data; estimated economics are illustrative.",
  );
  await expect(page.getByText("Simulated plant time").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(page.getByTestId("overview-headline")).toBeVisible();
  await page.goto("/assets");
  await expect(page.getByRole("heading", { level: 2, name: "Machines ranked by predicted 24-hour risk" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  for (const name of ["Assets", "Work plan", "Alert accuracy", "About this demo"]) {
    await nav.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  }
  await expect(page.getByRole("link", { name: /Full data record/ })).toHaveAttribute("href", /DATA_PROVENANCE\.md$/);
});
