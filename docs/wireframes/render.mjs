// Renders the static wireframes in this folder to PNG (design-stage helper, not app code).
// Usage: node docs/wireframes/render.mjs            -> renders everything in SHOTS
//        node docs/wireframes/render.mjs fleet      -> only shots whose output name contains "fleet"
// Uses the locally installed playwright-core and system Chrome. Downloads nothing.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
// playwright-core comes with the frontend's dev dependencies (run `npm ci` in frontend/), or set PLAYWRIGHT_CORE.
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE ?? fileURLToPath(new URL('../../frontend/node_modules/playwright-core', import.meta.url)),
);

const here = path.dirname(fileURLToPath(import.meta.url));
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

// [html file stem, state or null, viewport]
const SCREENS = ['fleet-overview', 'asset-details', 'maintenance-planner', 'model-performance', 'about-data'];
const SHOTS = [
  ...SCREENS.flatMap((s) => [[s, null, 'desktop'], [s, null, 'mobile']]),
  ['fleet-overview', 'loading', 'desktop'],
  ['fleet-overview', 'waking', 'desktop'],
  ['fleet-overview', 'error', 'desktop'],
  ['fleet-overview', 'empty', 'mobile'],
  ['fleet-overview', 'empty', 'desktop'],
  ['fleet-overview', 'threshold-changed', 'desktop'],
  ['fleet-overview', 'replay-end', 'desktop'],
  ['fleet-overview', 'replay-start', 'mobile'],
  ['fleet-overview', 'nav-open', 'mobile'],
  ['asset-details', 'no-machine', 'desktop'],
  ['asset-details', 'no-machine', 'mobile'],
  ['asset-details', 'loading', 'desktop'],
  ['asset-details', 'partial', 'desktop'],
  ['asset-details', 'panel-error', 'desktop'],
  ['asset-details', 'not-found', 'desktop'],
  ['asset-details', 'not-found', 'mobile'],
  ['maintenance-planner', 'invalid-input', 'desktop'],
  ['maintenance-planner', 'effectiveness-on', 'desktop'],
  ['maintenance-planner', 'empty', 'mobile'],
  ['maintenance-planner', 'per-model-cost', 'desktop'],
  ['maintenance-planner', 'loading', 'desktop'],
  ['maintenance-planner', 'error', 'desktop'],
  ['maintenance-planner', 'error', 'mobile'],
  ['model-performance', 'not-evaluated', 'desktop'],
  ['model-performance', 'loading', 'desktop'],
  ['model-performance', 'error', 'desktop'],
  ['about-data', 'metadata-failed', 'mobile'],
];

const filter = process.argv[2];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const problems = [];
try {
  for (const [stem, state, vp] of SHOTS) {
    const out = state ? `${stem}-state-${state}-${vp}.png` : `${stem}-${vp}.png`;
    if (filter && !out.includes(filter)) continue;
    const page = await browser.newPage({ viewport: VIEWPORTS[vp] });
    const url = pathToFileURL(path.join(here, `${stem}.html`)).href + (state ? `?state=${state}` : '');
    await page.goto(url);
    // Layout check: nothing may be wider than the viewport.
    // The page hides sideways overflow, so also measure every visible element's right edge.
    const overflow = await page.evaluate(() => {
      let worst = document.documentElement.scrollWidth - window.innerWidth;
      for (const el of document.querySelectorAll('main *, .topbar *, .replaybar *, .banner')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || getComputedStyle(el).position === 'fixed') continue;
        if (el.closest('.sidebar')) continue;
        worst = Math.max(worst, Math.ceil(r.right - window.innerWidth));
      }
      return worst;
    });
    if (overflow > 0) problems.push(`${out}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: path.join(here, out), fullPage: true });
    await page.close();
    console.log(`wrote ${out}${overflow > 0 ? `  (OVERFLOW ${overflow}px)` : ''}`);
  }
} finally {
  await browser.close();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
