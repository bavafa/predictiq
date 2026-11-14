# Codex targeted re-verification of the design stage, round 1

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Saved verbatim._

## Design-stage re-verification

| Earlier finding | Status | Evidence |
|---|---|---|
| 1. Fleet empty state | **RESOLVED** | The [desktop](/workspace/predictiq/docs/wireframes/fleet-overview-state-empty-desktop.png) and [mobile](/workspace/predictiq/docs/wireframes/fleet-overview-state-empty-mobile.png) renders show 0 machines shown, 0 in Alert, no highest chance, and empty charts explicitly tied to the filtered population. |
| 2. Planner ranking promise | **PARTIALLY RESOLVED** | The [spec’s input table](/workspace/predictiq/docs/ux-spec.md:28), [Planner render](/workspace/predictiq/docs/wireframes/maintenance-planner-state-per-model-cost-desktop.png), and visitor guide now distinguish order, exposure, shortlist, and spend. **That resolves the design part.** The approved [PRD](/workspace/predictiq/docs/PRD.md:31) still says capacity and cut-off change rankings; [STATUS.md](/workspace/predictiq/STATUS.md:32) records the discrepancy for the owner. Recording it is acceptable for this design re-check, but the requirement needs an owner decision before implementation. |
| 3. Model comparison | **RESOLVED** | [Desktop](/workspace/predictiq/docs/wireframes/model-performance-desktop.png) and [mobile](/workspace/predictiq/docs/wireframes/model-performance-mobile.png) place both models beside each requested measure, with the test period and shared cut-off above the table. Cut-off-independent measures are identified. |
| 4. Missing drawn states | **RESOLVED** | The [render inventory](/workspace/predictiq/docs/wireframes/render.mjs:31) now includes Planner loading/error, Asset panel error/not-found, and Model Performance loading/error. The inspected [Asset panel error](/workspace/predictiq/docs/wireframes/asset-details-state-panel-error-desktop.png) retains the other panels; [Planner error](/workspace/predictiq/docs/wireframes/maintenance-planner-state-error-desktop.png) retains assumptions and hides results. |
| 5. Mobile targets and sliders | **RESOLVED at design stage** | Mobile CSS specifies 44px targets; the wireframes use native range inputs, and the [spec](/workspace/predictiq/docs/ux-spec.md:105) defines values and keyboard steps. Runtime behavior remains untestable at this stage. |
| 6. Provenance link | **RESOLVED** | “Full data record” has a repository destination in [About & Data](/workspace/predictiq/docs/wireframes/about-data.html:183), and [DATA_PROVENANCE.md](/workspace/predictiq/docs/DATA_PROVENANCE.md) exists. |

## New findings

- **Medium — Planner example has impossible movement marks.** In the [per-model-cost render](/workspace/predictiq/docs/wireframes/maintenance-planner-state-per-model-cost-desktop.png), rows 2 and 4 both imply an original rank of 1 (“down 1” to rank 2; “down 3” to rank 4). The “Moved” examples cannot come from one prior ordering. Use a consistent example before treating the guide as a demonstrated reorder.
- **Medium — Event-level false-alert rule was dropped from the new comparison design.** The [PRD](/workspace/predictiq/docs/PRD.md:28) counts consecutive alert hours as one alert, but the new [table and spec](/workspace/predictiq/docs/ux-spec.md:42) do not state that rule for “false alerts per 100 machine-days.” Restate it to prevent an hourly count being used for the event measure.
- **Medium — One optional cost field loses its label in the wireframe.** In [maintenance-planner.html](/workspace/predictiq/docs/wireframes/maintenance-planner.html:183), the `model3` label targets the input hidden in the default state; the visible alternate input has no `id`. Give the visible control the label association in both states.

I found no new architecture choice or scope expansion in the reviewed changes. The new controls have stated purposes; the inconsistent movement example is the misleading label identified above. Illustrative values and absent model results remain visibly marked.

**Commands and outcomes:** `git diff HEAD~3 HEAD -- docs/ux-spec.md docs/design docs/wireframes/*.html docs/wireframes/render.mjs DECISIONS.md STATUS.md` reviewed; `git diff --check HEAD~3 HEAD` passed; `python3 -I docs/design/check-contrast.py` passed with **0 unexpected results**; `git status --short` was clean. I inspected the changed PNG renders directly. No files were edited.

**Design-stage gate recommendation: PASS WITH KNOWN ISSUES.** Resolve the three new design details and obtain the recorded owner decision on PRD planner wording before implementation.