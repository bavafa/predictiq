## Findings

- **High:** None.
- **Medium:** The equal-cost row still says planned spend does not change when Apply is pressed. It can: with one crew slot, model1 at 60% × 10,000 outranks model2 at 70% × 8,000; applying 10,000 to both shortlists model2 instead. Using the decision 55 planned costs, spend changes from 2,500 to 2,000. This matches the [planner logic](/workspace/predictiq/backend/app/services/planner.py:119) but contradicts the [table](/workspace/predictiq/docs/ux-spec.md:32).
- **Low:** The planned-cost Apply help says “Changes planned spend only,” while enabling risk reduction makes planned cost change net benefit too. The [table](/workspace/predictiq/docs/ux-spec.md:34) and [decision 65](/workspace/predictiq/DECISIONS.md:191) allow that effect; the [UI help](/workspace/predictiq/frontend/components/planner-screen.tsx:237) should say so.

## Round 5 items

The overclaims identified in round 5 are fixed: applying equal failure costs **can** change order and shortlist from the differing defaults, and changing one equal cost to another preserves the chance-based order and shortlist. The [visitor step](/workspace/predictiq/docs/ux-spec.md:14) is accurate. The table is still not exact because of planned spend.

**Verdict: FAIL.** Read-only review against `a616d82`; no files changed.
