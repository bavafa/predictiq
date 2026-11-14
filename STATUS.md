# Status

_Updated 2026-11-13, after the architecture fix round._

## Current stage
Architecture (branch `architecture`). Data check, requirements, stories and user-experience design are **approved by Meysam (Owner)** (design gate: 13 Nov 2026, 9:26 PM ET). The independent review returned FAIL with 1 High, 3 Medium and 1 Low finding (`docs/QA_REPORTS/architecture-codex-review.md`). All five are fixed in the working tree (not committed). The fixes wait for the reviewer to verify them and for owner approval. Nothing is built or deployed.

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
2. `git checkout architecture`
3. Read this file first, then `TASKS.md`, `DECISIONS.md`, `docs/architecture.md`, `docs/PROJECT_BRIEF.md`, `docs/PRD.md`.
4. Raw data is not in the repo. The download step with hash checks is built in the skeleton stage.
5. Re-render wireframes: `node docs/wireframes/render.mjs`. Recheck contrast: `python3 -I docs/design/check-contrast.py`.
