# Tasks

Current stage: **Stage 3, core screens and data service (all 3 sessions done; awaiting review).**

## Done (approved by Meysam (Owner))
- [x] Gate 0 data check, license accepted, credit line applied (13 Nov 2026, 8:41 PM ET).
- [x] Requirements and stories (13 Nov 2026, 8:41 PM ET).
- [x] User-experience design gate (13 Nov 2026, 9:26 PM ET; decisions 11–31).

## Current stage: architecture
- [x] Read approved documents and the parked architecture draft; reuse only what fits. The draft's "watch" level, same-hour records, float cut-off and Render-first hosting were dropped.
- [x] Check free-tier limits on official Vercel, Render and Hugging Face docs (13 Nov 2026).
- [x] Write `docs/architecture.md`: data flow, three modes, label, features and leakage test, splits (proposed), event measures, replay start, data service contract, layout, testing and CI, hosting comparison and recommendation, security, reproducibility.
- [x] Decisions 32–45 in `DECISIONS.md` (proposed).
- [x] Independent review (`docs/QA_REPORTS/architecture-codex-review.md`): FAIL, with 1 High, 3 Medium and 1 Low finding.
- [x] Fix round (13 Nov 2026), all five findings addressed in `docs/architecture.md` and decisions 34, 36, 40–45:
  - [x] High: the test and replay windows end at 2015-12-30 06:00 (censored at the last observed failure); event counts per split recomputed.
  - [x] Medium: Vercel Python status corrected from the official docs; ordinary Python function, not Services; hosting conditional on a deploy spike with pass/fail criteria and a named fallback.
  - [x] Medium: Cache-Control headers per endpoint, `mv` model-version key; Vercel WAF rate-limit rule replaces the per-instance limiter; residual risk stated.
  - [x] Medium: `evaluate.py --write` once, `--verify` read-only re-check.
  - [x] Low: "(tested)" and "the bundle fits" removed; bundle format and compression assumption stated.
- [ ] Verification of the fix round by the independent reviewer.
- [ ] Owner approval of the architecture gate and open questions (see `STATUS.md`).

## Next stages
- [ ] Project skeleton: repository layout, download script with hash check, empty app and data service, CI on pull requests.
- [x] Vercel deploy spike (decision gate for decision 41), passed for everything the skeleton can test on 14 Nov 2026 (checks 2 and 4 measured again later), on a new Hobby project. It passes only if: (1) `/api/v1/*` reaches FastAPI and everything else reaches Next.js in one project; (2) Python function plus bundle under 500 MB uncompressed, bytes recorded; (3) cold start over 10 requests, median under 3 s, worst under 10 s; (4) largest allowed response per endpoint under 256 KB; (5) a repeated GET is a cache HIT and the WAF rule returns 429; (6) owner confirms in writing that the demo is personal and non-commercial (Hobby terms). If 1–5 fail: fall back to Vercel frontend + Render free backend. If 6 fails: hosting goes back to the owner.
- [ ] Data and model, screens, planner, launch: wait for approval.

## Stage 2: Data and model (started 14 Nov 2026, branch `data-model`)
- [x] Session 1: data checks (`ml/validate.py`), 24-hour label (`ml/labels.py`), past-only features (`ml/features/`), splits and unseen-machine set (`ml/splits.py`, `ml/unseen_machines.json`), tests including the leakage test and an opt-in real-data test, `ml` dependency group, Makefile targets, data-checks section in `docs/DATA_PROVENANCE.md`.
- [x] Session 2 (14 Nov 2026): logistic regression baseline and XGBoost main model (`ml/train.py`), calibration and default cut-off on validation, `evaluate.py --write` once and `--verify`, seen / unseen / all results, threshold analysis, model version and manifest, replay start (`ml/replay.py`), determinism check (two from-scratch runs identical), `docs/MODEL_CARD.md`.
- [x] Session 3 (14 Nov 2026): serving bundle (`scripts/build_bundle.py`, parity and explanation tests), `scripts/fetch_bundle.py`, data service endpoints with validation / `mv` / cache rules, 503 without a bundle, Vercel prebuild copy with the synthetic-bundle refusal, largest-request size test, example planner costs (decision 55, owner to confirm), synthetic test bundle for CI, `docs/DEPLOY.md`.
- [x] Orchestrator: create the `bundle-piq-20261114-efc9c243` prerelease (command in `docs/DEPLOY.md`), deploy the protected preview, measure function size and response sizes (closes the two re-measure items of decision 53).

