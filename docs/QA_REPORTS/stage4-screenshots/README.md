# Stage 4 screenshots

Taken from the production web build against the real data service and the real model data (simulated sample data), with `node scripts/screenshots.mjs --real --stage4`. Desktop is 1440 px wide, mobile is 390 px. The Planner shots use an alert cut-off of 20% and the first replay hour. All money figures are illustrative assumptions.

## Maintenance Planner
- `maintenance-planner-desktop.png`, `maintenance-planner-mobile.png`: the whole screen with the starting values: assumptions on the left (on mobile above the list) with the four per-model failure costs and four per-model planned costs visible, each with its "Set every machine model to" field and "Apply to all models" button; the ranked list, shortlist marks and the summary.
- `maintenance-planner-state-per-model-cost-*`: a higher failure cost typed for one machine model; the "Order changed" line appears and the "Moved" column shows up / down / no change. At this replay hour the same machines keep their slots, so the order changes but the shortlist does not; a raised cost can change who is shortlisted only at some hours.
- `maintenance-planner-state-effectiveness-on-*`: the risk-reduction assumption switched on; the "Expected net benefit (estimate)" column and total appear, kept apart from expected exposure.
- `maintenance-planner-state-invalid-input-*`: "-500" typed in the shared "Set every machine model's failure cost to" field; the field is marked, the message gives the allowed range, and the list keeps the last valid result with a note.
- `maintenance-planner-state-empty-*`: cut-off at 100%, so no machine is over it; the page says so and offers to list machines below it.
- `maintenance-planner-state-loading-desktop.png`: grey rows and "Loading predicted chances for this hour…" while the assumptions stay usable.
- `maintenance-planner-state-error-desktop.png`, `maintenance-planner-state-error-mobile.png`: the plan request failed; the message says so with Try again, the assumptions are kept, and no list or summary is shown.

## Fleet Overview
- `fleet-overview-guide-desktop.png`, `fleet-overview-guide-mobile.png`: the top of the page with the three-step guide; step 3 is the Planner step (raise one machine model's failure cost; that can change the order and, at some hours, who is shortlisted).
