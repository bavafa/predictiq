// The machine page must not scroll sideways on narrow phones. CI fonts are a little wider than a Mac's, so this checks
// 320 and 360 px as well as 390 px (a long non-wrapping button once overflowed only in CI).
import { expect, test } from "@playwright/test";
import { addHours, readWindow } from "./support";

for (const width of [320, 360, 390]) {
  test(`no sideways scroll on the machine page at ${width}px`, async ({ page, request }) => {
    const w = await readWindow(request);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/asset-details?machine=8&at=${addHours(w.first, 80)}`);
    await expect(page.getByTestId("asset-score")).toBeVisible();
    await expect(page.getByTestId("explanation-table")).toBeVisible();
    const over = await page.evaluate(() => {
      const de = document.documentElement;
      const wide = [...document.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1).map((e) => e.tagName + "." + String(e.className).slice(0, 60));
      return { over: de.scrollWidth - de.clientWidth, wide: wide.slice(0, 5) };
    });
    expect(over.over, JSON.stringify(over.wide)).toBeLessThanOrEqual(0);
  });
}