## Known issues from the architecture re-check (tracked; the one fix round was used)
- [x] Medium (fixed 13 Nov, only the latest version is served): the cache contract conflicts with itself. URLs are "immutable per model version", yet a stale version returns 404, and browsers keep a 200 for an hour. Decide whether old versions stay servable, and define cache behaviour at release.
- [x] Low (fixed 13 Nov): the event-lookback sentence mixes populations. 3 of the 110 test events lack a full lookback; the other 4 fall after the test window.
- [ ] Low: the architecture document is about 2,580 words against a target of about two pages.

## Build stage, story 1: project skeleton (started 13 Nov 2026, 10:05 PM ET)
- [x] Scaffold: website, data service as a Vercel Python function (layout in `docs/DEPLOY.md`, untested on Vercel), machine-learning package skeleton, Makefile stubs (14 Nov 2026; `make` itself is not installed on the build machine, so the recipes were run by hand)
- [x] Lint, type checks, tests (pytest, Vitest, one Playwright smoke test) and continuous integration (green on GitHub)
- [x] App shell: navigation, disclosure banner, "Historical replay" badge, honest "not built yet" states
- [x] Hash-checked download script and no-network test; `ignoreCommand` skipping `main` builds
- [x] Screenshots in `docs/QA_REPORTS/skeleton-screenshots/`
- [x] Trial deploy on Vercel as a protected preview: checks 1, 3, 5 and 6 met; 2 and 4 met for the skeleton only (14 Nov 2026; see the live checks report).
- [x] Data-and-model stage: measure again the data service size with the real bundle (check 2) and each data endpoint's largest response (check 4).
  - [ ] Low (review): adapter test can pass without a real bundle; menu test does not cover a real route change; adapter description out of date.
- [x] Independent review (`docs/QA_REPORTS/skeleton-codex-review.md`): PASS WITH KNOWN ISSUES
- [x] Fix round (13 Nov 2026): gitleaks 403 (`pull-requests: read`); axe accessibility checks in e2e (5 routes × desktop/mobile + open menu); actions pinned to commit SHAs; mobile menu is a modal dialog with inert background; stale notes updated; `.github/dependabot.yml` added
- [x] CI green on GitHub after the fix round (commit 554e106, all 4 jobs on push and pull request)
- [x] Low (fixed 13 Nov): after choosing a mobile menu link, focus moves to the main landmark; Escape and Close still return it to Menu. Vitest test added.
- [x] Independent review of the data-and-model stage: round 1 fixed (replay check, feature count); round 2 passed with known issues; its Low (raw size record) fixed.
- [ ] Owner: confirm the example planner costs; choose how model data reaches the public launch.

## Stage 3: Core screens and data service (started 14 Nov 2026, branch `core-screens`)
- [x] Session 1 (foundations): data service contract rules verified and tested, answers-against-saved-scores tests (synthetic in CI, real bundle opt-in), typed web client with `mv` retry, no-model-data / error / loading / waking states, shared address state, historical replay control, end-to-end tests on a real stack (synthetic bundle; opt-in real bundle).
- [x] Session 2 (14 Nov 2026): Fleet Overview body (cards, charts, table, filters, cut-off control), Vitest, Playwright synthetic and opt-in real-bundle checks, screenshots in `docs/QA_REPORTS/stage3-screenshots/`.
- [x] Wireframe's "Latest error" column: added `latest_error` to `/fleet` rows (bundle has the records; tested against saved data; size cap kept) and the table column. The ux-spec text does not list table columns, so the owner may drop it.
- [x] Session 3 (14 Nov 2026): Asset Details body (sensor charts, explanation, events, machine picker and its states), About & Data text and `/metadata` facts, screenshots re-taken, e2e for Asset Details and the replay control on it.
- [ ] Low: "Back to fleet" on Asset Details keeps the replay time and cut-off but not the Fleet table filters or scroll position (components list asks for both).
- [ ] Low: recent maintenance shows 7 days (what `/assets/{id}` sends); the wireframe says 90 days. Widen the contract or change the wireframe.
- [ ] Low: arrow-key stepping through chart points (components list) is not built on either screen; summaries and "View as table" carry the values.
- [x] Independent review of Stage 3 run; fix round done (14 Nov 2026): replay/cut-off transitions show one settled set (cards, trend, table; Asset score, factors, charts, records) labelled from the response; refreshed `/metadata` after a stale model version now updates the shared page state (version, default cut-off, replay bounds); e2e for focus after the mobile menu (this found and fixed a real bug: Escape did not return focus) and the chart table toggle.
- [ ] Re-review of the fix round.
- [x] Cut-off control built (`components/cutoff-control.tsx`) and used on Fleet Overview; reuse on Planner and Model Performance in their stages.
- [x] Update the About & Data status text.
- [x] Fix round 2 (14 Nov 2026): Fleet Overview guide step 3 now describes the cut-off and says the Planner comes later; replay-bar tests made deterministic; screenshot README matches the charts-as-tables shots.
- [x] (14 Nov 2026, Stage 4 session 2) Stage 4: restore the Fleet Overview guide step "open Maintenance Planner, set a cost per machine model, watch machines move up" once the Planner is built (`components/fleet-screen.tsx`, and the guide test in `tests/fleet.test.tsx`).
- [x] Stage 3 independent review: three rounds, all Medium findings fixed; passed with known issues.
- [x] Low (review): accessibility tests don't yet check every contrast pair or mobile target size. Covered in Stage 5 session 2 (`docs/QA_REPORTS/stage5-testing.md`); human screen-reader and real-device testing remain not done.

