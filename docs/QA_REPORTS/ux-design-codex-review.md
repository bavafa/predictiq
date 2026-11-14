# PredictIQ design gate review

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Reviewed design commits on branch ux-design. Saved verbatim; local file links refer to the orchestrator box._

**Recommendation: FAIL.** The design has three high-severity gaps against the approved requirements. This is a review of design artifacts, not a certification of a working app.

## High

1. **The Fleet empty state contradicts its own filter result.** The [empty-state mobile render](/workspace/predictiq/docs/wireframes/fleet-overview-state-empty-mobile.png) says no machines match, but “Machines in Alert” remains “—” and both charts still show nonempty shapes. The [spec](/workspace/predictiq/docs/ux-spec.md:67) requires cards to read 0 in this state. Visitors could read the charts as results for the empty selection. **Fix:** draw an empty or clearly unfiltered state for each affected card and chart, with its population stated. **Confidence: high.**

2. **The Planner promises a rank change that its specified controls cannot produce.** The [visitor guide](/workspace/predictiq/docs/wireframes/fleet-overview.html:174) says changing illustrative costs moves the ranking. Yet the [ranking formula](/workspace/predictiq/docs/ux-spec.md:26) says a single failure cost leaves the order equal to risk order; [planned cost and crew slots](/workspace/predictiq/docs/ux-spec.md:53) change spend and shortlist, not rank. This conflicts with the approved [PRD acceptance check](/workspace/predictiq/docs/PRD.md:31). **Fix:** specify exactly which inputs change rank, exposure, and shortlist; make the guide demonstrate a per-model cost change if a reordered list is intended. Resolve the PRD wording with the owner. **Confidence: high.**

3. **The Model Performance comparison is incomplete.** The [wireframe](/workspace/predictiq/docs/wireframes/model-performance.html:160) places a baseline value beside the main model only for precision–recall area; the cut-off table and other measures do not show baseline results. The [brief](/workspace/predictiq/docs/PROJECT_BRIEF.md:97) calls for baseline-versus-candidate metrics across precision, recall, confusion matrix, false alerts, event detection, and calibration. **Fix:** design a compact comparison table for those measures, with the threshold and evaluation period clear. **Confidence: high.**

## Medium

4. **Required states are described but not drawn for several screens.** The [stories](/workspace/predictiq/docs/stories.md:30) require loading, empty, and error states to be drawn. The [render inventory](/workspace/predictiq/docs/wireframes/render.mjs:20) has Fleet loading/error and selected other states, but no Planner loading/error, Asset panel error or machine-not-found, or Model Performance loading/error. **Fix:** add representative renders for those states, including which content remains usable after a panel fails. **Confidence: high.**

5. **Mobile control targets and slider semantics are unresolved in the wireframes.** Shared CSS sets buttons and selects to a [36px minimum height](/workspace/predictiq/docs/wireframes/fleet-overview.html:32), while the [design rule](/workspace/predictiq/docs/ux-spec.md:87) requires 44×44px touch targets. The [replay slider markup](/workspace/predictiq/docs/wireframes/fleet-overview.html:156) is a `span` with slider role but no focus target or value bounds. **Fix:** draw 44px targets and specify a native range input or complete keyboard, focus, and value semantics for each slider. **Confidence: high for the wireframe mismatch; keyboard behavior cannot be tested without app code.**

6. **The data provenance link has no destination.** “Full data record” points to [`href="#"`](/workspace/predictiq/docs/wireframes/about-data.html:173). It appears actionable but cannot open the promised source record. **Fix:** point it to the provenance document or specify the eventual public destination. **Confidence: high.**

## Commands and evidence

- `git diff --stat origin/main HEAD` and `git diff --name-only origin/main HEAD`: identified 43 changed files; review focused on the requested design artifacts.
- `python3 docs/design/check-contrast.py` and `python3 -I docs/design/check-contrast.py`: both exited 0 with **0 unexpected results**. Spot-checked reported ratios include input border on subtle surface **3.55:1** and risk line on white **3.74:1**; failing pairs are explicitly marked forbidden.
- `git status --short`: clean; no files edited.
- Viewed desktop and mobile PNGs directly, including Fleet, Asset Details, Planner, Model Performance, and several state renders.

**Not checked:** interactive keyboard behavior, actual control updates, saved model values, and runtime accessibility. No app code exists at this gate. The greyscale PNGs show layout, so token contrast results do not verify a final styled interface.