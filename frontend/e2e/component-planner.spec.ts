import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The Parts plan and the Asset Details parts panel against the real stack (synthetic bundle with component scores
// in CI). The numbers are fake; the tests check the rules and the honest labels, not the values.

async function openParts(page: Page, query = "") {
  await page.goto(`/maintenance-planner${query}`);
  await page.getByTestId("level-parts").click();
  await settled(page);
}

async function settled(page: Page) {
  await expect(page.getByTestId("component-ready")).toBeVisible();
  await expect(page.getByTestId("component-ready")).not.toHaveAttribute("aria-busy", "true");
}

/** None of the scrolling wrappers inside `testId` has to scroll sideways: the tables fit the width they are given.
 *  (The page's own replay bar is wider than 1280 px on its own; that is not this feature's layout.) */
const fits = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((root) =>
    [root, ...root.querySelectorAll(".overflow-x-auto")].every((e) => e.scrollWidth <= e.clientWidth + 1),
  );

async function blocking(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
}

test("the Machines plan is still the default, and Parts is one click away", async ({ page }) => {
  await page.goto("/maintenance-planner?cutoff=5");
  await expect(page.getByTestId("planner-ready")).toBeVisible();
  await expect(page.getByTestId("level-machine")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("level-parts").click();
  await settled(page);
  await expect(page.getByTestId("level-parts")).toHaveAttribute("aria-checked", "true");
});

test("Parts plan: honest labels, 14 days by default, ranked by exposure, slots per window", async ({ page }) => {
  await openParts(page);
  await expect(page.getByTestId("honesty")).toContainText("not an early warning");
  await expect(page.getByTestId("horizon-14")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("component-banner")).toContainText("assumed or illustrative");
  await expect(page.getByTestId("windows")).toContainText("Assumed");
  const rows = page.getByTestId("part-row");
  expect(await rows.count()).toBeGreaterThan(0);
  const exposures = await page.getByTestId("part-exposure").evaluateAll((els) => els.map((e) => Number((e.firstChild?.textContent ?? "0").replace(/,/g, ""))));
  expect(exposures.length).toBeGreaterThan(0);
  expect(exposures).toEqual([...exposures].sort((a, b) => b - a));
  // every wear row carries the weak-signal label; every warning row names the part's signature
  for (const s of await page.getByTestId("signal").all()) {
    const text = (await s.textContent()) ?? "";
    expect(text).toMatch(/Wear estimate: weak signal in this data|Warning: .+ signature/);
  }
  // part names are the illustrative ones; the raw id stays in the title
  const first = rows.first();
  await expect(first.locator("td").nth(1)).toContainText(/comp[1-4]/);
  // slots are per window: no window is above the crew slots
  const slotsPerWindow = Number(await page.getByTestId("part-crew-slots").inputValue());
  const lines = await page.getByTestId("window").allTextContents();
  for (const l of lines) expect(Number(/(\d+) of \d+ slots/.exec(l)?.[1] ?? 0)).toBeLessThanOrEqual(slotsPerWindow);
});

test("the horizon switch and crew slots change the plan; net benefit only when assumed", async ({ page }) => {
  await openParts(page);
  const before = await page.getByTestId("part-exposure").allTextContents();
  await page.getByTestId("horizon-7").click();
  await expect(page.getByTestId("horizon-7")).toHaveAttribute("aria-pressed", "true");
  await settled(page);
  expect(await page.getByTestId("part-exposure").allTextContents()).not.toEqual(before);
  await expect(page.getByTestId("part-net")).toHaveCount(0);
  await page.getByTestId("component-assumptions").getByTestId("reduction-toggle").check();
  await settled(page);
  await expect(page.getByTestId("component-net")).toContainText("estimate");
  await page.getByTestId("part-crew-slots").fill("0");
  await settled(page);
  await expect(page.getByTestId("component-slots")).toContainText("0 slots used");
});

test("an invalid cost keeps the last answer and sends nothing", async ({ page }) => {
  await openParts(page);
  let posts = 0;
  page.on("request", (r) => r.method() === "POST" && r.url().includes("/plan") && (posts += 1));
  await page.getByTestId("part-cost-comp2").fill("abc");
  await expect(page.getByTestId("component-invalid-note")).toBeVisible();
  await page.waitForTimeout(300);
  expect(posts).toBe(0);
  await expect(page.getByTestId("part-row").first()).toBeVisible();
});

test("a part row opens that machine on Asset Details, which shows its four parts", async ({ page }) => {
  await openParts(page);
  const first = page.getByTestId("part-row").first();
  const machine = await first.getAttribute("data-machine");
  // The link's target is checked, then opened by address (a client-side click from this page lands on "Choose a
  // machine" in a local production build; that is an older problem of the shared address handling).
  const href = await first.getByRole("link").first().getAttribute("href");
  expect(href).toMatch(new RegExp(`^/asset-details\\?.*machine=${machine}`));
  await page.goto(href!);
  const panel = page.getByTestId("component-panel");
  await expect(panel.getByTestId("component-row")).toHaveCount(4);
  await expect(panel.getByTestId("component-honesty")).toContainText("not an early warning");
  await expect(panel.getByTestId("component-window")).toContainText("Assumed");
  await panel.getByTestId("panel-horizon-7").click();
  await expect(panel.getByTestId("panel-horizon-7")).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByTestId("component-row")).toHaveCount(4);
});

// Linux CI draws text wider than a Mac does, so every size is also checked with the text 18% larger.
for (const scale of [1, 1.18]) {
  for (const [name, size] of [
    ["desktop", { width: 1280, height: 900 }],
    ["narrow desktop", { width: 1024, height: 800 }],
    ["mobile", { width: 390, height: 844 }],
  ] as const) {
    test(`tables fit and no serious accessibility problems (${name}, text ${Math.round(scale * 100)}%)`, async ({ page }) => {
      await page.setViewportSize(size);
      const grow = () => page.evaluate((x) => void (document.documentElement.style.fontSize = `${x * 100}%`), scale);
      await openParts(page);
      await grow();
      expect(await fits(page, "parts-list")).toBe(true);
      if (name === "mobile") expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(await blocking(page)).toEqual([]);
      await page.goto("/asset-details?machine=3");
      await expect(page.getByTestId("component-row")).toHaveCount(4);
      await grow();
      expect(await fits(page, "component-panel")).toBe(true);
      expect(await blocking(page)).toEqual([]);
    });
  }
}
