# Tasks

Current stage: **Architecture.**

## Done (approved by Meysam (Owner))
- [x] Gate 0 data check, license accepted, credit line applied (13 Nov 2026, 8:41 PM ET).
- [x] Requirements and stories (13 Nov 2026, 8:41 PM ET).
- [x] User-experience design gate (13 Nov 2026, 9:26 PM ET; decisions 11–31).

## Current stage: architecture
- [x] Read approved documents and the parked architecture draft; reuse only what fits. The draft's "watch" level, same-hour records, float cut-off and Render-first hosting were dropped.
- [x] Check free-tier limits on official Vercel, Render and Hugging Face docs (13 Nov 2026).
- [x] Write `docs/architecture.md`: data flow, three modes, label, features and leakage test, splits (proposed), event measures, replay start, data service contract, layout, testing and CI, hosting comparison and recommendation, security, reproducibility.
- [x] Decisions 32–45 in `DECISIONS.md` (proposed).
- [ ] Independent review of the architecture.
- [ ] Owner approval of the architecture gate and open questions (see `STATUS.md`).

## Next stages
- [ ] Project skeleton: repository layout, download script with hash check, empty app and data service, CI on pull requests, Vercel deploy spike (measure cold start and bundle size; fall back to Render if it fails).
- [ ] Data and model, screens, planner, launch: wait for approval.
