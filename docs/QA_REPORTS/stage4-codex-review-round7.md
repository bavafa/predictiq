## Findings

- **High:** None.
- **Medium:** None.
- **Low:** The [input table](/workspace/predictiq/docs/ux-spec.md:32) says net benefit changes when equal failure costs are applied with risk reduction on. At an enabled **0%** reduction, the [backend formula](/workspace/predictiq/backend/app/services/planner.py:145) makes net benefit equal to negative planned spend. If the shortlist stays the same, exposure can change while net benefit does not. The table also omits possible net-benefit effects from the per-model failure-cost, crew-slot, and cut-off rows. The table is therefore not yet exact. The [Planner help](/workspace/predictiq/frontend/components/planner-screen.tsx:173) and [Fleet guide](/workspace/predictiq/frontend/components/fleet-screen.tsx:63) make no claim beyond the backend behavior.

## Round 6 items

- **Medium — planned spend after equal-cost Apply:** Fixed. The table now allows spend to change when applying equal failure costs changes a shortlist whose models have different planned costs. I verified this against `compute_plan`.
- **Low — planned-cost Apply help:** Fixed. The help now includes net benefit when risk reduction is on.

**Verdict: PASS WITH KNOWN ISSUES.** Read-only review of commits `5f4ef23` and `9da8a0e`; no files changed.
