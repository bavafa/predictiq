import { expect, test, type Locator, type Page } from "@playwright/test";

import { COLOUR_JS, FOCUS_RING } from "./colour-support";
import { INTERACTIVE, PAGES, VIEWPORTS, openPage } from "./page-support";
import { addHours, readWindow, shownHour } from "./support";

// Keyboard-only walkthroughs. Rules: docs/ux-spec.md "Accessibility" (keyboard, sliders, replay controls, focus) and
// docs/design/components.md. Nothing here uses the mouse except to open the page; every action is a key press
// (Locator.focus() is used only to jump to a control whose position in the Tab order is checked separately).

// visibleFocus is true only when the focus outline is EXACTLY the ux-spec rule (2px solid, 2px offset, the focus-ring token
// colour, at least 3:1 against the background next to it); problems says what is off.
type Stop = { id: number | null; name: string; visibleFocus: boolean; problems: string[]; body: boolean };

/** Mark every control a Tab key should reach, and return their names in document order. */
async function markTabbable(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const nameOf = (el: HTMLElement) =>
      (el.getAttribute("aria-label") || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent || el.id || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60);
    const names: string[] = [];
    document.querySelectorAll("[data-kb]").forEach((el) => el.removeAttribute("data-kb"));
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (el.closest("[inert]")) continue;
      if ((el as HTMLButtonElement).disabled) continue; // a disabled control is not in the Tab order
      if (el.getAttribute("tabindex") === "-1") continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.getClientRects().length === 0) continue; // inside something that is not displayed
      el.setAttribute("data-kb", String(names.length));
      names.push(nameOf(el));
    }
    return names;
  }, INTERACTIVE);
}

async function currentStop(page: Page): Promise<Stop> {
  await page.evaluate(COLOUR_JS);
  return page.evaluate((rule) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { id: null, name: "", visibleFocus: false, problems: [], body: true };
    const problems: string[] = (window as unknown as { __piq: { focusProblems: (e: Element, r: unknown) => string[] } }).__piq.focusProblems(el, rule);
    const raw = el.getAttribute("data-kb");
    const name = (el.getAttribute("aria-label") || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent || el.tagName)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
    return { id: raw === null ? null : Number(raw), name, visibleFocus: problems.length === 0, problems, body: false };
  }, FOCUS_RING);
}

/** Press Tab from the top of the page until focus leaves the page, recording each stop. */
async function tabThrough(page: Page, expected: number): Promise<Stop[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(0, 0);
  const stops: Stop[] = [];
  // The limit is what makes a keyboard trap fail: focus has to leave the page within expected + 5 presses.
  for (let i = 0; i < expected + 5; i++) {
    await page.keyboard.press("Tab");
    const stop = await currentStop(page);
    if (stop.body) return stops;
    stops.push(stop);
  }
  throw new Error(`Keyboard trap? Focus never left the page in ${expected + 5} Tab presses. Stops: ${stops.map((s) => s.name).join(" > ")}`);
}

function expectInOrder(names: string[], wanted: string[]) {
  const at = names.findIndex((n) => n.startsWith(wanted[0]!));
  expect(at, `"${wanted[0]}" in the Tab order`).toBeGreaterThanOrEqual(0);
  wanted.forEach((w, i) => expect(names[at + i]?.startsWith(w), `Tab order: "${w}" should come ${i} after "${wanted[0]}"; got "${names[at + i]}"`).toBe(true));
}

for (const vp of VIEWPORTS) {
  test.describe(`keyboard Tab walkthrough (${vp.name})`, () => {
    for (const def of PAGES) {
      test(`${def.name}: Tab reaches every control, focus is always visible, no trap`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const names = await markTabbable(page);
        expect(names.length).toBeGreaterThanOrEqual(3); // at least: Skip to content, Menu or a page link, and a control
        const stops = await tabThrough(page, names.length);
        // The "Skip to content" link comes first (ux-spec, Accessibility).
        expect(stops[0]?.name).toBe("Skip to content");
        // Every stop is a control we know about, and shows a focus outline or ring.
        const unknown = stops.filter((s) => s.id === null).map((s) => s.name);
        expect(unknown, "Tab stopped on something that is not a listed control").toEqual([]);
        const unseen = stops.filter((s) => !s.visibleFocus).map((s) => `${s.name}: ${s.problems.join(", ")}`);
        expect(unseen, "these controls do not show the exact 2px focus outline with 3:1 contrast").toEqual([]);
        // Every control is reached.
        const reached = new Set(stops.map((s) => s.id));
        const missed = names.filter((_, i) => !reached.has(i));
        expect(missed, "controls the Tab key never reached").toEqual([]);
        // No control is reached twice (no loop inside the page) and the order follows the page.
        const ids = stops.map((s) => s.id as number);
        expect(ids).toEqual([...ids].sort((a, b) => a - b));
        // No positive tabindex anywhere: the order is the reading order.
        expect(await page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').count()).toBe(0);

        if (def.name !== "Model Performance" && def.name !== "About & Data") {
          // Replay controls: Start, Step back, Play, Step forward, Step size, then the timeline (ux-spec, Accessibility).
          expectInOrder(names, ["Start", "Step back", "Play", "Step forward", "Step size", "Replay time"]);
        }
      });
    }
  });
}

