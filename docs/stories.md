# PredictIQ: Epics and user stories

A web demo estimating which machines may fail in the next 24 hours and ranking maintenance work. It uses *simulated* Microsoft sample data, not real machines; money figures are *illustrative*. Five stages, one epic each; each waits for owner approval of the one before.

## Epic: Stage 1, Foundation
**Problem:** building before scope is settled causes rework.
**What we'll build:** approved documents, then a project skeleton.
**Acceptance criteria:**
- The owner approves each document in order.
- The empty project starts and tests run.

### Data check (owner)
**Problem:** a model is only as honest as its data.
**What we'll build:** a record of source, file fingerprints, license.
**Acceptance criteria:**
- The data is called simulated everywhere.
- Raw files stay out of the project; a download fails if any file differs.
- The owner confirms the license reading.

### Requirements sign-off (owner)
**Problem:** unclear scope invites inflated claims.
**What we'll build:** a one-page requirements document and this list.
**Acceptance criteria:**
- Goals, non-goals and success checks use plain English.
- A reviewer checks them; the owner approves.

### User-experience design (visitor)
**Problem:** unplanned screens mislead.
**What we'll build:** rough layouts, colors, key states.
**Acceptance criteria:**
- Screens mark historical, predicted and illustrative values.
- Loading, empty and error states are drawn.

### Architecture (builder)
**Problem:** unclear boundaries make parts drift apart.
**What we'll build:** a short note on parts, data flow, hosting.
**Acceptance criteria:**
- Training and replay scoring share one feature process.
- Hosting limits are checked first.

### Project skeleton (builder)
**Problem:** tool problems found late waste time.
**What we'll build:** an empty app and data service.
**Acceptance criteria:**
- Both start on a fresh copy.
- Tests and code checks run, even if empty.

## Epic: Stage 2, Data and model
**Problem:** scores mean nothing if data is broken or the model saw the future.
**What we'll build:** data checks, past-only features, two models, repeatable evaluation.
**Acceptance criteria:**
- Rerunning from scratch gives the same results.
- No known future-information leak remains.

### Data checks and the 24-hour label (builder)
**Problem:** silent data errors and a vague label corrupt results.
**What we'll build:** data checks and a precisely written label.
**Acceptance criteria:**
- The label is a failure strictly after the scoring hour and at or before 24 hours later, with tested edge cases.
- Several parts failing in one hour count as one event.
- A written rule covers hours right after a failure.

### Past-only features (reviewer)
**Problem:** later records, like repairs logged at failure time, flatter a model.
**What we'll build:** recent sensor trends, past errors, time since service.
**Acceptance criteria:**
- Every record type has an "as of" rule; records logged at the scoring hour count as not yet known (simulated data).
- An automated test proves no feature uses later data.
- A stated gap separates training, tuning and test periods.

### Baseline and main model (hiring manager)
**Problem:** a score with no comparison says little.
**What we'll build:** a simple baseline and a stronger model.
**Acceptance criteria:**
- A reproducible comparison on held-out later data (*simulated*), published whatever the result.
- No claim about unseen machines without a separate held-out-machines test.

### Alert cut-off and event measures (maintenance manager)
**Problem:** a score is not an alert; hourly counts overstate repeats.
**What we'll build:** a default cut-off and event-level measures.
**Acceptance criteria:**
- Cut-off and calibration (do scores work as chances?) are chosen without touching the test period, used once.
- Share of failure events caught and false alerts per 100 machine-days are reported (*simulated*).
- A run of consecutive alert hours counts as one alert.

## Epic: Stage 3, Core screens and data service
**Problem:** model output is useless if nobody sees it.
**What we'll build:** fleet overview and machine details, fed by a data service.
**Acceptance criteria:**
- Screens use saved model scores, not placeholders.
- Numbers match the chosen replay time and cut-off.

### Fleet overview (maintenance manager)
**Problem:** a manager needs the riskiest machines first.
**What we'll build:** a ranked table, high-risk count, filters.
**Acceptance criteria:**
- The count matches the filtered table.
- Changing the cut-off updates both.

### Machine details (reliability engineer)
**Problem:** a score without evidence is hard to trust.
**What we'll build:** sensor history, recent events, score factors.
**Acceptance criteria:**
- Factors are labeled patterns, not causes.
- Past scores sit beside actual failures (*simulated*).

### Historical replay (visitor)
**Problem:** old data passed off as live misleads.
**What we'll build:** a time picker with play, pause, step.
**Acceptance criteria:**
- The screen says "historical replay", never "live".
- Playback stops cleanly at the data's ends.

### Data service (builder)
**Problem:** a browser cannot load a year of hourly data.
**What we'll build:** a read-only service for fleet, machine and history questions.
**Acceptance criteria:**
- Bad dates or machine numbers return a clear error.
- Answers are tested against saved scores.

## Epic: Stage 4, Maintenance planning
**Problem:** a risk list does not say what to fix first.
**What we'll build:** a planner ranking machines by expected failure cost.
**Acceptance criteria:**
- Rankings change predictably with inputs.
- No screen claims savings.

### Cost and capacity inputs (maintenance manager)
**Problem:** sites differ, and we have no real costs.
**What we'll build:** inputs for downtime cost, repair cost, crew slots.
**Acceptance criteria:**
- Inputs show units and an "illustrative" label.
- Out-of-range values are refused with a message.

### Ranked repair list (maintenance manager)
**Problem:** a manager needs a short list that fits the crew.
**What we'll build:** a list ranked by failure chance times assumed cost.
**Acceptance criteria:**
- The same inputs always give the same list.
- The formula is shown in plain words.

### Exposure, not savings (hiring manager)
**Problem:** expected cost is easily misread as money saved.
**What we'll build:** clear labels and an assumptions panel.
**Acceptance criteria:**
- Expected exposure is kept apart from realized benefit.
- Any benefit figure needs a user-set guess of how much repair lowers risk.

## Epic: Stage 5, Launch
**Problem:** a demo nobody can open, or that overclaims, has little value.
**What we'll build:** the model page, full tests, a public release.
**Acceptance criteria:**
- A public link opens the app without login.
- The reviewer's serious findings are fixed or accepted by the owner.

### Model performance page (hiring manager)
**Problem:** reviewers must judge the model, not trust it.
**What we'll build:** baseline and main results, a right/wrong table, a cut-off slider.
**Acceptance criteria:**
- Every number comes from the saved evaluation, with model version and date.
- The page explains why plain accuracy misleads when failures are rare.

### Full testing (builder)
**Problem:** working parts can fail together.
**What we'll build:** end-to-end, accessibility and release tests.
**Acceptance criteria:**
- All tests pass on a fresh copy.
- Keyboard use and color contrast pass review.

### Public release and limitations (owner)
**Problem:** visitors must know what the demo is and is not.
**What we'll build:** a front-page guide, data credit, limitations section.
**Acceptance criteria:**
- Every page carries the simulated-data and illustrative-costs notice.
- No secrets, personal information or private notes remain.
