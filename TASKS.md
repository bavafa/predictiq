# Tasks

Current stage: **User-experience design.**

## Done (approved by Meysam (Owner), 13 Nov 2026 8:41 PM ET)
- [x] Gate 0 data check, approved. License accepted and credit line applied.
- [x] Requirements and stories, approved.
- [x] Independent review rounds for Gate 0 and the requirements.

## Current stage: user-experience design
- [x] Experience spec: users, the 90-second visitor path, screens, interactions, states, accessibility, labeling rules (`docs/ux-spec.md`)
- [x] Low-fidelity wireframes, desktop and mobile, for the five screens, rendered to images, plus key states (`docs/wireframes/`)
- [x] Component list (`docs/design/components.md`)
- [x] Colour and type tokens, with computed contrast (`docs/design/tokens.md`, `tokens.json`)
- [x] Independent review of the design documents (result: fail, 3 high and 3 medium findings; `docs/QA_REPORTS/ux-design-codex-review.md`)
- [x] One bounded fix round: all six findings addressed, 13 Nov 2026 (decisions 21–27)
- [ ] Owner approval of the design gate (includes design decisions 11–20 and the open questions)

## Next stages
- [ ] Architecture: not started; waits for design approval
- [ ] Build in stories (project skeleton, then data and model, screens, planner, launch): not started; waits for approval

## Known issues from the design re-check (Medium, tracked; not fixed because the one fix round was used)
- [x] Planner per-model-cost example: the "Moved" marks don't come from one consistent earlier order. Use a consistent example.
- [x] Model comparison: state that a run of consecutive alert hours counts as one alert in "false alerts per 100 machine-days".
- [x] Planner wireframe: the model3 cost field's label must point to the input that is visible in both states.
