import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { addHours, readWindow, shownHour } from "./support";

const play = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^(Play|Pause)$/ });

test("starts at the replay start from /metadata and says Historical replay, never live", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto("/");
  await expect(page.getByTestId("replay-time")).toHaveAttribute("datetime", w.start);
  await expect(page.getByText("Historical replay").first()).toBeVisible();
  const text = (await page.locator("body").innerText()).toLowerCase();
  expect(text).not.toMatch(/\blive\b|real-time/);
  await expect(page.getByText(/Replay starts at the first test-period hour/)).toBeVisible();
});

test("step forward and back move by the step size and the time sits in the web address", async ({ page, request }) => {
  const w = await readWindow(request);
  const from = addHours(w.last, -100); // well inside the window for any bundle
  await page.goto(`/?at=${from}`);
  await expect(page.getByTestId("replay-time")).toHaveAttribute("datetime", from);
  await page.getByRole("button", { name: "Step forward" }).click();
  expect(await shownHour(page)).toBe(addHours(from, 1));
  await page.getByLabel("Step size").selectOption("24");
  await page.getByRole("button", { name: "Step forward" }).click();
  expect(await shownHour(page)).toBe(addHours(from, 25));
  await expect(page).toHaveURL(new RegExp(`at=${encodeURIComponent(addHours(from, 25))}`));
  await page.getByRole("button", { name: "Step back" }).click();
  expect(await shownHour(page)).toBe(addHours(from, 1));
  await page.getByRole("button", { name: "Start", exact: true }).click();
  expect(await shownHour(page)).toBe(w.first);
});

test("play advances once per second and pause stops it", async ({ page, request }) => {
  const w = await readWindow(request);
  const from = addHours(w.last, -100);
  await page.goto(`/?at=${from}`);
  await play(page).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeFocused();
  await expect.poll(() => shownHour(page), { timeout: 5000 }).not.toBe(from);
  await page.getByRole("button", { name: "Pause" }).click();
  const paused = await shownHour(page);
  await page.waitForTimeout(2200);
  expect(await shownHour(page)).toBe(paused);
});

test("playback stops cleanly at the end: visible end state, nothing later, never wraps", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto(`/?at=${addHours(w.last, -2)}`);
  await play(page).click();
  const end = page.getByTestId("end-state");
  await expect(end).toBeVisible({ timeout: 8000 });
  await expect(end).toContainText("End of the replay window. There is no later data.");
  await page.waitForTimeout(2200); // would wrap or move on if it did not stop
  expect(await shownHour(page)).toBe(w.last);
  await expect(page.getByRole("button", { name: "Play" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Step forward" })).toHaveAttribute("aria-disabled", "true");
  // still focusable, so focus is never lost
  await page.getByRole("button", { name: "Step forward" }).focus();
  await expect(page.getByRole("button", { name: "Step forward" })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "End of the replay window" }).first()).toBeAttached();
  expect(await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"))).toEqual([]);

  await page.getByRole("button", { name: "Jump to start" }).click();
  expect(await shownHour(page)).toBe(w.first);
  await expect(page.getByText("Start of the replay window.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Step back" })).toHaveAttribute("aria-disabled", "true");
  await expect(end).toBeHidden();
});

test("at the start, Start and Step back are unavailable with a visible reason", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto(`/?at=${w.first}`);
  await expect(page.getByText("Start of the replay window.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Step back" }).click({ force: true }); // does nothing
  expect(await shownHour(page)).toBe(w.first);
});

test("works by keyboard: Space toggles Play, the timeline moves with keys, focus stays put", async ({ page, request }) => {
  const w = await readWindow(request);
  const from = addHours(w.last, -100);
  await page.goto(`/?at=${from}`);
  await play(page).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play" })).toBeFocused();
  const slider = page.getByRole("slider", { name: "Replay time" });
  await slider.focus();
  const before = await shownHour(page);
  await page.keyboard.press("ArrowRight");
  expect(await shownHour(page)).toBe(addHours(before, 1));
  await page.keyboard.press("PageUp");
  expect(await shownHour(page)).toBe(addHours(before, 11));
  await page.keyboard.press("Home");
  expect(await shownHour(page)).toBe(w.first);
  await page.keyboard.press("End");
  expect(await shownHour(page)).toBe(w.last);
  // tab order: Start, Step back, Play, Step forward, Step size, timeline
  await page.getByRole("button", { name: "Start", exact: true }).focus();
  const names: string[] = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    names.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute("aria-label") ?? (document.activeElement as HTMLElement).textContent?.trim() ?? ""));
  }
  expect(names.slice(0, 3)).toEqual(["Step back", "Play", "Step forward"].map((n) => expect.stringContaining(n)));
});

test("with reduced motion, replay still steps", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const w = await readWindow(request);
  const from = addHours(w.last, -100);
  await page.goto(`/?at=${from}`);
  await play(page).click();
  await expect.poll(() => shownHour(page), { timeout: 5000 }).not.toBe(from);
});

test("the replay time, cut-off and machine follow the reader to another page; a bad address is ignored", async ({ page, request }) => {
  const w = await readWindow(request);
  const at = addHours(w.last, -50);
  await page.goto(`/?at=${at}&cutoff=30&machine=4&status=alert`);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Asset Details" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Asset Details");
  expect(await shownHour(page)).toBe(at);
  const url = new URL(page.url());
  expect(url.searchParams.get("at")).toBe(at);
  expect(url.searchParams.get("cutoff")).toBe("30");
  expect(url.searchParams.get("machine")).toBe("4");
  expect(url.searchParams.get("status")).toBeNull(); // filters stay on Fleet Overview

  await page.goto("/?at=not-a-time&cutoff=500");
  expect(await shownHour(page)).toBe(w.start);
  await expect(page.getByRole("note").filter({ hasText: /replay time in this link/ })).toBeVisible();
});

test("Model Performance shows the replay time read-only", async ({ page, request }) => {
  const w = await readWindow(request);
  await page.goto("/model-performance");
  await expect(page.getByTestId("replay-time")).toHaveAttribute("datetime", w.start);
  await expect(page.getByRole("button", { name: /^(Play|Pause|Start)$/ })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Replay time" })).toHaveCount(0);
});
