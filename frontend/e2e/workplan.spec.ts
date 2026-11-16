import { expect, test } from "@playwright/test";

// Redesign stage 4: a visitor takes the top alert from Overview to a scheduled, then done, job (decision 82).
test("alert to work plan: add, schedule, mark done, reset", async ({ page }) => {
  // cut-off 0 makes every machine an alert, so the synthetic bundle always has one to add
  await page.goto("/?cutoff=0");
  await expect(page.getByTestId("home-alerts")).toBeVisible();
  await page.getByRole("button", { name: /Add to work plan/ }).first().click();
  await expect(page.getByRole("link", { name: /In work plan/ }).first()).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Work plan" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Work plan");
  const added = page.getByTestId("job-row").filter({ has: page.getByText("Added", { exact: true }) });
  await expect(added).toHaveCount(1); // the machine added on Home is carried in as an Added job
  const row = added.first();
  const key = await row.getAttribute("data-job-key");
  const same = () => page.locator(`[data-job-key="${key}"]`);

  await row.getByRole("button", { name: /Schedule/ }).click();
  await expect(same().getByTestId("job-status")).toHaveText("Scheduled");
  await expect(page.getByTestId("slots-used")).toContainText("Slots used: 1 of");

  // The state survives a reload (browser storage), then Mark done frees the slot.
  await page.reload();
  await expect(same().getByTestId("job-status")).toHaveText("Scheduled");
  await same().getByRole("button", { name: /Mark done/ }).click();
  await expect(same().getByTestId("job-status")).toHaveText("Done");
  await expect(page.getByTestId("slots-used")).toContainText("Slots used: 0 of");

  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByTestId("job-status").filter({ hasText: /Added|Done|Scheduled/ })).toHaveCount(0);
  await expect(page.getByTestId("job-row").first().getByTestId("job-status")).toHaveText("Recommended");
});

test("Plan settings change the crew slots shown and survive a reload", async ({ page }) => {
  await page.goto("/maintenance-planner?cutoff=0");
  await page.getByRole("button", { name: "Plan settings" }).click();
  const crew = page.getByLabel("Crew slots this shift");
  await crew.fill("2");
  await expect(page.getByTestId("slots-used")).toContainText("of 2");
  await page.reload();
  await expect(page.getByTestId("slots-used")).toContainText("of 2");
});

test("Alerts ranks by cost at risk with the Illustrative tag, and says it is not the order of chance when it differs", async ({ page }) => {
  await page.goto("/alerts?cutoff=0");
  await expect(page.getByTestId("alerts")).toBeVisible();
  const cards = page.getByTestId("alert-card");
  await expect(cards.first()).toContainText("Priority 1");
  await expect(cards.first().getByTestId("cost-at-risk")).toContainText("Illustrative");
  await expect(page.getByTestId("rank-note")).toContainText("Cost at risk is the chance of failure times an example cost");
  await expect(page.getByTestId("since-last-hour")).toContainText("Since the last hour");
});
