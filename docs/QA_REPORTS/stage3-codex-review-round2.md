# Stage 3: independent review, round 2

Reviewer: Codex (gpt-6-sol, medium effort), read-only, 14 Nov 2026.
Scope: the whole branch. Lead response: the Medium (visitor guide) and the screenshot Low fixed; the flaky test steadied.

## Findings

- **Medium — the Fleet guide sends visitors to controls that do not exist.** [fleet-screen.tsx](/workspace/predictiq/frontend/components/fleet-screen.tsx:63) instructs visitors to set a cost per machine model in Maintenance Planner and watch machines move up the list. The [Planner page](/workspace/predictiq/frontend/app/maintenance-planner/page.tsx:7) instead says “Not built yet.” The instruction also appears in the [Fleet screenshot](/workspace/predictiq/docs/QA_REPORTS/stage3-screenshots/fleet-overview-desktop.png), while About & Data correctly says Planner is not built. This is a **must-fix** misleading user flow.

- **Low — a screenshot description overstates the state shown.** The [screenshot README](/workspace/predictiq/docs/QA_REPORTS/stage3-screenshots/README.md:19) says the Asset Details charts are switched to tables, but the [mobile screenshot](/workspace/predictiq/docs/QA_REPORTS/stage3-screenshots/asset-details-state-charts-as-tables-mobile.png) shows the sensor chart still drawn and only past estimates as a table.

- **Low — focus and accessibility coverage is improved but incomplete.** The new [focus tests](/workspace/predictiq/frontend/e2e/a11y.spec.ts:38) cover menu Escape and a chart toggle. They still do not verify the spec’s contrast pairs or all mobile target sizes. This is a coverage gap, not an observed accessibility failure.

## Criteria

| Stage 3 criterion | Result | Evidence |
|---|---|---|
| Epic | **Met** | Screens use saved scores; settled answer sets keep displayed numbers tied to their hour, cut-off and model version ([fleet-screen.tsx](/workspace/predictiq/frontend/components/fleet-screen.tsx:134), [asset-screen.tsx](/workspace/predictiq/frontend/components/asset-screen.tsx:130)). |
| Fleet overview | **Not met** | Counts derive from the filtered rows and the latest-error column is present, but its visitor guide contains the Medium finding above. |
| Machine details | **Met** | Facts, status, pattern caveat, four sensor views, simulated failures beside past estimates, and recent records before the replay hour are present. The normal, partial-error, mobile, and replay-start screenshots support these states. |
| Historical replay | **Met** | Controls and screenshots identify historical replay and show the window ends without wrapping. |
| Data service | **Met** | Latest error uses records strictly before `at` ([data.py](/workspace/predictiq/backend/app/api/data.py:112)); an independent saved-record test checks it ([test_answers_match_scores.py](/workspace/predictiq/backend/tests/test_answers_match_scores.py:119)). |

The two round-one **Medium** findings are fixed: Fleet now displays one settled set, and an `mv` refresh updates shared metadata ([data-provider.tsx](/workspace/predictiq/frontend/components/data-provider.tsx:127)). The round-one **Low** focus gap is reduced. About & Data’s model facts and limitations agree with `/metadata` and `MODEL_CARD.md` in the reviewed material.

**Tests:** Frontend typecheck passed. Targeted Vitest passed (46/46); the full suite passed on rerun (108/108) after one intermittent replay-button test failure. Backend pytest could not start because the read-only sandbox has no usable temporary directory. Browser E2E was not run.

## Verdict

**FAIL** — one Medium must-fix finding remains.
