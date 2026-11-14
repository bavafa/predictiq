# PredictIQ: Epics and user stories

PredictIQ is a web demo that estimates which machines may fail in the next 24 hours and helps rank maintenance work. It uses *simulated* sample data published by Microsoft, not real machines; all money figures are *illustrative*. Five stages, one epic each. Each stage waits for the owner's approval of the one before. Story headings name the user.

## Epic M0: Foundation
**Problem:** building before the data, scope and design are settled causes rework.

**What we'll build:** an approved data check, brief, requirements, design and architecture, then a project skeleton.

**Acceptance criteria:**
- The owner has approved each document in order.
- The empty project starts and its test command runs.

### Data check (owner)
**Problem:** a model is only as honest as its data source.

**What we'll build:** a record of where the data comes from, file fingerprints, layout and license.

**Acceptance criteria:**
- The data is described as simulated everywhere.
- Raw files stay out of the project; a download fails if any file differs.
- The owner confirms the license reading.

### Brief and requirements sign-off (owner)
**Problem:** unclear scope invites feature creep and inflated claims.

**What we'll build:** a one-page requirements document and this story list.

**Acceptance criteria:**
- Goals, non-goals and success checks are written in plain English.
- An independent reviewer has checked them; the owner approves.

### User-experience design (visitor)
**Problem:** screens built without a plan end up cluttered or misleading.

**What we'll build:** rough screen layouts, a component list, colors and type, key states.

**Acceptance criteria:**
- Each screen shows where historical, predicted and illustrative values appear.
- Loading, empty and error states are drawn.

### Architecture (builder)
**Problem:** unclear boundaries make the model and screens drift apart.

**What we'll build:** a short design note: parts, data flow, hosting, and recorded decisions.

**Acceptance criteria:**
- Training and live scoring share one feature process.
- Hosting limits are checked before choosing.

### Project skeleton (builder)
**Problem:** tool problems found late waste time.

**What we'll build:** an empty app, an empty data service, test and check commands.

**Acceptance criteria:**
- Both parts start on a fresh copy.
- Tests and code checks run, even if empty.

## Epic M1: Data and model
**Problem:** risk scores mean nothing if the data is broken or the model saw the future.

**What we'll build:** data checks, past-only features, two models, a repeatable evaluation.

**Acceptance criteria:**
- Training and evaluation rerun from scratch give the same results.
- No known future-information leak remains.

### Data checks (builder)
**Problem:** silent data errors corrupt every later result.

**What we'll build:** checks for machine numbers, hourly gaps, duplicates, missing values and ranges.

**Acceptance criteria:**
- Any broken check stops the run with a clear message.
- Failures logged for several parts at the same hour count as one event.

### Past-only features (reviewer)
**Problem:** using later records, such as repairs logged at failure time, makes a model look better than it is.

**What we'll build:** recent sensor averages and trends, past error counts, time since last service.

**Acceptance criteria:**
- An automated test proves no feature uses data after its timestamp.
- The training and test periods have a gap between them.

### Baseline and main model (hiring manager)
**Problem:** a score with no comparison says little.

**What we'll build:** a simple baseline model and a stronger main model, trained on earlier months.

**Acceptance criteria:**
- Both are scored once on later months they never saw (*simulated*).
- Results are shown side by side, whatever they are.

### Alert cut-off and replay scores (maintenance manager)
**Problem:** a raw score is not an alert.

**What we'll build:** a default alert cut-off from a separate check period, and saved scores for every machine-hour.

**Acceptance criteria:**
- The cut-off is chosen without touching the test period.
- Scores show whether they can be trusted as chances (calibration).

## Epic M2: Core screens and data service
**Problem:** model output is useless if a manager cannot see it.

**What we'll build:** fleet overview and machine details, fed by a data service.

**Acceptance criteria:**
- Screens use real saved model scores, not placeholders.
- Every number matches the selected replay time and alert cut-off.

### Fleet overview (maintenance manager)
**Problem:** a manager needs to see the riskiest machines first.

**What we'll build:** a ranked machine table, high-risk count, risk spread, filters.

**Acceptance criteria:**
- The high-risk count matches the filtered table.
- Changing the alert cut-off updates both.

### Machine details (reliability engineer)
**Problem:** a score with no evidence is hard to trust.

**What we'll build:** sensor history, recent errors and repairs, and the factors behind the score.

**Acceptance criteria:**
- Factors are labeled as patterns, not causes.
- Past scores are shown next to the failures that actually happened (*simulated*).

### Historical replay (visitor)
**Problem:** old data passed off as live is misleading.

**What we'll build:** a time picker with play, pause and step.

**Acceptance criteria:**
- The screen says "historical replay", never "live".
- Playback stops cleanly at the start and end of the data.

### Data service (builder)
**Problem:** the browser cannot load a year of hourly data at once.

**What we'll build:** a read-only service that answers fleet, machine and history questions.

**Acceptance criteria:**
- Bad dates or machine numbers return a clear error.
- Each answer is tested against the saved scores.

## Epic M3: Maintenance planning
**Problem:** a risk list does not say what to fix first when crews are limited.

**What we'll build:** a planner that ranks machines by expected cost of failure.

**Acceptance criteria:**
- Rankings change predictably with user inputs.
- No screen claims savings.

### Cost and capacity inputs (maintenance manager)
**Problem:** every site's costs differ, and we have no real ones.

**What we'll build:** inputs for downtime cost, planned repair cost and available crew slots.

**Acceptance criteria:**
- Every input shows its unit and an "illustrative" label.
- Out-of-range values are refused with a message.

### Ranked repair list (maintenance manager)
**Problem:** a manager needs a short list that fits the crew they have.

**What we'll build:** a list ranked by chance of failure times assumed cost, cut to capacity.

**Acceptance criteria:**
- The same inputs always give the same list.
- The formula is shown on screen in plain words.

### Exposure, not savings (hiring manager)
**Problem:** expected cost is easy to misread as money saved.

**What we'll build:** clear labels and an assumptions panel.

**Acceptance criteria:**
- The screen separates expected exposure from realized benefit.
- Any benefit figure requires a stated, user-set guess of how much a repair lowers risk.

## Epic M4: Launch
**Problem:** a demo nobody can open, or that overclaims, has little value.

**What we'll build:** the model page, full tests, a public release, honest docs.

**Acceptance criteria:**
- A public link opens the app without login.
- The independent reviewer's serious findings are fixed or accepted by the owner.

### Model performance page (hiring manager)
**Problem:** reviewers need to judge the model, not take it on trust.

**What we'll build:** baseline and main model results, a right/wrong table, an alert cut-off slider.

**Acceptance criteria:**
- Every number comes from the saved evaluation, with model version and date.
- The page explains why plain accuracy misleads when failures are rare.

### Full testing (builder)
**Problem:** working parts can fail together.

**What we'll build:** end-to-end, accessibility and release smoke tests.

**Acceptance criteria:**
- All tests pass on a fresh copy.
- Keyboard use and color contrast pass review.

### Public release and limitations (owner)
**Problem:** visitors must know exactly what the demo is and is not.

**What we'll build:** a front-page guide, a data credit, a limitations section and a portfolio summary.

**Acceptance criteria:**
- Every page carries the simulated-data and illustrative-costs notice.
- No secrets, personal information or private notes remain.
