import { test } from "@playwright/test";

// Redesign screenshots for the stage 6 gate. Off by default: SHOTS=1 npm run e2e -- e2e/screenshots.spec.ts
test.skip(!process.env.SHOTS, "screenshots are taken only on request");

const SCREENS = [
  ["overview", "/?cutoff=30"],
  ["assets", "/assets?cutoff=30"],
  ["asset-page", "/asset-details?machine=1&cutoff=30"],
  ["work-plan", "/maintenance-planner?cutoff=30"],
  ["alert-accuracy", "/model-performance"],
] as const;
const VIEWS = [
  ["desktop", 1280, 900],
  ["mobile", 390, 844],
] as const;

for (const [name, path] of SCREENS) {
  for (const [vp, width, height] of VIEWS) {
    test(`screenshot: ${name} (${vp})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `../docs/QA_REPORTS/redesign-screenshots/${name}-${vp}.png`, fullPage: true });
    });
  }
}
