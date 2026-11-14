import { expect, test } from "@playwright/test";

import { readWindow } from "./support";

// Opt-in: the real bundle only (`npm run e2e:real`). With the starting values the screen's shortlist must equal
// the shortlist POST /plan returns for the same request.
test.skip(process.env.E2E_MODE !== "real", "needs the real bundle: npm run e2e:real");

test("the Planner screen's shortlist equals POST /plan's shortlist for the default inputs, per-model costs included (real bundle)", async ({ page, request }) => {
  const w = await readWindow(request);
  const meta = await (await request.get("/api/v1/metadata")).json();
  expect(meta.synthetic ?? false).toBe(false);
  const res = await request.post(`/api/v1/plan?mv=${meta.model_version}`, {
    data: {
      at: w.start,
      failure_cost: 10000,
      failure_cost_by_model: { model1: 10000, model2: 8000, model3: 12000, model4: 9000 },
      planned_cost: 2500,
      planned_cost_by_model: { model1: 2500, model2: 2000, model3: 3000, model4: 2250 },
      crew_slots: 5,
    },
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

test("Apply to all models with equal failure costs matches POST /plan with equal costs (real bundle)", async ({ page, request }) => {
  const w = await readWindow(request);
  const meta = await (await request.get("/api/v1/metadata")).json();
  const same = { model1: 10000, model2: 10000, model3: 10000, model4: 10000 };
  const res = await request.post(`/api/v1/plan?mv=${meta.model_version}`, {
    data: {
      at: w.start,
      failure_cost: 10000,
      failure_cost_by_model: same,
      planned_cost: 2500,
      planned_cost_by_model: { model1: 2500, model2: 2000, model3: 3000, model4: 2250 },
      crew_slots: 5,
    },
  });
  expect(res.ok()).toBe(true);
  const api = await res.json();
  await page.goto("/maintenance-planner");
  await expect(page.getByTestId("planner-ready")).toBeVisible();
  await page.getByTestId("failure-cost-apply").click();
  await expect(page.getByTestId("cost-model3")).toHaveValue("10000");
  await expect(page.getByTestId("moved")).toHaveCount(0);
  await expect(page.getByTestId("planner-ready")).not.toHaveAttribute("aria-busy", "true");
  const order = await page.getByTestId("plan-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-machine") ?? ""));
  expect(order).toEqual(api.rows.map((r: { machine_id: number }) => String(r.machine_id)));
});
