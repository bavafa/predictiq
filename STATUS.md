# Status

_Updated 2026-11-13, after the architecture draft._

## Current stage
Architecture (branch `architecture`). Data check, requirements, stories and user-experience design are **approved by Meysam (Owner)** (design gate: 13 Nov 2026, 9:26 PM ET). The architecture draft is written and waits for independent review and owner approval. Nothing is built or deployed.

## Done
- Gate 0 data check, requirements, stories: approved.
- User-experience design gate: approved (decisions 11–31).
- Architecture draft (not committed): `docs/architecture.md`, with decisions 32–45 in `DECISIONS.md`, all "proposed". It covers data flow, three modes (no live inference), the 24-hour label and as-of rule, feature rules and leakage test, proposed split dates, event-level measures, replay start, data service contract, repository layout, testing and CI, hosting at C$0, security and reproducibility.
- Hosting limits were checked against the official Vercel, Render and Hugging Face docs on 13 Nov 2026 (sources listed in `docs/architecture.md`).

## Next
1. Independent review of the architecture.
2. Owner approves the architecture gate and answers the questions below.
3. Then: project skeleton, including a Vercel deploy spike (Python function beside Next.js; bundle size; cold start) before the hosting choice is final.

## Blockers
- None.

## Owner decisions pending
- Architecture gate approval (decisions 32–45).
- Hosting (decision 41): all on Vercel recommended; fallback Vercel + Render free. Owner holds the credentials.
- Where the ~10–15 MB serving bundle lives: in the repository or as a GitHub release asset (decision 42).
- Proposed split dates (decision 36): fine, or prefer a longer test period?
- Whether to run the optional held-out-machines experiment.
- Illustrative cost defaults (planner stage).

## Known limitations of the architecture draft
- Not measured: cold starts, bundle size with dependencies, memory and CPU per request, cache hit rate, Python-function wiring beside Next.js, Hobby rate-limit rules.
- Artifact sizes are estimates.
- Vercel Hobby terms for portfolio use were not found on the pages read.
- The end of failure-record coverage (assumed 2016-01-01 06:00) is confirmed only when validation runs.

## Taking over from another machine
1. `git clone https://github.com/bavafa/predictiq.git`
2. `git checkout architecture`
3. Read this file first, then `TASKS.md`, `DECISIONS.md`, `docs/architecture.md`, `docs/PROJECT_BRIEF.md`, `docs/PRD.md`.
4. Raw data is not in the repo. The download step with hash checks is built in the skeleton stage.
5. Re-render wireframes: `node docs/wireframes/render.mjs`. Recheck contrast: `python3 -I docs/design/check-contrast.py`.
