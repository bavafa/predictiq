## Findings

- **High:** None.
- **Medium:** The revised visitor step adds an over-claim: setting every model to the same failure cost would “only scale the money figures” ([ux-spec.md](/workspace/predictiq/docs/ux-spec.md:14)). The Planner starts with *different* model costs, so applying one cost to all can also change the order and, at some hours, the shortlist. The input table repeats this issue at [line 32](/workspace/predictiq/docs/ux-spec.md:32). Decision 65 and the [Planner UI](/workspace/predictiq/frontend/components/planner-screen.tsx:176) correctly describe the resulting chance-based order.
- **Low:** Decision 64 marks the old optional panel as history, but its next paragraph still says the visitor “opens the panel” and that machines “move up” ([DECISIONS.md](/workspace/predictiq/DECISIONS.md:187)). The fields are always visible, and the [Fleet guide](/workspace/predictiq/frontend/components/fleet-screen.tsx:62) correctly says the order *can* change.

## Round 3 items

- **Visitor step and interaction table — fixed:** The guaranteed shortlist change and optional-panel wording are gone. The new equal-cost over-claim above remains.
- **Decision 64 and STATUS.md — partly fixed:** [STATUS.md](/workspace/predictiq/STATUS.md:164) now matches the UI; Decision 64 retains the panel description.

**Verdict: FAIL** — the new Medium documentation over-claim needs correction. This was a read-only source review; I did not run tests.