// --- the Menu (below 1024px) -----------------------------------------------------------------------------------

test.describe("keyboard: the Menu panel (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function tabTo(page: Page, name: string) {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      if ((await currentStop(page)).name === name) return;
    }
    throw new Error(`Tab never reached ${name}`);
  }

  test("Menu opens with Enter, focus moves in and stays in, Escape closes and returns focus", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await tabTo(page, "Menu");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Main menu" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    // Tab never leaves the open panel (it is a modal dialog), and every stop shows a focus outline.
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
      expect((await currentStop(page)).visibleFocus).toBe(true);
    }
    // Shift+Tab goes back the other way without escaping.
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    // The way out is Escape, and focus returns to the Menu button.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
  });

  test("Menu opens with Space, Close menu closes it with Enter and focus returns to Menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Menu", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Main menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
  });

  test("a page link in the Menu is followed with Enter, the panel closes and focus goes to the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Menu", exact: true }).focus();
    await page.keyboard.press("Enter");
    await tabTo(page, "Model Performance");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Model Performance");
    await expect(page.getByRole("dialog", { name: "Main menu" })).toBeHidden();
    await expect(page.locator("#main")).toBeFocused();
  });
});

// --- ⓘ definitions -----------------------------------------------------------------------------------------------

for (const vp of VIEWPORTS) {
  for (const def of [PAGES[1]!, PAGES[3]!]) {
    test(`ⓘ buttons open and close from the keyboard on ${def.name} (${vp.name})`, async ({ page }) => {
      await openPage(page, def, vp.width, vp.height);
      const buttons = page.getByRole("button", { name: /^What ".*" means$/ });
      const n = await buttons.count();
      expect(n).toBeGreaterThan(0);
      for (const b of [buttons.first(), buttons.nth(n - 1)]) {
        await b.focus();
        await expect(b).toHaveAttribute("aria-expanded", "false");
        await page.keyboard.press("Enter");
        await expect(b).toHaveAttribute("aria-expanded", "true");
        const note = page.locator(`#${await b.getAttribute("aria-controls")}`);
        await expect(note).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(b).toHaveAttribute("aria-expanded", "false");
        await expect(note).toBeHidden();
        await expect(b).toBeFocused(); // focus stays on the button it came from
        await page.keyboard.press("Space"); // and Space opens it too
        await expect(b).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");
        await expect(b).toBeFocused();
      }
    });
  }
}

// --- "View as table" -----------------------------------------------------------------------------------------------

for (const vp of VIEWPORTS) {
  for (const def of [PAGES[0]!, PAGES[1]!, PAGES[3]!]) {
    test(`View as table toggles from the keyboard on every chart of ${def.name} (${vp.name})`, async ({ page }) => {
      await openPage(page, def, vp.width, vp.height);
      const buttons = page.getByRole("button", { name: "View as table" });
      const n = await buttons.count();
      expect(n).toBeGreaterThan(0);
      const figures = page.locator("figure").filter({ has: page.getByRole("button", { name: /^View as (table|chart)$/ }) });
      expect(await figures.count()).toBe(n);
      for (let i = 0; i < n; i++) {
        const figure = figures.nth(i);
        const b = figure.getByRole("button", { name: "View as table" });
        await b.focus();
        await page.keyboard.press("Enter");
        const back = figure.getByRole("button", { name: "View as chart" });
        await expect(back).toBeFocused();
        await expect(back).toHaveAttribute("aria-pressed", "true");
        await expect(figure.getByRole("table")).toBeVisible();
        // A table that can scroll is a focusable, named region with a visible focus outline (WCAG 2.1.1).
        const region = figure.getByRole("region");
        if (await region.count()) {
          await region.focus();
          expect((await currentStop(page)).visibleFocus).toBe(true);
          await back.focus();
        }
        if (i === 0) {
          await page.keyboard.press("Space"); // Space goes back to the chart, focus stays
          await expect(figure.getByRole("button", { name: "View as table" })).toBeFocused();
          await expect(figure.getByRole("table")).toHaveCount(0);
          await page.keyboard.press("Enter");
          await expect(figure.getByRole("table")).toBeVisible();
        }
      }
    });
  }
}

