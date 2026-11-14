## Findings

- **High:** None.
- **Medium:** The equal-cost row in [ux-spec.md](/workspace/predictiq/docs/ux-spec.md:32) still says applying one cost to all models does not change the order or shortlist. The Planner starts with different model costs, so applying an equal cost can change both. The revised visitor step correctly says the resulting order is by predicted chance, but its claim that later changes “only scale the money figures” is too broad: planned spend stays fixed, and net benefit does not scale proportionally when enabled.
- **Low:** None. [Decision 64](/workspace/predictiq/DECISIONS.md:187) now describes the always-visible field and says machines *can* move up, consistent with decision 65 and the UI.

## Round 4 items

- **Equal-cost wording — not fixed:** The visitor step is improved, but the table retains the original over-claim and the new sentence adds an imprecise one.
- **Decision 64 guide step — fixed.**

**Verdict: FAIL.** Read-only source review; no tests run.
