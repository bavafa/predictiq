# Status

_Updated 2026-11-13, after the design fix round._

## Current stage
User-experience design (branch `ux-design`, stacked on `gate0-prd-draft`). Gate 0 (data check) and the requirements and stories are **approved by Meysam (Owner)** as of 13 Nov 2026, 8:41 PM ET. Pull request #20 is still open, and only the owner merges it.

## Done
- Gate 0 data check: approved. License status: the owner accepted it and the credit line is applied.
- Requirements and stories: approved.
- Independent review of Gate 0 and the requirements: a first review plus two re-check rounds (see `docs/QA_REPORTS/`).
- Independent design review: fail, 3 high and 3 medium findings (`docs/QA_REPORTS/ux-design-codex-review.md`).
- Bounded fix round done for all six findings (not committed): Fleet empty state, Planner input table and guide step 3, Model Performance comparison table, missing Planner / Asset Details / Model Performance states, native sliders and 44px mobile targets, real data-record link. Decisions 21–27.
- Design drafts (not yet approved, not committed):
  - `docs/ux-spec.md`: experience spec.
  - `docs/wireframes/`: five greyscale HTML wireframes, 37 PNG renders (desktop 1440×900 and mobile 390×844, full page, plus 27 state renders), and `render.mjs`, which also fails if anything crosses the screen edge.
  - `docs/design/components.md`, `docs/design/tokens.md`, `docs/design/tokens.json`, `docs/design/check-contrast.py`.
  - Design decisions 11–27 in `DECISIONS.md`, all "proposed".

## Next
1. Optional re-check of the fixes by the reviewer.
2. Owner approves the design gate and answers the open questions in `docs/ux-spec.md`.
3. Only then: architecture.

## Blockers
- None.

## Review result
Independent design review: first review FAIL (3 High, 3 Medium). After one fix round the re-check is PASS WITH KNOWN ISSUES: all 6 findings are resolved at design level, with three new Medium details tracked in the task list. Reports are in the QA reports folder.

## Owner decisions pending
- Design gate approval (once the review is done).
- Main model only on Fleet and Asset Details (decision 14).
- Starting replay time; illustrative cost defaults.
- The approved requirements say planner rankings change when costs, capacity or the cut-off change, but in this design crew slots change only the shortlist, the cut-off changes which machines are listed, and one shared failure cost does not reorder (only per-model costs do): is that acceptable, or should the requirement wording be updated?

## Known limitations of the design drafts
- Wireframes show layout and states, not colour. Colour is specified in the tokens only.
- The experience spec runs to about three pages, longer than the one-to-two-page target, because of the control table.
- Interactive behaviour (keyboard order, screen-reader output) is specified in words; it cannot be tested until the app exists.

## Taking over from another machine
1. `git clone https://github.com/bavafa/predictiq.git`
2. `git checkout ux-design` (stacked on `gate0-prd-draft`)
3. Read this file first, then `TASKS.md`, `DECISIONS.md`, `docs/PROJECT_BRIEF.md`, `docs/PRD.md`.
4. Raw data is not in the repo. A download step with hash checks comes later; it is not built yet.
5. Re-render wireframes: `node docs/wireframes/render.mjs` (needs local playwright-core and Chrome). Recheck contrast: `python3 -I docs/design/check-contrast.py` (exits 0 when every pair passes or is marked forbidden in `tokens.json`).