// --- replay controls (Fleet, Asset, Planner) --------------------------------------------------------------------------

for (const vp of VIEWPORTS) {
  for (const def of [PAGES[0]!, PAGES[1]!, PAGES[2]!]) {
    test(`replay controls work by keyboard on ${def.name} (${vp.name})`, async ({ page, request }) => {
      const w = await readWindow(request);
      const from = addHours(w.last, -100);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const sep = def.path.includes("?") ? "&" : "?";
      await page.goto(`${def.path}${sep}at=${from}`);
      await def.ready(page);
      expect(await shownHour(page)).toBe(from);

      // Step forward and Step back: Enter and Space press them, focus stays.
      const forward = page.getByRole("button", { name: "Step forward" });
      await forward.focus();
      await page.keyboard.press("Enter");
      expect(await shownHour(page)).toBe(addHours(from, 1));
      await page.keyboard.press("Space");
      expect(await shownHour(page)).toBe(addHours(from, 2));
      await expect(forward).toBeFocused();
      const back = page.getByRole("button", { name: "Step back" });
      await back.focus();
      await page.keyboard.press("Enter");
      expect(await shownHour(page)).toBe(addHours(from, 1));

      // Step size: a native select, changed with the arrow key; the next step uses it.
      const size = page.getByLabel("Step size");
      await size.focus();
      await page.keyboard.press("ArrowDown");
      const stepHours = Number(await size.inputValue());
      expect(stepHours).toBeGreaterThan(1);
      await forward.focus();
      await page.keyboard.press("Enter");
      expect(await shownHour(page)).toBe(addHours(from, 1 + stepHours));

      // Play / Pause is one toggle; Space starts it, focus stays, Space stops it.
      const toggle = page.getByRole("button", { name: /^(Play|Pause)$/ });
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("button", { name: "Pause" })).toBeFocused();
      await expect.poll(() => shownHour(page), { timeout: 6000 }).not.toBe(addHours(from, 1 + stepHours));
      await page.keyboard.press("Space");
      await expect(page.getByRole("button", { name: "Play" })).toBeFocused();
      const paused = await shownHour(page);
      await page.waitForTimeout(1500);
      expect(await shownHour(page)).toBe(paused);

      // The timeline: arrow keys move 1 hour, Page keys 10, Home and End go to the ends.
      const line = page.getByRole("slider", { name: "Replay time" });
      await line.focus();
      await page.keyboard.press("Home");
      await expect.poll(() => shownHour(page)).toBe(w.first);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => shownHour(page)).toBe(addHours(w.first, 1));
      await page.keyboard.press("PageUp");
      await expect.poll(() => shownHour(page)).toBe(addHours(w.first, 11));
      await page.keyboard.press("PageDown");
      await expect.poll(() => shownHour(page)).toBe(addHours(w.first, 1));
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => shownHour(page)).toBe(w.first);
      await page.keyboard.press("End");
      await expect.poll(() => shownHour(page)).toBe(w.last);
      // At the end the buttons that cannot act stay focusable (and say so) rather than losing focus.
      await expect(page.getByRole("button", { name: "Step forward" })).toHaveAttribute("aria-disabled", "true");
      await page.getByRole("button", { name: "Step forward" }).focus();
      await expect(page.getByRole("button", { name: "Step forward" })).toBeFocused();
    });
  }
}

// --- cut-off slider (Fleet, Planner, Model Performance) -----------------------------------------------------------------

