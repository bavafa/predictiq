import { expect, test } from "@playwright/test";

import { readWindow } from "./support";

// Opt-in: runs only against the real bundle (`npm run e2e:real`). The screen's Alert count must equal the
// data service's own /fleet alert count at two different cut-offs.
test.skip(process.env.E2E_MODE !== "real", "needs the real bundle: npm run e2e:real");

test("Fleet Overview Alert count equals the /fleet API alert count at two cut-offs (real bundle)", async ({ page, request }) => {
  const w = await readWindow(request);
  const meta = await (await request.get("/api/v1/metadata")).json();
  expect(meta.synthetic ?? false).toBe(false);
  const cutoffs = [w.cutoff, 20];
  const counts: number[] = [];
  for (const cutoff of cutoffs) {
    const api = await (await request.get(`/api/v1/fleet?at=${w.start}&cutoff=${cutoff}&mv=${meta.model_version}`)).json();
    await page.goto(cutoff === w.cutoff ? "/" : `/?cutoff=${cutoff}`);
    await expect(page.getByTestId("card-alert")).toHaveText(String(api.cards.machines_in_alert));
    await expect(page.getByTestId("card-shown")).toHaveText(String(api.cards.machines_shown));
    const rows = await page.getByTestId("fleet-row").evaluateAll((els) => els.filter((e) => e.getAttribute("data-status") === "alert").length);
    // one page shows at most 25 rows; the Alert rows are the riskiest, so they all sit on the first page up to 25
    expect(rows).toBe(Math.min(25, api.cards.machines_in_alert));
    counts.push(api.cards.machines_in_alert);
  }
  expect(counts[1]).toBeGreaterThanOrEqual(counts[0]!); // a lower cut-off never lists fewer machines in Alert
});
