# Status

_Updated 2026-11-13, after the skeleton review fix round._

## Current stage
**Build stage, story 1: the project skeleton, on branch `skeleton` (PR #23). The architecture gate is approved by Meysam (Owner) (13 Nov 2026, 10:05 PM ET).** The independent skeleton review passed with known issues; its fix round is done (see below). Sections further down that describe the architecture stage are history.

## Skeleton story (branch `skeleton`)
**Done:** Next.js shell with five routes, disclosure banner, "Historical replay" badge and honest empty states (no numbers); FastAPI `/api/v1/health` and `/api/v1/metadata` only; `ml/` placeholders that exit 1; hash-checked `scripts/download_data.py` (run against the live source on 13 Nov 2026: all 5 files matched; `data/raw` is gitignored); Makefile; ruff/mypy/pytest, Vitest, Playwright smoke test plus axe accessibility checks (5 routes, desktop and mobile, plus the open menu); CI workflow with actions pinned to commit SHAs; Dependabot; Vercel layout and `ignoreCommand` (`docs/DEPLOY.md`); screenshots.
**Review fix round (done):** gitleaks permission, axe in e2e, pinned actions, modal mobile menu (dialog semantics, inert background), stale notes, Dependabot.
**Next:** confirm CI is green on GitHub; trial deploy on Vercel as a protected preview (spike, decision 41), which is the first real test of the Root Directory `frontend` + `api/index.py` + rewrite layout; independent review; then the data-and-model stage.
**Blockers:** none. The owner must create the Vercel project and hold credentials.
**Known limitations:** Vercel layout untested; CI never run on GitHub; `make` not installed on the build machine, so the Makefile was not executed; `npm audit` shows 7 moderate dev-tool issues (minimatch via typescript-eslint, fix needs a breaking upgrade), none high; no replay controls by design.
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
- Architecture gate approval (decisions 32–45).
- Hosting (decision 41): all on Vercel if the spike passes; otherwise Vercel frontend + Render free backend. Owner holds the credentials.
- Written confirmation that the demo is personal and non-commercial (Vercel Hobby terms, section 4). Without it, neither hosting option is eligible and hosting goes back to the owner.
- Where the ~10–15 MB serving bundle lives: in the repository or as a GitHub release asset (decision 42).
- Proposed split dates (decision 36): fine, or prefer a longer test period?
- Whether to run the optional held-out-machines experiment.
- Illustrative cost defaults (planner stage).

## Known limitations of the architecture
- Not measured until the spike: routing beside Next.js, cold starts, bundle bytes, CPU per request, response sizes, cache hits, the WAF rule.
- Vercel docs do not say whether function responses are cached by full query string; we assume they are, and the spike checks.
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