for (const vp of VIEWPORTS) {
  for (const def of [PAGES[0]!, PAGES[2]!, PAGES[3]!]) {
    test(`the alert cut-off slider moves with the keys on ${def.name} (${vp.name})`, async ({ page, request }) => {
      const w = await readWindow(request);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(def.path.split("?")[0]!); // the default cut-off
      await def.ready(page);
      const slider = page.getByRole("slider", { name: "Alert cut-off" });
      await slider.focus();
      await expect(slider).toHaveValue(String(w.cutoff));
      await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveValue(String(w.cutoff + 1));
      await page.keyboard.press("ArrowUp");
      await expect(slider).toHaveValue(String(w.cutoff + 2));
      await page.keyboard.press("ArrowLeft");
      await expect(slider).toHaveValue(String(w.cutoff + 1));
      await page.keyboard.press("PageUp");
      await expect(slider).toHaveValue(String(w.cutoff + 11));
      await page.keyboard.press("PageDown");
      await expect(slider).toHaveValue(String(w.cutoff + 1));
      await expect(page.getByTestId("cutoff-value")).toContainText("(custom)");
      await page.keyboard.press("End");
      await expect(slider).toHaveValue("100");
      await page.keyboard.press("Home");
      await expect(slider).toHaveValue("0");
      // Reset to default is a button: Enter puts the default back.
      await page.getByRole("button", { name: "Reset to default", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(slider).toHaveValue(String(w.cutoff));
      await expect(page.getByTestId("cutoff-value")).toContainText("(default)");
    });
  }
}

// --- Maintenance Planner inputs --------------------------------------------------------------------------------------------

async function typeInto(page: Page, field: Locator, text: string) {
  await field.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(text);
}

for (const vp of VIEWPORTS) {
  test(`Maintenance Planner: inputs and Apply buttons work by keyboard (${vp.name})`, async ({ page }) => {
    await openPage(page, PAGES[2]!, vp.width, vp.height);
    // typing into one model's cost, then Tab to the next field in the grid
    await typeInto(page, page.getByTestId("cost-model1"), "12345");
    await expect(page.getByTestId("cost-model1")).toHaveValue("12345");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("cost-model2")).toBeFocused();
    // "Set every model's failure cost to": type, Tab to the Apply button, Enter
    await typeInto(page, page.getByTestId("failure-cost"), "20000");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("failure-cost-apply")).toBeFocused();
    await page.keyboard.press("Enter");
    for (const m of ["model1", "model2", "model3", "model4"]) await expect(page.getByTestId(`cost-${m}`)).toHaveValue("20000");
    // the same for planned cost, with Space on the button
    await typeInto(page, page.getByTestId("planned-cost"), "900");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("planned-cost-apply")).toBeFocused();
    await page.keyboard.press("Space");
    for (const m of ["model1", "model2", "model3", "model4"]) await expect(page.getByTestId(`planned-${m}`)).toHaveValue("900");
    // crew slots: type a number, then use the + and - buttons
    await typeInto(page, page.getByTestId("crew-slots"), "3");
    await page.getByRole("button", { name: "More crew slots" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("crew-slots")).toHaveValue("4");
    await page.getByRole("button", { name: "Fewer crew slots" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("crew-slots")).toHaveValue("3");
    // checkboxes: Space; the reduction slider only works once its box is ticked, then arrow keys move it by 5 points
    const reduction = page.getByRole("slider", { name: "Reduction" });
    await expect(reduction).toBeDisabled();
    await page.getByTestId("reduction-toggle").focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("reduction-toggle")).toBeChecked();
    await expect(reduction).toBeEnabled();
    const start = Number(await reduction.inputValue());
    await reduction.focus();
    await page.keyboard.press("ArrowRight");
    await expect(reduction).toHaveValue(String(start + 5));
    await page.keyboard.press("PageDown");
    await expect(reduction).toHaveValue(String(Math.max(0, start + 5 - 50)));
    await page.keyboard.press("End");
    await expect(page.getByTestId("reduction-value")).toContainText("%");
    const below = page.getByRole("checkbox", { name: /Also list machines below the cut-off/ });
    await below.focus();
    await page.keyboard.press("Space");
    await expect(below).toBeChecked();
    // an invalid value is explained, and Apply does not take it
    await typeInto(page, page.getByTestId("failure-cost"), "-5");
    await expect(page.getByTestId("invalid-note")).toBeVisible();
    await page.getByTestId("failure-cost-apply").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("cost-model1")).toHaveValue("20000");
  });
}

// --- the error state's Try again ----------------------------------------------------------------------------------------------

test("keyboard: Try again in the error state is reachable and works", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/metadata*", (route) => (fail ? route.abort() : route.continue()));
  await page.goto("/");
  const error = page.getByTestId("service-error");
  await expect(error).toBeVisible();
  fail = false;
  const retry = error.getByRole("button", { name: "Try again" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("card-shown")).toBeVisible();
});
