# Stage 4 screenshots

Taken from the production web build against the real data service and the real model data (simulated sample data), with `node scripts/screenshots.mjs --real --stage4`. Desktop is 1440 px wide, mobile is 390 px. The Planner shots use an alert cut-off of 20% and the first replay hour. All money figures are illustrative assumptions.

## Maintenance Planner
- `maintenance-planner-desktop.png`, `maintenance-planner-mobile.png`: the whole screen with the starting values: assumptions on the left (on mobile above the list), the ranked list, shortlist marks and the summary.
- `maintenance-planner-state-per-model-cost-*`: a higher failure cost typed for one machine model; the "Order changed" line appears, the "Moved" column shows up / down / no change, and the shortlist changes.
- `maintenance-planner-state-effectiveness-on-*`: the risk-reduction assumption switched on; the "Expected net benefit (estimate)" column and total appear, kept apart from expected exposure.
- `maintenance-planner-state-invalid-input-*`: "-500" typed in the failure cost; the field is marked, the message gives the allowed range, and the list keeps the last valid result with a note.
- `maintenance-planner-state-empty-*`: cut-off at 100%, so no machine is over it; the page says so and offers to list machines below it.
- `maintenance-planner-state-loading-desktop.png`: grey rows and "Loading predicted chances for this hour…" while the assumptions stay usable.
- `maintenance-planner-state-error-desktop.png`, `maintenance-planner-state-error-mobile.png`: the plan request failed; the message says so with Try again, the assumptions are kept, and no list or summary is shown.

## Fleet Overview
- `fleet-overview-guide-desktop.png`, `fleet-overview-guide-mobile.png`: the top of the page with the three-step guide; step 3 is the Planner step (set a cost per machine model, watch machines move up).
