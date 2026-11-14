import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type Window = { first: string; last: string; start: string; cutoff: number };

/** The replay window and start, read from the running data service (so tests fit any bundle). */
export async function readWindow(request: APIRequestContext): Promise<Window> {
  const res = await request.get("/api/v1/metadata");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.model_available).toBe(true);
  const hour = (t: string) => t.slice(0, 16);
  return {
    first: hour(m.replay_window.start),
    last: hour(m.replay_window.end),
    start: hour(m.replay_start),
    cutoff: m.default_cutoff_percent,
  };
}

export function addHours(at: string, hours: number): string {
  const t = new Date(`${at}:00Z`).getTime() + hours * 3_600_000;
  return new Date(t).toISOString().slice(0, 16);
}

/** The hour the replay bar currently shows, as YYYY-MM-DDTHH:00 (from the time element). */
export async function shownHour(page: Page): Promise<string> {
  const value = await page.getByTestId("replay-time").getAttribute("datetime");
  expect(value).not.toBeNull();
  return value as string;
}
