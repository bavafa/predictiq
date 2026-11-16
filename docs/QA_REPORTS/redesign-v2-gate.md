# Redesign v2 gate report (stage 6), 16 Nov 2026

GATE V2-6: PASS with open items (owner decides)

Pull requests: #25 spec and decisions 83 to 86, #26 shell (top navigation, Play, footer, status words), #27 Home, #28 Alerts, #29 Machine page, #30 one-list Work plan (all merged by the owner, the required `e2e` check passed on each), plus this stage 6 pull request.
Screenshots (synthetic test bundle, so the numbers are not the real results): `docs/QA_REPORTS/redesign-v2-screenshots/` (Home, Alerts, Assets, Machine page, Work plan, Alert accuracy; desktop 1280 px and phone 390 px).

## Criteria (spec `docs/specs/redesign-v2.md`)
1. **A first-time visitor can say what the site is, who it is for and what to do next within 10 seconds: NOT MEASURED.** Home states the product, who it is for and one button ("See the N alerts") on the first screen (`home-desktop.png`), but no person has tested it. Needs the five-second test with at least five people.
2. **Home never makes the model look better than the evidence supports: MET.** The accuracy fact reads "N of N failures caught, in a simulated test" with "Real equipment would score lower" beside it, also when the result is not loaded (Vitest `tests/home.test.tsx`). Home, Alerts and Work plan have no "live", "right now", "real-time" or "savings" (Vitest checks each).
3. **The job flow works alert to scheduled to done: MET (automated).** `e2e/workplan.spec.ts` adds an alert on Home, finds it as an Added job, schedules it, reloads, marks it done and resets. The 60-second hand-timed check is NOT DONE.
4. **Palette, accessibility checks and the disclosure strip stay in force: MET for what runs here.** Playwright 300 passed, 5 skipped, 6 failed; the 6 are `keyboard.spec.ts:242` (replay controls by keyboard), which fail only on this machine and passed in CI on #26 to #30. Axe on every page, contrast, 44 px targets, narrow-phone overflow (320, 360, 390 px) and release hygiene are inside the 300. No check was weakened. Tests that asserted old copy were updated deliberately, one decision at a time; the only edit to a notice check removed the decorative "ⓘ" text from the expected string (the sentence is unchanged; the glyph became an icon).
5. **Alerts rank by cost at risk and say so; Likely part only with a 48 h warning (decisions 85, 87, 88): MET.** Vitest `tests/alerts.test.tsx` and `e2e/workplan.spec.ts`.
6. **One job list with Recommended, Added, Scheduled, Done (decisions 89, 91): MET**, with one status more than the spec lists ("Added"; decision 91).

## Key measured values
Vitest 233 passed. pytest 414 passed, 19 deselected. Playwright 300 passed, 5 skipped, 6 failed (known). tsc and eslint clean.

## Open must-fix
None known.

## Honesty issues
- The screenshots use the synthetic test bundle (for example "101 of 107 failures"), not the real saved results.
- "Normal" is a model status, not a claim about the machine: Home, Alerts and Alerts' type tiles say "Normal means below the Act today level. It is not a guarantee."
- Cost at risk uses the example costs; every money value carries the Illustrative tag. "Cost at risk, Act today jobs" sums only the Act today jobs because machine and part exposures overlap.
- No independent review: `codex` is not installed in this environment. This is not an independent review; my own screenshot review found and fixed one cosmetic defect (a stray link on Alerts).

## Not built or different from the mock-ups
- Machine page: no fleet normal band and no "Above normal" status (decision 90: the service has no fleet sensor range); the four existing sensor charts stay instead of new sensor tiles; the next shutdown window is in "What to check first" and Parts, not in the header line.
- Work plan: on a phone the job list is long (one card per job); there is no "Export job list".
- Home "Needs action today" lists alerts by chance, not by cost (Alerts ranks by cost).

## Risks
Browser-saved job state and plan settings only (no server). The first CI run of a branch caught problems a local run missed twice (stages 4 and 5); a final CI run on this pull request is the full confirmation.

## Decisions for Meysam
1. Waive or run the independent review of redesign v2 (decision 80 waived it only for the component planner).
2. Decision 91 (the extra "Added" status; cost total for Act today jobs only) is a lead default: keep or change.
3. Run the five-second test (at least five people) and the 60-second timed check, and record the results.
4. Build, defer or drop: Machine page sensor tiles, Export job list, Home alert order by cost.

## Next
1. Owner: merge this pull request and decide the four items above.
2. Run the five-second and 60-second success checks with people.
3. Optional follow-ups: sensor tiles; Export job list; Home order by cost.
