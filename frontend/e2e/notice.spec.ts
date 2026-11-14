import { expect, test, type Page } from "@playwright/test";

import { DISCLOSURE, PAGES, VIEWPORTS, openPage } from "./page-support";

// Story "Public release and limitations": every page carries the simulated-data and illustrative-costs notice.
// The wording is the one fixed in docs/ux-spec.md ("Persistent disclosure at the top of every page, never
// dismissible"): "Portfolio demo — simulated historical sample data; estimated economics are illustrative."

async function expectNotice(page: Page, viewportHeight: number) {
  const notice = page.getByRole("note").filter({ hasText: DISCLOSURE }).first();
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(new RegExp(`^ⓘ\\s*${DISCLOSURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  // on screen without scrolling, and nothing in it can dismiss it
  const box = await notice.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThan(viewportHeight);
  await expect(notice.locator("button, a, input")).toHaveCount(0);
  // exactly one, at the top of the page: it comes before the page heading
  await expect(page.getByRole("note").filter({ hasText: DISCLOSURE })).toHaveCount(1);
  const before = await page.evaluate(() => {
    const note = Array.from(document.querySelectorAll('[role="note"]')).find((n) => n.textContent?.includes("Portfolio demo"));
    const h1 = document.querySelector("h1");
    return !!note && !!h1 && !!(note.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(before).toBe(true);
}

for (const vp of VIEWPORTS) {
  for (const def of PAGES) {
    test(`notice: ${def.name} shows the simulated-data and illustrative-costs notice (${vp.name})`, async ({ page }) => {
      await openPage(page, def, vp.width, vp.height);
      await expectNotice(page, vp.height);
    });
  }

  test(`notice: it is still there after scrolling and in the error state (${vp.name})`, async ({ page }) => {
    await openPage(page, PAGES[0]!, vp.width, vp.height);
    await page.mouse.wheel(0, 2000);
    await expectNoticeInDocument(page);
    await page.route("**/api/v1/metadata*", (route) => route.abort());
    await page.goto("/model-performance");
    await expect(page.getByTestId("service-error")).toBeVisible();
    await expectNotice(page, vp.height);
  });
}

async function expectNoticeInDocument(page: Page) {
  await expect(page.getByRole("note").filter({ hasText: DISCLOSURE })).toHaveCount(1);
}
