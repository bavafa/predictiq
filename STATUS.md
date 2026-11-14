# Status

_Updated 2026-11-13, after the skeleton review fix round._

## Current stage
**Build stage, story 1: the project skeleton, on branch `skeleton` (PR #23). The architecture gate is approved by Meysam (Owner) (13 Nov 2026, 10:05 PM ET).** The independent skeleton review passed with known issues; its fix round is done (see below). Sections further down that describe the architecture stage are history.

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
