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

## Next
1. Independent review of `docs/DATA_PROVENANCE.md`, `docs/PRD.md` and `docs/stories.md`.
2. Fix review findings.
3. Owner approves Gate 0 and the requirements.
4. Only then: user-experience design.

No design, architecture or code has started. None should start before approval.

## Blockers
- Owner approvals (below). Nothing else.

## Owner decisions pending
- **Data license:** the license is stated only at repository level (MIT / CC BY 4.0), not for the data files. OK to publish derived outputs with attribution? Raw data stays out of the repo either way.
- **Requirements approval:** approve `docs/PRD.md` and `docs/stories.md`, or send changes.
- **Simulated data framing:** is simulated data acceptable for the portfolio story? The demo will say "simulated" everywhere.

## Taking over from another machine
1. `git clone https://github.com/bavafa/predictiq.git`
2. `git checkout gate0-prd-draft`
3. Read this file first, then `TASKS.md`, `DECISIONS.md`, `docs/PROJECT_BRIEF.md`, `docs/DATA_PROVENANCE.md`.
4. Raw data is not in the repo. It is fetched later by a download step with hash checks (not built yet).
5. Changes in this session are uncommitted unless the owner has committed them.
