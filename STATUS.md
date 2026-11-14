# Status

_Updated 2026-11-14, 9:25 AM ET, data-and-model stage ready for owner review._

## Current stage
**Data-and-model stage built and reviewed, on branch `data-model`; waiting for the owner to review and merge.** The project skeleton was merged by Meysam (Owner) on 14 Nov 2026 at 8:08 AM ET.
- **Done:** data checks, the 24-hour label, past-only features, the baseline and main models, the alert cut-off and event measures, the twenty-machine unseen test, and the serving bundle for the latest model only. The bundle is kept on a GitHub pre-release, not in git.
- **Data service:** answers every data question from the bundle.
- **Size checks** re-measured live on a protected preview, both met:
  - the data service is about 30 MB as Vercel reports it (75 MB uncompressed in the local build);
  - the largest answer is 144,715 bytes.
- **Independent review:** round 1 found one Medium and one Low, both fixed. Round 2 passed with known issues; its one Low (a missing raw record) is fixed.
- **Next:** the owner reviews; then Stage 3, the core screens.
- **Blockers:** none. The owner has two decisions to make: the example planner costs, and how model data reaches the public launch.

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

## Architecture review result (13 Nov 2026)
Independent review: first pass FAIL (1 High: the test window included hours with incomplete labels). After one fix round the re-check is PASS WITH KNOWN ISSUES. The High finding and 2 of 3 Mediums are resolved. The hosting finding is partly resolved; it stays conditional on the deploy spike. Two new small documentation issues and the document's length are tracked in the task list.
- 13 Nov 2026: Vercel Python function now bundles the backend (prebuild copy to frontend/_backend, includeFiles, Next.js app/ excluded); verify-fn.sh prints VERIFY_FN_OK.
- 13 Nov 2026, 11:03 PM ET: preview of this branch deployed on Vercel (success); mobile menu now moves focus to the page after a link is used; independent review of the deploy evidence: hosting gate still open (only the non-commercial check is met).
- 14 Nov 2026, 1:15 AM ET: live checks on the protected preview: routing, cold start, caching, rate limit and non-commercial use met; size checks met for the skeleton and to be measured again with the real model; one free rate-limit rule added; hosting stays on Vercel (independent review: its findings accepted and fixed).
- 14 Nov 2026: QA fixes: `evaluate --verify` now recomputes the replay start from fresh scores (never the unhashed cache; new test covers a tampered cache); model card feature count corrected to 35. Model, results and bundle hash unchanged.
