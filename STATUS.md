# Status

_Updated 2026-11-13._

## Current stage
Gate 0 (data check) and requirements draft. Waiting on review and owner approval.

## Done
- Data check: source, file hashes, schema and license recorded in `docs/DATA_PROVENANCE.md`. Data is simulated sample data published by Microsoft.
- Requirements draft: `docs/PRD.md`.
- Epics and stories draft: `docs/stories.md`.
- Decision log started: `DECISIONS.md`. Task list: `TASKS.md`.
- 2026-11-13: review findings 2, 3, 4, 5 and 7 fixed in `docs/PRD.md` and `docs/stories.md` (stories still above the 1,000-word target); findings 1 and 6 fixed in `docs/DATA_PROVENANCE.md`; re-review pending.
- 2026-11-13: independent re-review, two rounds. All 7 original findings plus 2 new ones resolved, except story length: the stories run 1,195 words against a target of about 1,000, so this one is accepted as a known issue. Reviewer's Gate 0 recommendation: **PASS** (see `docs/QA_REPORTS/`). The requirements draft is ready for owner review.

## Next
1. Owner approves Gate 0 and the requirements.
2. Only then: user-experience design.

No design, architecture or code has started. None should start before approval.

## Blockers
- Owner approvals (below). Nothing else.

## Owner decisions pending
- **Data license:** the source repository's only license file is MIT, while its README says content is CC BY 4.0 (with links to a different repository). Nothing names the data files. Are you OK using the data and publishing derived outputs under the draft credit in the provenance document, or should we ask Microsoft first? Raw data stays out of the repo either way.
- **Requirements approval:** approve `docs/PRD.md` and `docs/stories.md`, or send changes.
- **Simulated data framing:** is simulated data acceptable for the portfolio story? The demo will say "simulated" everywhere.

## Taking over from another machine
1. `git clone https://github.com/bavafa/predictiq.git`
2. `git checkout gate0-prd-draft`
3. Read this file first, then `TASKS.md`, `DECISIONS.md`, `docs/PROJECT_BRIEF.md`, `docs/DATA_PROVENANCE.md`.
4. Raw data is not in the repo. It is fetched later by a download step with hash checks (not built yet).
5. All work is committed and pushed on this branch, with an open pull request to main. Only the owner merges.
