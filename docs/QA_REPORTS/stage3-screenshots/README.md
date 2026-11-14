# Stage 3 screenshots

Taken from the production web build against the real data service and the real model data (simulated sample data), with `node scripts/screenshots.mjs --real --stage3`. Desktop is 1440 px wide, mobile is 390 px. The Asset Details shots use machine 15 at 2 November 2015, 00:00, a machine with a recorded failure, errors and repairs in the week before.

## Fleet Overview
- `fleet-overview-desktop.png`, `fleet-overview-mobile.png`: the whole screen at the replay start, with the cards, the two charts and the ranked table including the "Latest error" column.
- `fleet-overview-state-cutoff-changed-*`: the alert cut-off moved by hand; it shows "(custom)" and the note that everything updated together.
- `fleet-overview-state-empty-*`: filters that match no machine, with Clear filters.
- `fleet-overview-state-replay-start-*`: the first hour of the replay window; Start and Step back are unavailable, with the reason.
- `fleet-overview-state-replay-end-*`: the last hour; Play and Step forward are unavailable and "End of the replay window. There is no later data." shows with Jump to start.
- `fleet-overview-state-charts-as-tables-*`: both charts switched to their table view.
- `fleet-overview-state-loading-desktop.png`: grey blocks while the fleet answer is on its way.
- `fleet-overview-state-error-desktop.png`: the fleet request failed; the message says so and offers Try again.

## Asset Details
- `asset-details-desktop.png`, `asset-details-mobile.png`: one machine in full: facts, predicted chance and status, what pushed the estimate (with the "patterns, not causes" line), four sensor charts, past estimates beside recorded failures, recent errors, repairs and recorded failures. On mobile the sensors are tabs.
- `asset-details-state-cutoff-changed-*`: the same machine with a lower shared cut-off, so the status tag changes.
- `asset-details-state-7-days-*`: the charts over 7 days instead of 24 hours.
- `asset-details-state-charts-as-tables-*`: charts switched to their table view.
- `asset-details-state-input-definition-desktop.png`: the ⓘ button on one input open, giving its plain meaning and time window.
- `asset-details-state-rotation-tab-mobile.png`: the Rotation tab chosen on mobile.
- `asset-details-state-no-machine-*`: no machine chosen: "Choose a machine to see its history and risk", with a selector and a link to Fleet Overview.
- `asset-details-state-not-found-*`: a machine number outside 1 to 100: "Machine 250 isn't in the sample data."
- `asset-details-state-loading-desktop.png`: grey blocks while the machine's answers load.
- `asset-details-state-partial-desktop.png`: the sensor history failed; only that panel shows the error and Try again, the rest of the page stays.
- `asset-details-state-panel-error-desktop.png`: the "what pushed the estimate" panel failed on its own.
- `asset-details-state-replay-start-*`: the first replay hour, with the "Only 1 hour of history" note.
- `asset-details-state-replay-end-*`: the last replay hour, with the end-of-window message.

## About & Data
- `about-data-desktop.png`, `about-data-mobile.png`: the page with the model version, build date, default cut-off and replay window read from the data service.
- `about-data-state-metadata-failed-mobile.png`: the data service's facts could not be read; those values show "—" and the rest of the page is still readable.
