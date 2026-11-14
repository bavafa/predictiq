import { expect, test } from "@playwright/test";

import { readWindow } from "./support";

// Opt-in: the real bundle only (`npm run e2e:real`). With the starting values the screen's shortlist must equal
// the shortlist POST /plan returns for the same request.
test.skip(process.env.E2E_MODE !== "real", "needs the real bundle: npm run e2e:real");

test("the Planner screen's shortlist equals POST /plan's shortlist for the default inputs (real bundle)", async ({ page, request }) => {
  const w = await readWindow(request);
  const meta = await (await request.get("/api/v1/metadata")).json();
  expect(meta.synthetic ?? false).toBe(false);
  const res = await request.post(`/api/v1/plan?mv=${meta.model_version}`, {
    data: { at: w.start, failure_cost: 10000, planned_cost: 2500, crew_slots: 5 },
  });
  expect(res.ok()).toBe(true);
  const api = await res.json();
  const apiShortlist = api.rows.filter((r: { listing: string }) => r.listing === "shortlisted").map((r: { machine_id: number }) => String(r.machine_id));

  await page.goto("/maintenance-planner");
  await expect(page.getByTestId("planner-ready")).toBeVisible();
  await expect(page.getByTestId("planner-ready")).not.toHaveAttribute("aria-busy", "true");
  const shown = await page
    .getByTestId("plan-row")
    .evaluateAll((els) => els.filter((e) => e.getAttribute("data-listing") === "shortlisted").map((e) => e.getAttribute("data-machine") ?? ""));
  expect(shown).toEqual(apiShortlist);
  expect(shown.length).toBeGreaterThan(0);
  await expect(page.getByTestId("summary-slots")).toContainText(`${api.summary.slots_used} of 5 crew slots used`);
  expect(await page.getByTestId("plan-row").count()).toBe(api.rows.length);
});
