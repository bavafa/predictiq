## Findings

- **Medium — The shared cost inputs have no effect at the starting values.** [planner.ts](/workspace/predictiq/frontend/lib/planner.ts:34) fills all four per-model failure and planned costs. The service uses a shared cost only when a model has no override ([planner.py](/workspace/predictiq/backend/app/services/planner.py:96)). Changing either prominent shared input therefore leaves the displayed result unchanged until a visitor clears a per-model field. This deviates from the exact input-effects table in `docs/ux-spec.md`. [Decision 64](/workspace/predictiq/DECISIONS.md:184) **does record the deviation honestly** and explains the decision 55 starting values; the screen’s fallback help text also explains it. The behavior still needs approval as a spec change or a UI change.

- **Medium — The Fleet guide promises a shortlist change that its demonstrated action does not produce.** [fleet-screen.tsx](/workspace/predictiq/frontend/components/fleet-screen.tsx:62) says raising one model’s failure cost changes the shortlist. The input-effects table says shortlist members *can* change. In the supplied [per-model screenshot](/workspace/predictiq/docs/QA_REPORTS/stage4-screenshots/maintenance-planner-state-per-model-cost-desktop.png), the order changes but the same three machines retain slots; [the screenshot README](/workspace/predictiq/docs/QA_REPORTS/stage4-screenshots/README.md:7) also incorrectly says the shortlist changes. At that replay hour there are three eligible machines and five slots, so this action cannot change membership.

- **Low — About & Data still describes completed Stage 4 work as future work.** [page.tsx](/workspace/predictiq/frontend/app/about-data/page.tsx:18) says the maintenance list comes “in a later stage,” and [line 92](/workspace/predictiq/frontend/app/about-data/page.tsx:92) says costs will be added later. Its intervening paragraph correctly says the Planner works. This is inconsistent, though it does not claim savings.

The two round 1 findings are fixed in `9e61d79`: per-model planned costs feed planned spend and net benefit, and `/plan` checks declared length and stops streaming once the body exceeds 4,096 bytes ([validation.py](/workspace/predictiq/backend/app/validation.py:139)). The response keeps exposure separate from estimated net benefit, including when the reduction assumption is 0%.

## Criteria

| Criterion | Status | Evidence |
|---|---|---|
| Stage 4 epic | **Not met** | Ranking and labels work, but the shared inputs’ starting behavior and the guide’s guaranteed shortlist claim conflict with the exact UX rules. |
| Cost and capacity inputs | **Met** | Inputs show units and illustrative labels; invalid values show a range message and retain the last valid result. The shared-cost deviation above remains a must-fix. |
| Ranked repair list | **Met** | Deterministic exposure ranking, inclusive cut-off, crew slots, tie-breaks, and plain-words formula are implemented and meaningfully tested against saved scores. |
| Exposure, not savings | **Met** | Exposure and planned spend are separate; net benefit appears only with an assumed reduction and is labelled an estimate. No affirmative savings claim found. |
| Check 4: `/plan` under 256 KB live | **Met** | [Raw live log](/workspace/predictiq/docs/QA_REPORTS/stage4-live-evidence/s4-plan.log:2) records a 100-row answer of **25,466 bytes**, repeated byte-identically three times, with `no-store`. |

I inspected the desktop and mobile planner, guide, state, and live screenshots. The live-check summary agrees with its raw size and refusal log; the supplied raw files do not independently establish the preview’s commit or bundle hash.

## Verdict

**FAIL — two Medium must-fix findings.** The frontend unit suite ran: **138 tests passed**. Backend pytest could not run because this read-only sandbox has no usable temporary directory. I did not run browser or live tests; the review used the committed screenshots and logs.
