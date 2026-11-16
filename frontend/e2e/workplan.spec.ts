import { expect, test } from "@playwright/test";

// Redesign stage 4: a visitor takes the top alert from Overview to a scheduled, then done, job (decision 82).
test("alert to work plan: add, schedule, mark done, reset", async ({ page }) => {
  // cut-off 0 makes every machine an alert, so the synthetic bundle always has one to add
  await page.goto("/?cutoff=0");
  await expect(page.getByTestId("overview-headline")).toBeVisible();
  await page.getByRole("button", { name: /Add to work plan/ }).first().click();
  await expect(page.getByRole("link", { name: /In work plan/ }).first()).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Work plan" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Work plan");
  const row = page.getByTestId("job-row").first();
  await expect(row.getByTestId("job-status")).toHaveText("Added");

  await row.getByRole("button", { name: /Schedule/ }).click();
  await expect(row.getByTestId("job-status")).toHaveText("Scheduled");
  await expect(page.getByTestId("slots-used")).toContainText("Slots used: 1 of");

  // The state survives a reload (browser storage), then Mark done frees the slot.
  await page.reload();
  await expect(page.getByTestId("job-row").first().getByTestId("job-status")).toHaveText("Scheduled");
  await page.getByTestId("job-row").first().getByRole("button", { name: /Mark done/ }).click();
  await expect(page.getByTestId("job-row").first().getByTestId("job-status")).toHaveText("Done");
  await expect(page.getByTestId("slots-used")).toContainText("Slots used: 0 of");

  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByTestId("no-jobs")).toBeVisible();
});
