import { expect, test } from "@playwright/test";

import { PAGES, fmt, openPage, tooSmall } from "./page-support";

// Mobile target size (390 x 844). Rule: docs/ux-spec.md, Accessibility, "Mobile": "every control (buttons, selects,
// text fields, sliders, checkboxes with their labels, links, expandable headings) at least 44px tall and wide", and
// docs/design/components.md, "Rules for every component": "Touch targets at least 44x44px on mobile".
// The spec states NO exception, so none is made here: inline links in running text are measured too.
// One measurement rule is taken from the spec's own wording: a checkbox is measured together with its label.
// A range input (slider) is measured by its own box: the spec asks for 44px tall sliders, and they run the full width.
test.use({ viewport: { width: 390, height: 844 } });

for (const def of PAGES) {
  test(`target size: every control on ${def.name} is at least 44x44 (mobile)`, async ({ page }) => {
    await openPage(page, def, 390, 844);
    // The "Skip to content" link is off screen until it has focus: bring it in, then measure it with the rest.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    expect(await tooSmall(page).then(fmt)).toBe("");
  });
}

test("target size: charts shown as tables keep every control at least 44x44 (mobile)", async ({ page }) => {
  for (const def of PAGES.filter((p) => ["Fleet Overview", "Asset Details", "Model Performance"].includes(p.name))) {
    await openPage(page, def, 390, 844);
    const n = await page.getByRole("button", { name: "View as table" }).count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await page.getByRole("button", { name: "View as table" }).first().click();
    expect(await tooSmall(page).then(fmt), def.name).toBe("");
  }
});

test("target size: the open Menu panel is at least 44x44 on every control", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
  expect(await tooSmall(page).then(fmt)).toBe("");
  // and it has controls to measure: the close button and the five page links
  expect(await page.getByRole("dialog", { name: "Main menu" }).locator("a[href], button").count()).toBeGreaterThanOrEqual(6);
});

test("target size: Asset Details states without data (no machine, machine not found) keep 44x44", async ({ page }) => {
  await page.goto("/asset-details");
  await expect(page.getByTestId("no-machine")).toBeVisible();
  expect(await tooSmall(page).then(fmt)).toBe("");
  await page.goto("/asset-details?machine=999");
  await expect(page.getByTestId("machine-not-found")).toBeVisible();
  expect(await tooSmall(page).then(fmt)).toBe("");
});

test("target size: ⓘ definition buttons are 44x44 when open too", async ({ page }) => {
  await openPage(page, PAGES[1]!, 390, 844);
  const info = page.getByRole("button", { name: /^What ".*" means$/ });
  expect(await info.count()).toBeGreaterThan(0);
  for (const b of await info.all()) await b.click();
  await expect(page.locator('[role="note"][id]').first()).toBeVisible();
  expect(await tooSmall(page).then(fmt)).toBe("");
});

test("target size: Maintenance Planner with the reduction assumption on and a failed field keeps 44x44", async ({ page }) => {
  await openPage(page, PAGES[2]!, 390, 844);
  await page.getByTestId("reduction-toggle").check();
  await page.getByTestId("failure-cost").fill("-5");
  await expect(page.getByTestId("invalid-note")).toBeVisible();
  expect(await tooSmall(page).then(fmt)).toBe("");
});
