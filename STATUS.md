# Status

_Updated 2026-11-14 11:36 AM ET, Stage 3 in review on branch `core-screens`._

## Current stage
**Stage 3, core screens and data service, on branch `core-screens` (PR #30). Built and independently reviewed: passed with known issues. Waiting for the owner to review and merge.**
- **QA fix round (14 Nov 2026):** Fleet and Asset screens now show one settled set of answers (same hour, cut-off, model version), the page follows refreshed `/metadata` after a model-version retry, and Escape on the mobile menu returns focus to the Menu button.
- **Merged by Meysam (Owner):**
  - The data-and-model stage, on 14 Nov 2026 at 9:53 AM ET. He also approved the example planner costs (still illustrative units).
  - The decision to make the repository public at launch, and only then. This lets Vercel's builds download the model data. Until launch, live checks use protected previews built on the build machine.
- **Built:**
  - Fleet Overview and Asset Details on the real data service.
  - The historical replay bar.
  - The "no model data" state and loading and error states.
  - About & Data, updated.
  - A Playwright test stack using a synthetic model.
  - 38 screenshots from the real model data, all simulated.
- **Independent review:** three rounds. Round 1 found two Medium issues: numbers could briefly mismatch during changes, and a new model version didn't refresh the page facts. Round 2 found one Medium: the guide pointed to the unbuilt planner. All are fixed. What remains is a Low gap in the accessibility tests.
- **Next:** owner review and merge; then Stage 4, the maintenance planner.
- **Blockers:** none.

## Data and model, session 1 of 3 (branch `data-model`, 14 Nov 2026)
**Done:** the data checks now run and pass on the real files: 761 failure rows become 719 events, and everything matches the recorded counts. The 24-hour failure label, the past-only features (nothing from the scoring hour or later is used, proven by an automated test that scrambles the future) and the train / tuning / test split with a 24-hour gap between periods are built and tested. Twenty machines are set aside once, with a fixed seed, to test how the model does on machines it never saw. Building every feature for all 100 machines over the whole year takes about 1.5 seconds.
**Checked against the architecture:** every data fact matched (events per period 17 / 473 / 3 / 109 / 3 / 110 / 4, 107 of 110 test events with a full lookback, 142,300 test machine-hours). Nothing needed changing.
**Next:** session 2: the simple baseline and the main model, calibration and cut-off.
**Blockers:** none.
**Note:** the extra data-science libraries live in a separate optional group, so the website's server stays as small as before; CI now installs that group to run the new tests.

## Data and model, session 2 of 3 (branch `data-model`, 14 Nov 2026)
**Done:** the simple baseline (logistic regression) and the main model (XGBoost, a four-setting grid compared on validation only) are trained on the 80 seen machines. Calibration and the default cut-off were chosen on validation: baseline sigmoid and 27%, main none and 51%. The test period was evaluated once (`artifacts/piq-20261114-efc9c243/evaluation.json`, committed; `make verify` passes) for both models, on the 80 seen machines, the 20 unseen machines and all 100, with both models at every whole-percent cut-off. The replay starts at 2015-11-01 00:00 (an alert is already present). Running the whole pipeline twice from scratch gave byte-identical files. All numbers are simulated; the plain-English results are in `docs/MODEL_CARD.md`.
**Headline (simulated, test window, all 100 machines):** main model precision 0.971, recall 0.947, 107 of 107 countable events caught, 0.10 false alerts per 100 machine-days; baseline 0.734, 0.900, 107 of 107, 1.50. Unseen 20 machines, main: precision 0.975, recall 0.920, 25 of 25 events caught.
**Worth knowing:** the scores are very high because the simulated failures leave a clear mark in the sensors; the model card says not to read them as real-world performance. The data checks and the past-only leakage test from session 1 still pass.
**Next:** session 3 (the remaining artifacts for the data service: replay scores, explanations).
**Blockers:** none.

## Data and model, session 3 of 3 (branch `data-model`, 14 Nov 2026)
**Done:** the real serving bundle for `piq-20261114-efc9c243` is built (`scripts/build_bundle.py`): 10,127,369 bytes uncompressed, `bundle.zip` 8,122,585 bytes, SHA-256 `0ad2916e96323e9b95a86d306924b5d66beb3c1f3185efc510a7bcbc4b2d57d2` (same on a second build). A test proves the stored scores equal the saved model on freshly built features, and that the explanations add up to the score. `scripts/fetch_bundle.py` downloads a release asset, checks the hash in the committed manifest and unpacks it. The data service now answers all contract endpoints (`/metadata`, `/fleet`, `/fleet/trend`, `/assets/{id}`, `/telemetry`, `/explanation`, `/model/metrics`, `/model/threshold-analysis`) with the exact validation, `mv` and cache rules; with no bundle they answer 503 and `/health` says `model_available: false`. The Vercel prebuild copies the bundle into the function and refuses a synthetic one. The largest allowed request per endpoint is under 256 KB on the real bundle (largest: threshold analysis, 144,715 bytes; fleet list 9,152 bytes). Example planner costs are in config and `/metadata`, labelled illustrative, as decision 55 (proposed).
**Next for the orchestrator:** create the release with the command in `docs/DEPLOY.md` (nothing was released or deployed by me), deploy the protected preview, run `verify-fn.sh`, and record the function size and response sizes (decision 53 re-measure). Then Stage 3 (screens).
**Worth knowing:** explanations use XGBoost's own contributions (no `shap`); a Git-triggered Vercel build has no bundle (it is git-ignored) and would serve 503 until the bundle is included; numpy is the only new runtime dependency.
**Blockers:** none. Owner to confirm decision 55 (illustrative costs).

## Core screens, session 1 of 3: foundations (branch `core-screens`, 14 Nov 2026)
**Done:**
- **Data service:** checked every rule in the contract and tested it. Two gaps found and fixed: a trailing new line or a non-English digit in `at` or `cutoff` was accepted (now refused), and the replay window's first hour was taken from the replay start rather than the start of the test period (now the window starts at the first test hour; `/metadata` gains `replay_start`). New tests compare `/fleet`, `/fleet/trend` and `/assets/{id}` with the saved score arrays for sampled hours and cut-offs: a synthetic-bundle version runs in CI, and the same tests run on the real bundle with `pytest -m realbundle` (opt-in; they pass).
- **Web data layer** (`frontend/lib/`): a typed client that reads the model version from `/metadata`, adds `mv` to every other request, and on a 404 re-reads `/metadata` once and retries only if the version really changed. "Model data unavailable" (503) is its own state: "The model data isn't installed in this preview", no numbers. Network and server failures show what failed with Try again; loading shows grey blocks; a slow service shows "Waking up the data service…".
- **Shared address state:** replay hour, cut-off and filters live in the web address, are checked on read (a bad value is ignored with a short note), and replay time, cut-off and selected machine follow the reader to other pages.
- **Replay control** in the shared frame: Start, Step back, Play/Pause, Step forward, step size (1, 6, 24 h) and a native timeline slider (keys apply at once, a drag applies on release, Page Up/Down move 10 hours). It starts at the replay start from `/metadata`, says "Historical replay" and never "live", stops at both ends with a visible end state and Jump to start, keeps unavailable buttons focusable with a visible reason, announces the time every sixth step, and still steps with reduced motion. Model Performance and About & Data show the time read-only. The four screen bodies are still "not built" placeholders; the states and the replay bar already work on them.
- **End-to-end tests now run against a real stack:** uvicorn serving a synthetic test bundle plus the production Next.js build proxying to it (`npm run e2e`, also in CI, which has no real data), then a second run with no bundle for the no-model-data state. `npm run e2e:real` (or `make e2e-real`) runs the same specs against the real bundle on this machine. Accessibility checks are kept.
**Results:** pytest 165 passed (+8 opt-in, the 4 new real-bundle ones pass when run); Vitest 70 passed; Playwright 21 passed on the synthetic bundle, 7 with no bundle, 21 on the real bundle; lint, types, formatting and build pass.
**Worth knowing:**
- The About & Data page still says "skeleton only / no model trained". That text is out of date but belongs to the About page work, so I left it.
- `/metadata` `replay_window.start` is now the first test hour; the replay start is `replay_start`. On the real bundle they are the same hour (2015-11-01 00:00).
- A 404 on a data request is retried only if `/metadata` reports a different model version; retrying an unchanged version could not give a different answer.
- The e2e build bakes the local data service address into the web build, so `npm run e2e` rebuilds `.next` (a Vercel build is unaffected).
**Next:** session 2 (Fleet Overview body), session 3 (Machine Details body).
**Blockers:** none.

## Core screens, session 2 of 3: Fleet Overview (branch `core-screens`, 14 Nov 2026)
**Done:** Fleet Overview at `/` on the real endpoints (`/fleet`, `/fleet/trend`), built to the spec and wireframes:
- Four cards (machines shown, machines in Alert, highest predicted chance, scored hour), the 10-bar predicted-risk chart with the cut-off marked, the "machines in Alert over time" chart (24 h / 7 days; "Only n hours of history before this point" at the start), and the ranked table (riskiest first, 25 rows a page, sortable headers; a list with a Sort menu below 768 px). Filters for machine model, status and machine number sit in the web address; Clear filters; every machine links to Asset Details with the same replay time and cut-off.
- The shared **cut-off control** (native slider, 0–100%, "(default)/(custom)", Reset, keys apply at once, drag on release; Page Up/Down ten points) lives in the address and drives the Alert count, the tags, the chart line and the table. A note and one screen-reader announcement say "Cut-off n percent. m machines are in Alert."
- Value labels (Historical, Predicted) on every number group; "Hide guide"; every chart has a one-line summary and "View as table" (Recharts, no animation, drawing hidden from screen readers).
- States: loading (grey blocks, last answer dimmed while the next loads), error with Try again (one failed panel does not blank the rest; trend failing leaves the cards and table), empty filter result (all zeros, filters kept), no model data, replay start and end (replay bar), cut-off changed.
- **Tests:** Vitest 83 passed (14 new); Playwright synthetic 34 passed + 7 no-bundle; real bundle 35 passed (includes the opt-in `fleet-real.spec.ts`: the screen's Alert count equals `/fleet` at the default cut-off and at 20%). The synthetic specs cover: Alert count = Alert rows of the filtered table for every model/status combination, cut-off change updates count and table, replay steps change numbers and match the service at each hour, row link, empty/error/loading, axe on desktop and phone, no sideways scroll and 44 px controls on the phone. pytest 165 passed; lint, types, build pass.
- **Screenshots** from the real bundle (simulated data): `docs/QA_REPORTS/stage3-screenshots/` (desktop, mobile, cut-off changed, empty, replay start/end, charts as tables, loading, error). `scripts/screenshots.mjs` now takes `--real`, `--fleet`, `--out`.
**Worth knowing:**
- The wireframe's "Latest error" table column is not built: the `/fleet` rows do not carry it and no numbers are invented. It needs an added field in the contract (or a later decision to drop it).
- The cut-off line on the risk chart sits at the middle of the 10-point bar that contains the cut-off, and its label gives the exact value (the chart has category bars, not a continuous axis).
- Arrow-key stepping through chart points is not built; the text summary and "View as table" carry the same values.
- The cut-off control sits on Fleet Overview only for now (Planner and Model Performance will reuse the component).
**Next:** session 3 (Asset Details body).
**Blockers:** none.

## Core screens, session 3 of 3: Asset Details, About & Data, latest error (branch `core-screens`, 14 Nov 2026)
**Done:**
- **Asset Details** at `/asset-details` on `/assets/{id}`, `/telemetry` and `/explanation`. The machine comes from `?machine=` or the picker (a native list of "Machine n · model", which also does type-ahead); the replay time and cut-off carry over. It shows machine model and age, the predicted chance and status at the replay hour and cut-off, the score factors (top 8 plus "all other inputs combined", each with a plain name, a raises/lowers word, a bar and a signed push in log-odds, an ⓘ definition, and the line "These are patterns the model found in the data, not causes. They are not repair advice." always visible), four sensor charts (24 h / 7 days; markers differ by shape: ◆ recorded failure, ■ repair, ▲ error), past estimates beside recorded failures (labelled simulated, cut-off dashed), and lists of errors, repairs and recorded failures. Every list and chart stops before the replay hour, and the page filters again so a record at or after it can never show. Every chart has a text summary and "View as table"; on a phone the sensors become tabs (arrow keys move between them).
- **States:** no machine chosen, machine not found (1 to 100 message, selector, link to Fleet), loading (grey blocks), one panel failed with Try again (sensor history, machine record, explanation, each alone), no model data, replay start and end (the replay bar), and "Only n hours of history" at the start.
- **Fleet "Latest error" column:** the wireframe has it, the experience spec's text does not list table columns, but the bundle has the error records, so I added it. `/fleet` rows gain `latest_error` (newest error type and hour, strictly before `at`, from all records, or null; two errors in one hour: the one recorded last). Tested against the saved records on the synthetic bundle and, opt-in, the real one. Largest `/fleet` answer is 15,452 bytes, far under the 256 KB cap. The table shows it ("None yet" when null).
- **About & Data** rewritten to the current state: two trained models, saved scores for a held-out later period, Fleet Overview and Asset Details work, Planner and Model Performance not built yet, nothing live. Model version, build date, default cut-off and replay window are read from `/metadata`; "—" with a short note if it can't be read.
- **Replay control** covered on this screen by e2e: "Historical replay" wording, never "live", clean stop at the end (nothing later, never wraps, Play and Step forward unavailable but focusable), Jump to start, and the start state.
- **Screenshots:** the full set (Fleet Overview, Asset Details, About & Data) re-taken from the real bundle into `docs/QA_REPORTS/stage3-screenshots/`, with a plain-English `README.md`. `node scripts/screenshots.mjs --real --stage3` makes them.
**Results (real output, this machine):** frontend lint and typecheck clean; Vitest 103 passed; build passes; Playwright synthetic 45 passed (+2 opt-in skipped) and 7 with no bundle; Playwright real bundle 47 passed (includes `asset-real.spec.ts`: the screen's score, status, model and list sizes equal the API at three machine/hour/cut-off cases); pytest 154 passed (backend and ml; the 9 opt-in real-bundle tests were also run for the backend and pass).
**Worth knowing:**
- The e2e data service now starts with `--timeout-keep-alive 75`. Without it, parallel runs sometimes hung for minutes: Next's local proxy and uvicorn both used 5 seconds for idle connections. It only affects the local test stack; Vercel has no such proxy.
- The service sends 7 days of errors and repairs, so those lists say "7 days" (the wireframe says 90 days for maintenance; not available from the contract).
- "Back to fleet" returns with the replay time and cut-off but not the table filters or scroll position.
- Arrow-key stepping through chart points is not built (same as Fleet); summaries and tables carry the values.
**Next:** Stage 4 (Maintenance Planner), Stage 5 (Model Performance, launch).
**Blockers:** none.

## Skeleton story (branch `skeleton`)
**Done:** Next.js shell with five routes, disclosure banner, "Historical replay" badge and honest empty states (no numbers); FastAPI `/api/v1/health` and `/api/v1/metadata` only; `ml/` placeholders that exit 1; hash-checked `scripts/download_data.py` (run against the live source on 13 Nov 2026: all 5 files matched; `data/raw` is gitignored); Makefile; ruff/mypy/pytest, Vitest, Playwright smoke test plus axe accessibility checks (5 routes, desktop and mobile, plus the open menu); CI workflow with actions pinned to commit SHAs; Dependabot; Vercel layout and `ignoreCommand` (`docs/DEPLOY.md`); screenshots.
**Review fix round (done):** gitleaks permission, axe in e2e, pinned actions, modal mobile menu (dialog semantics, inert background), stale notes, Dependabot.
**CI:** green on GitHub for commit 554e106 (runs 43551738720 pull request and 43551731238 push: frontend, e2e, python and security all succeeded). Actions are bumped to Node 24 releases and pinned by commit SHA.
**Re-verification:** PASS WITH KNOWN ISSUES (one new Low: after a mobile menu link is chosen, focus is not moved). Fixed: focus now moves to `<main>`, with a Vitest test; lint, typecheck, test, build and e2e pass.
**Next:** owner reviews and merges the skeleton; then the data-and-model stage.
**Blockers:** none for this story. Owner to review and merge.
**Known limitations:** rate-limit counting is per address, and the build machine's traffic leaves from several addresses, so the 429 was shown with a temporarily lowered limit; `make` not installed on the build machine, so the Makefile was not executed; `npm audit` shows 7 moderate dev-tool issues (minimatch via typescript-eslint, fix needs a breaking upgrade), none high; no replay controls by design.
**How to run:** see `README.md` (`make setup`, `make dev`, `make test`).

## Done
- Gate 0 data check, requirements, stories: approved.
- User-experience design gate: approved (decisions 11–31).
- Architecture draft: `docs/architecture.md`, decisions 32–45 in `DECISIONS.md`, all "proposed".
- Independent architecture review (FAIL), then a fix round:
  - Test and replay windows now end at **2015-12-30 06:00**, because failure coverage cannot be proven past the last observed failure (2015-12-31 06:00). Test: 142,300 machine-hours; 110 events by event time; 107 with a full 24-hour lookback.
  - Vercel Python runtime status corrected from the official docs (read 2026-11-13). The design uses an ordinary Python function, not the beta Services feature. Hosting is now conditional on a deploy spike with six pass/fail criteria.
  - Cache-Control headers set per endpoint, with a model-version (`mv`) URL key. A Vercel WAF rate-limit rule replaces the per-instance limiter, and the residual risk is stated.
  - `evaluate.py --verify` added: a read-only re-check of the saved test result.
  - Untested claims ("tested", "the bundle fits") are restated as targets. The bundle format and the no-compression assumption are stated.

## Next
1. Reviewer verifies the fix round.
2. Owner approves the architecture gate and answers the questions below.
3. Project skeleton, including the Vercel deploy spike, which decides decision 41 (criteria in `TASKS.md` and `docs/architecture.md`).

## Blockers
- None.

## Owner decisions pending
- Illustrative cost defaults (planner stage).
- Optional: override where the serving bundle lives (default is a GitHub release, decision 48).

## Known limitations of the architecture
- Measured in the trial (14 Nov 2026): routing, cold starts, bundle size, response sizes, cache hits and the rate-limit rule. Not yet measured: processor time per request, which needs the real model data.
- Responses are cached separately for each query string (confirmed in the trial).
- Rate limiting is per IP and per region; traffic spread over many IPs can still use up the Hobby CPU allowance. That pauses the site, with no bill.
- Artifact sizes are estimates (uncompressed NumPy arrays plus small JSON files).

## Taking over from another machine
1. `git clone https://github.com/bavafa/predictiq.git`
2. `git checkout skeleton`
3. Read this file first, then `TASKS.md`, `DECISIONS.md`, `docs/architecture.md`, `docs/PROJECT_BRIEF.md`, `docs/PRD.md`.
4. Raw data is not in the repo. Fetch it with `python3 scripts/download_data.py` (hash-checked).
5. Re-render wireframes: `node docs/wireframes/render.mjs`. Recheck contrast: `python3 -I docs/design/check-contrast.py`.

## Stage 4, session 1 of 2: planner calculation and `POST /plan` (branch `planner`, 14 Nov 2026)
**Done:**
- **Planner service** (`backend/app/services/planner.py`, pure and deterministic): expected exposure = predicted chance × failure cost (the machine model's own cost where set); ranked by exposure, ties to the higher chance then the lower machine number; shortlist = first N (crew slots) machines at or above the cut-off only; "also list below" adds them marked and never shortlisted; planned spend = shortlisted × planned cost; net benefit only when a risk-reduction assumption is set (shortlisted exposure × reduction − planned spend, labelled an estimate); "moved" versus the order by chance alone when per-model costs differ. Arithmetic is in exact integers. Everything is labelled illustrative; no "savings" wording anywhere.
- **`POST /api/v1/plan`**: strict body (unknown fields, out-of-range values, non-integers refused with problem+json 422, a message with the allowed range, no echo; bodies over 4,096 bytes get 413), current `mv` required (other 404, missing 400, `no-store`), `Cache-Control: no-store`, stores nothing, at most 100 machines. Shape recorded as decision 63. Largest response: 22,958 bytes on the real bundle (23,205 synthetic), well under 256 KB, measured through the Vercel adapter.
- **Tests:** hand-made arithmetic cases; each row of the spec table (shared cost scales exposure but not order; per-model costs change order and shortlist; crew slots change the shortlist, not the order; the cut-off changes which machines are listed; planned cost changes spend and net benefit, not order; no reduction means no benefit figure); determinism (byte-identical responses); bounds and every refusal; answers against saved scores (synthetic in CI, same tests on the real bundle with `pytest -m realbundle`), including agreement with the Fleet scores and Alert count.
- **Web client:** typed `api.plan()` in `frontend/lib/api.ts` with the `mv` retry; `ApiError.detail` carries the service's allowed-range message. No Planner screen yet.
**Results:** ruff, ruff format, mypy clean; pytest 238 passed (16 opt-in deselected); `pytest -m realbundle` 12 passed; frontend lint, typecheck clean, Vitest 114 passed, build passes.
**Worth knowing:** two older tests that said `/plan` is absent were changed to the new contract. The Planner's starting values come from `/metadata` `planner_defaults` (per-model failure costs); the single planned cost field needs one number, which the screen must choose (the defaults hold one per model).
**Next:** session 2: the Planner screen, the Fleet guide step, e2e and screenshots.
**Blockers:** none.

## Architecture review result (13 Nov 2026)
Independent review: first pass FAIL (1 High: the test window included hours with incomplete labels). After one fix round the re-check is PASS WITH KNOWN ISSUES. The High finding and 2 of 3 Mediums are resolved. The hosting finding is partly resolved; it stays conditional on the deploy spike. Two new small documentation issues and the document's length are tracked in the task list.
- 13 Nov 2026: Vercel Python function now bundles the backend (prebuild copy to frontend/_backend, includeFiles, Next.js app/ excluded); verify-fn.sh prints VERIFY_FN_OK.
- 13 Nov 2026, 11:03 PM ET: preview of this branch deployed on Vercel (success); mobile menu now moves focus to the page after a link is used; independent review of the deploy evidence: hosting gate still open (only the non-commercial check is met).
- 14 Nov 2026, 1:15 AM ET: live checks on the protected preview: routing, cold start, caching, rate limit and non-commercial use met; size checks met for the skeleton and to be measured again with the real model; one free rate-limit rule added; hosting stays on Vercel (independent review: its findings accepted and fixed).
- 14 Nov 2026: QA fixes: `evaluate --verify` now recomputes the replay start from fresh scores (never the unhashed cache; new test covers a tampered cache); model card feature count corrected to 35. Model, results and bundle hash unchanged.
- 14 Nov 2026: Stage 3 fix round 2: Fleet guide matches what is built (Planner step returns in Stage 4); replay tests made deterministic; screenshot notes corrected.

## Stage 4, session 2 of 2: Maintenance Planner screen (branch `planner`, 14 Nov 2026)
**Done:**
- **`/maintenance-planner`** (`components/planner-screen.tsx`, `lib/planner.ts`): assumptions panel (shared failure cost; optional cost per machine model in a disclosure, four fields; planned maintenance cost; crew slots −/+/typed; alert cut-off shared; also list below the cut-off; risk-reduction assumption, off by default, native slider 0–90% in 5-point steps; Reset to defaults), all with units and "Illustrative" labels. Ranked list with predicted chance and tag, cost, expected exposure, planned cost, "Moved" marks (only when per-model costs differ), net benefit column and total only when the assumption is on (labelled estimate, kept apart from exposure), shortlist marks, links to Asset Details at the same time and cut-off. Summary with slots used, spare slots, expected exposure of the shortlist and planned spend. "How this is calculated" shows the service's plain-words formulas. No savings claim (the only "saving" is the denial "It is not a saving.").
- **Rules:** all numbers on screen come from one settled `/plan` answer (same hour, cut-off, model version and inputs; the last good answer is dimmed while the next loads, and nothing stale shows after an error). An out-of-range input is refused on the page with the allowed range, the field is marked and the list keeps the last valid result with a note. Planner inputs are not in the address (spec); replay hour and cut-off are.
- **States:** loading, error with Try again (assumptions kept, list and summary hidden), no machines at or above the cut-off (offers to list those below), invalid input, no model data. Mobile: list instead of table, 44px controls.
- **Defaults** (decision 64, Lead default): one planned cost starting at 2,500, shared failure cost 10,000, per-model fields blank, 5 crew slots, reduction off (20% when switched on).
- **Fleet guide** step 3 is the spec's Planner step again; its test updated. About & Data text no longer says the Planner is unbuilt.
- **Tests:** Vitest 136 passed (22 new: validation, per-model reorder and Moved, crew slots, cut-off, reduction, invalid keeps last result, states, formula text, no "saving(s)" wording); Playwright synthetic 59 passed (3 real-only skipped), no-bundle 7 passed, real bundle 62 passed including "screen shortlist equals POST /plan shortlist for the defaults"; axe on desktop and mobile with the disclosure open and an invalid field.
- **Screenshots:** `docs/QA_REPORTS/stage4-screenshots/` (`node scripts/screenshots.mjs --real --stage4`), including the retaken Fleet guide. The screenshot script now forwards POST bodies.
**Next:** independent review of Stage 4; then Stage 5 (Model Performance, launch).
**Blockers:** none.
**Known limitations:** inputs reset on reload (not in the address); the wireframe's "USD" is "illustrative currency units" (the service's unit); the list shows at most 100 machines in one table (no paging; the service caps it); arrow-key chart stepping not applicable here.
