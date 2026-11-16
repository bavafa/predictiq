import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { PAGES, VIEWPORTS, openPage } from "./page-support";

// axe-core on all five pages, desktop and mobile, with ZERO violations of any impact (not only serious/critical).
// Tags: WCAG 2.0 A and AA, 2.1 A and AA, 2.2 AA. Main states, loading, waking up, error, empty, charts as tables and
// open dialogs / definitions. axe finds roughly a third of WCAG problems; it does not replace a human review.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// The documented cases where axe's color-contrast reports a node as "incomplete" (cannot decide). Each is matched by
// rule id + selector + reason. "Rendered text contrast" in contrast.spec.ts measures every visible text element, which is
// what covers the text cases; the icon cases hold no text characters.
const ACCEPTED_INCOMPLETE: { name: string; rule: string; selector: RegExp; reason: RegExp; coveredBy: string }[] = [
  {
    name: "chart axis, tick and label text (recharts <tspan> inside an <svg>)",
    rule: "color-contrast",
    selector: /(^|> )tspan(\[[^\]]*\])+$/,
    reason: /^Element's background color could not be determined because (element contains an image node|it is overlapped by another element)$|^Element content is too short to determine if it is actual text content$/,
    coveredBy: "rendered text contrast (SVG text, fill colour against the chart background)",
  },
  {
    name: "chart summary line (a one- or two-line paragraph below the fold, which axe cannot sample)",
    rule: "color-contrast",
    selector: /^#_r_[a-z0-9]+_-s$/,
    reason: /^Element's background color could not be determined because it is overlapped by another element$/,
    coveredBy: "rendered text contrast (every visible text element is measured against its real background)",
  },
  {
    name: "chart legend text (recharts legend item text span)",
    rule: "color-contrast",
    selector: /recharts-legend-item-text > span$/,
    reason: /^Element's background color could not be determined because element contains an image node$/,
    coveredBy: "rendered text contrast",
  },
  {
    name: "replay bar helper text (fourth child of the replay bar row)",
    rule: "color-contrast",
    selector: /^\.gap-x-2 > \.text-ink-2\.text-xs:nth-child\(4\)$/,
    reason: /^Element's background color could not be determined because it's partially obscured by another element$/,
    coveredBy: "rendered text contrast",
  },
  {
    name: "planner plan-table cells: slot and moved",
    rule: "color-contrast",
    // axe names the cell either way (td or .whitespace-nowrap), depending on what else is on the page
    selector: /\[data-testid="plan-row"\](\[data-listing="[a-z_]+"\])? > (td|\.whitespace-nowrap)\[data-testid="(slot|moved)"\]$/,
    reason: /^Element's background color could not be determined because it's partially obscured by another element$/,
    coveredBy: "rendered text contrast",
  },
  {
    name: "aria-hidden icon glyph (no text characters)",
    rule: "color-contrast",
    selector: /span\[aria-hidden="true"\]$/,
    reason: /^Element content contains only non-text characters$/,
    coveredBy: "nothing needed: no text; the glyph is decorative and its control has a text name",
  },
  {
    name: "the crew-slot stepper symbols",
    rule: "color-contrast",
    selector: /^button\[aria-label="(Fewer|More) crew slots"\]$/,
    reason: /^Element content contains only non-text characters$/,
    coveredBy: "control boundary check in contrast.spec.ts (the symbol is a non-text mark with an accessible name)",
  },
];

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`);
}

for (const vp of VIEWPORTS) {
  test.describe(`axe, ${vp.name}`, () => {
    for (const def of PAGES) {
      test(`${def.name}: main state`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        expect(await violations(page)).toEqual([]);
      });
    }

    for (const def of [PAGES[0]!, PAGES[1]!, PAGES[3]!]) {
      test(`${def.name}: every chart shown as a table`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const buttons = page.getByRole("button", { name: "View as table" });
        const n = await buttons.count();
        expect(n).toBeGreaterThan(0);
        for (let i = 0; i < n; i++) await page.getByRole("button", { name: "View as table" }).first().click();
        await expect(page.getByRole("button", { name: "View as chart" })).toHaveCount(n);
        expect(await violations(page)).toEqual([]);
      });
    }

    for (const def of [PAGES[1]!, PAGES[3]!]) {
      test(`${def.name}: every ⓘ definition open`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const buttons = page.getByRole("button", { name: /^What ".*" means$/ });
        const n = await buttons.count();
        expect(n).toBeGreaterThan(0);
        for (let i = 0; i < n; i++) await buttons.nth(i).click();
        await expect(page.locator('button[aria-expanded="true"]:not([aria-controls="time-controls"]):not([aria-controls="model-details"])')).toHaveCount(n);
        expect(await violations(page)).toEqual([]);
      });
    }

    test("Fleet Overview: filtered to nothing (empty state)", async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/assets?status=alert&cutoff=100");
      await expect(page.getByTestId("empty-result")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("Asset Details: no machine chosen, and machine not found", async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/asset-details");
      await expect(page.getByTestId("no-machine")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.goto("/asset-details?machine=999");
      await expect(page.getByTestId("machine-not-found")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("Maintenance Planner: nothing at or above the cut-off (empty), and an invalid input", async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/maintenance-planner?cutoff=100");
      await expect(page.getByTestId("planner-empty")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await openPage(page, PAGES[2]!, vp.width, vp.height);
      await page.getByTestId("failure-cost").fill("-5");
      await expect(page.getByTestId("invalid-note")).toBeVisible();
      await page.getByTestId("reduction-toggle").check();
      expect(await violations(page)).toEqual([]);
    });

    // About & Data and In a Real Plant are static pages: they read nothing from the data service, so they have no
    // loading, waking-up or error state to check.
    for (const def of PAGES.filter((p) => p.name !== "About this demo" && p.name !== "In a real plant")) {
      test(`${def.name}: loading state and "waking up" state`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => (release = resolve));
        await page.route("**/api/v1/metadata*", async (route) => {
          await gate;
          await route.continue();
        });
        await page.goto(def.path);
        await expect(page.getByTestId("skeleton").first()).toBeVisible();
        expect(await violations(page)).toEqual([]);
        await expect(page.getByTestId("waking-up")).toBeVisible({ timeout: 8000 }); // after 3 s without an answer
        expect(await violations(page)).toEqual([]);
        release();
        await def.ready(page);
      });

      test(`${def.name}: the data service cannot be reached (error state)`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.route("**/api/v1/metadata*", (route) => route.abort());
        await page.goto(def.path);
        await expect(page.getByTestId("service-error")).toBeVisible();
        await expect(page.getByTestId("service-error")).toContainText("Try again");
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

test("axe: the open mobile Menu panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/assets");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("axe: a panel that failed to load (Fleet Overview, desktop)", async ({ page }) => {
  await page.route("**/api/v1/fleet?**", (route) =>
    route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "boom", status: 500 }) }),
  );
  await page.goto("/assets");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Assets");
  await expect(page.getByTestId("service-error").first()).toContainText("Couldn't load the fleet");
  expect(await violations(page)).toEqual([]);
});

// color-contrast is part of wcag2aa. This proves it is ENABLED and really ran on text, rather than being skipped:
// the rule must appear in axe's passes with nodes checked (and not in "inapplicable"), on every page at both sizes.
// Nodes axe cannot decide (text over images, for example) are listed under "incomplete"; there must be none.
for (const vp of VIEWPORTS) {
  for (const def of PAGES) {
    test(`axe color-contrast rule ran on ${def.name} (${vp.name})`, async ({ page }) => {
      await openPage(page, def, vp.width, vp.height);
      const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const passed = res.passes.find((r) => r.id === "color-contrast");
      expect(passed, "color-contrast is in the passes").toBeTruthy();
      expect(passed!.nodes.length, "text nodes checked by color-contrast").toBeGreaterThan(5);
      expect(res.inapplicable.some((r) => r.id === "color-contrast")).toBe(false);
      // Nodes axe could not decide. Only the documented cases in ACCEPTED_INCOMPLETE are accepted: each node must match
      // one case on rule id (color-contrast), selector AND reason. A known selector with a new reason, or a new selector
      // with a known reason, fails. Anything else axe cannot decide fails this test.
      const undecided = res.incomplete
        .filter((r) => r.id === "color-contrast")
        .flatMap((r) => r.nodes.map((n) => ({ rule: r.id, target: n.target.join(" "), why: n.any[0]?.message ?? "", html: n.html })))
        .filter((n) => !ACCEPTED_INCOMPLETE.some((c) => c.rule === n.rule && c.selector.test(n.target) && c.reason.test(n.why)))
        .map((n) => `${n.target.slice(-80)} :: ${n.why} :: ${n.html.slice(0, 120)}`);
      expect(undecided).toEqual([]);
    });
  }
}
