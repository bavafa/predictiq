import { expect, test } from "@playwright/test";

import { openDetails } from "./page-support";
import { addHours, readWindow } from "./support";

// Opt-in: runs only against the real bundle (`npm run e2e:real`). The score on the screen must equal the
// data service's own score for the same machine, hour and cut-off.
test.skip(process.env.E2E_MODE !== "real", "needs the real bundle: npm run e2e:real");

test("Asset Details shows the API score and status (real bundle)", async ({ page, request }) => {
  const w = await readWindow(request);
  const meta = await (await request.get("/api/v1/metadata")).json();
  expect(meta.synthetic ?? false).toBe(false);
  const cases: [number, string, number][] = [
    [1, w.start, w.cutoff],
    [37, addHours(w.first, 500), 20],
    [100, w.last, w.cutoff],
  ];
  for (const [machine, at, cutoff] of cases) {
    const api = await (await request.get(`/api/v1/assets/${machine}?at=${at}&cutoff=${cutoff}&mv=${meta.model_version}`)).json();
    await page.goto(`/asset-details?machine=${machine}&at=${at}&cutoff=${cutoff}`);
    await expect(page.getByTestId("asset-score")).toHaveText(`${(api.score * 100).toFixed(1)}%`);
    await expect(page.getByTestId("asset-status")).toHaveAttribute("data-status", api.status);
    await expect(page.getByTestId("fact-model")).toHaveText(api.model);
    await expect(page.getByTestId("history-list").locator("li")).toHaveCount(api.errors.length + api.repairs.length + api.failures.length);
    await openDetails(page);
    const ex = await (await request.get(`/api/v1/assets/${machine}/explanation?at=${at}&mv=${meta.model_version}`)).json();
    await expect(page.getByTestId("explanation-row")).toHaveCount(ex.contributions.length + 1);
  }
});
