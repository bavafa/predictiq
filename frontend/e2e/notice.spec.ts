import { expect, test, type Page } from "@playwright/test";

import { DISCLOSURE, PAGES, VIEWPORTS, openPage } from "./page-support";

// Story "Public release and limitations": every page carries the simulated-data and illustrative-costs notice.
// It is the footnote at the bottom of every page (the top banner was removed in the v2 redesign).

async function expectNotice(page: Page) {
  const footer = page.getByRole("contentinfo");
  await expect(footer).toHaveCount(1);
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  await expect(footer).toContainText(DISCLOSURE);
}

for (const vp of VIEWPORTS) {
  for (const def of PAGES) {
    test(`notice: ${def.name} shows the simulated-data and illustrative-costs notice (${vp.name})`, async ({ page }) => {
      await openPage(page, def, vp.width, vp.height);
      await expectNotice(page);
    });
  }

  test(`notice: it is still there after scrolling and in the error state (${vp.name})`, async ({ page }) => {
    await openPage(page, PAGES[0]!, vp.width, vp.height);
    await page.mouse.wheel(0, 2000);
    await expectNotice(page);
    await page.route("**/api/v1/metadata*", (route) => route.abort());
    await page.goto("/model-performance");
    await expect(page.getByTestId("service-error")).toBeVisible();
    await expectNotice(page);
  });
}
