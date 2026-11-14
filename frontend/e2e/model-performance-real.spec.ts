import { expect, test } from "@playwright/test";

import { expectTableMatches, readSaved } from "./model-support";
import { readWindow } from "./support";

// Opt-in: the real bundle only (`npm run e2e:real`). The page's numbers equal /model/metrics and
// /model/threshold-analysis for the default cut-off and for one other cut-off.
test.skip(process.env.E2E_MODE !== "real", "needs the real bundle: npm run e2e:real");

test("real bundle: the page equals /model/metrics and /model/threshold-analysis at the default and at another cut-off", async ({ page, request }) => {
  const meta = await (await request.get("/api/v1/metadata")).json();
  expect(meta.synthetic ?? false).toBe(false);
  const saved = await readSaved(request);
  const w = await readWindow(request);
  expect(saved.metrics.model_version).toBe(meta.model_version);

  await page.goto("/model-performance");
  await expect(page.getByTestId("comparison-table")).toBeVisible();
  await expectTableMatches(page, saved, w.cutoff);

  const other = w.cutoff === 30 ? 60 : 30;
  await page.goto(`/model-performance?cutoff=${other}`);
  await expect(page.getByTestId("comparison-table")).toBeVisible();
  await expectTableMatches(page, saved, other);

  // The page also shows the accuracy figures from the saved counts.
  const main = saved.rows.main.find((r) => r.cutoff === other)!;
  const total = main.tp + main.tn + main.fp + main.fn;
  const never = (Math.round(((total - (main.tp + main.fn)) / total) * 10000) / 100).toFixed(2);
  await expect(page.getByTestId("accuracy-table")).toContainText(`${never}%`);
});
