# Tasks

Current stage: **Build, story 1: project skeleton.**

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
- [ ] Session 3: remaining serving artifacts (per-hour replay scores bundle, explanations), anything the data service needs.

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
- [ ] Data-and-model stage: measure again the data service size with the real bundle (check 2) and each data endpoint's largest response (check 4).
  - [ ] Low (review): adapter test can pass without a real bundle; menu test does not cover a real route change; adapter description out of date.
- [x] Independent review (`docs/QA_REPORTS/skeleton-codex-review.md`): PASS WITH KNOWN ISSUES
- [x] Fix round (13 Nov 2026): gitleaks 403 (`pull-requests: read`); axe accessibility checks in e2e (5 routes × desktop/mobile + open menu); actions pinned to commit SHAs; mobile menu is a modal dialog with inert background; stale notes updated; `.github/dependabot.yml` added
- [x] CI green on GitHub after the fix round (commit 554e106, all 4 jobs on push and pull request)
- [x] Low (fixed 13 Nov): after choosing a mobile menu link, focus moves to the main landmark; Escape and Close still return it to Menu. Vitest test added.
