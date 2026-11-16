# Redesign gate report (stage 6), 15 Nov 2026

GATE R6: PASS with open items (owner decides)

Pull requests: #19 shell, #20 Overview and Assets, #21 Asset page, #22 Work plan, #23 Alert accuracy and copy (all merged by the owner, CI green on each), plus this stage 6 pull request.
Screenshots (synthetic test bundle, so the numbers are not the real results): `docs/QA_REPORTS/redesign-screenshots/` (Overview, Assets, Asset page, Work plan, Alert accuracy; desktop 1280 px and phone 390 px).

## Criteria
1. **A first-time visitor can say what the site is and what to do next within 10 seconds: NOT MEASURED.** The first screen states the product ("PredictIQ, Predictive maintenance, Demo plant"), the situation and each alert's next action, but no person has tested it. Needs the five-second test with at least five people.
2. **The first screen answers "what needs attention and what should we do": MET.** Overview opens on the headline, an alert card per alert with a reason and "Add to work plan" (screenshot `overview-desktop.png`).
3. **A visitor can take a recommended job from alert to scheduled to done: MET (automated).** `e2e/workplan.spec.ts` adds the top alert, schedules it, reloads, marks it done and resets. The 60-second hand-timed check is NOT DONE.
4. **Palette and existing accessibility checks stay in force: MET for what runs here.** Playwright 273 passed, 5 skipped, 6 failed; the 6 are `keyboard.spec.ts:242` (replay controls by keyboard), which fail only on this machine (also on unmodified `main` before the redesign) and passed in CI on all five merged pull requests. Axe on every page, contrast, 44 px targets and release hygiene are inside the 273. No check was weakened; tests that asserted old copy were updated one at a time in each stage.
5. **The honesty record stays intact: MET.** The disclosure strip is on every page (notice spec). About this demo, Alert accuracy and every limitation remain. Alert accuracy now opens with the 107-of-107-style answer always next to "Real equipment would score lower". Money columns keep "Illustrative"; other tags are hidden by default but kept in accessible names (owner-approved rule change).

## Key measured values
Vitest 210 passed. pytest 414 passed, 19 deselected. Playwright 273 passed, 5 skipped, 6 failed (known). tsc and eslint clean.

## Open must-fix
None known.

## Honesty issues
- The screenshots use the synthetic test bundle (for example "101 of 107 failures"), not the real saved results; do not use them as results.
- "Why" text on alert cards uses only the latest error record; richer reasons are on the Asset page. Both say patterns, not causes.
- No independent review: `codex` is not installed here, so the CLAUDE.md review was not run. My own look at the screenshots found and fixed three copy defects ("1 years old", "Replay starts", "before the replay hour"). This is not an independent review.

## Not built (in the spec or mock-ups)
Sensor tiles with a trend line and a single history timeline on the Asset page (the existing charts and record lists stay); the Work plan summary strip, a merged list of your jobs and recommended parts, "Export job list", and Parts as the default level; header does not show "100 assets". The planner table on Work plan scrolls sideways at 1280 px (it did before the redesign).

## Risks
Browser-saved job state only (no server). Old bookmarks to `/` with filters redirect to `/assets`; other routes did not change.

## Decisions for Meysam
1. Waive or run the independent Codex review of the redesign (decision 80 waived it only for the component planner).
2. Build the unbuilt items above now, later, or drop them.
3. Run the five-second test (at least five people) and the 60-second timed check, and record the results.

## Next
1. Owner: merge this pull request and decide the three items above.
2. Run the five-second and 60-second success checks with people.
3. Optional follow-ups: sensor tiles and history timeline; Work plan summary strip and export.