## Stage 4: Maintenance planning (started 14 Nov 2026, branch `planner`)
- [x] Session 1 (14 Nov 2026): planner service, `POST /plan` (decision 63), arithmetic / spec-table / determinism / bounds / saved-score tests (real bundle opt-in), largest `/plan` request through the adapter, typed `api.plan()` with `mv` retry.
- [x] Session 2 (14 Nov 2026): Planner screen (assumptions panel, ranked list, summary, "How this is calculated", states), Fleet guide step restored, Vitest, Playwright synthetic + opt-in real, screenshots in `docs/QA_REPORTS/stage4-screenshots/`.
- [x] Fix round (14 Nov 2026): planned cost per machine model in `/plan` and the screen (decision 55), per-model failure costs prefilled (decision 64 rewritten), `/plan` body limit enforced while streaming; tests and screenshots updated.
- [ ] Owner: the screen has one planned cost, starting at 2,500 (decision 64; decision 55 lists one per model), and a shared failure cost starting at 10,000; confirm or override.
- [x] (14 Nov 2026) Stage 4 fix round 2: shared costs apply to all models (decision 65), guide/About/screenshot wording corrected.
- [x] Stage 4 independent review, rounds 1 to 7 (`docs/QA_REPORTS/stage4-codex-review-round2.md` to `round7.md`; round 1 in the PR log): final PASS WITH KNOWN ISSUES.
- [x] Live planner size check on a protected box-built preview: 25,466 bytes (`docs/QA_REPORTS/stage4-live-checks.md`).
- [x] Owner: Stage 4 gate approved, PR #31 merged (3:26 PM ET, 14 Nov 2026).
- [x] Dependency updates #24 to #28 tested together on branch `deps-nov14`: four included, TypeScript 7 left out (`docs/QA_REPORTS/deps-nov14-checks.md`).
- [ ] Owner: merge the dependency branch; close Dependabot #25 to #28 (superseded); decide on #24 (TypeScript 7).

## Stage 5: Launch (started 14 Nov 2026, branch `model-perf`, stacked on `deps-nov14`)
- [x] Session 1 (14 Nov 2026): Model Performance page built per the experience spec (header facts, shared cut-off control, one "Main model vs simple baseline" table read from the saved cut-off table, four charts with table views, "why accuracy misleads", limitations, loading / error / not-available / no-model states), NotBuilt placeholder removed, About & Data text updated, Vitest, Playwright synthetic + opt-in real, screenshots in `docs/QA_REPORTS/stage5-screenshots/` (`node scripts/screenshots.mjs --real --stage5`). Decision 68 records where the saved files differ from the spec's wording.
- [ ] Owner: confirm or override decision 68 (evaluation date taken from the model build date; alerts per day and accuracy figures derived from saved counts).
- [x] Session 2 and fix 2b (14 Nov 2026): full testing (contrast pairs, target sizes, keyboard, axe on all pages, notice, release hygiene, fresh-copy script); review round 1 fixes (build-date label, synthetic counts, "simulated" notice, decision 70). Report in `docs/QA_REPORTS/stage5-testing.md`.
- [x] Fix 2c (14 Nov 2026), review round 2: rendered text and non-text contrast tests on all five pages (`contrast.spec.ts`), axe `color-contrast` proven enabled, exact 2px focus rule in keyboard and contrast specs, source colour scan widened (3-digit hex, rgb/hsl, Tailwind names, opacity, arbitrary), fresh-copy script skip wording and `REQUIRE_REAL=1`, hygiene xfail reason. Fixed: legend text 3.74:1, skip-link border, badge ring token.
- [ ] Owner: decide what to do about commit 874a686 (personal author email; no rewrite done); to be recorded in `docs/LAUNCH_CHECKLIST.md` (session 3).
- [ ] Session 3: launch preparation (limitations, README, model card, launch checklist, plan for getting the bundle to production), protected preview, review.
