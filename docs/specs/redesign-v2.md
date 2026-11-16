# Spec: redesign v2 (second round of mock-ups)

_Approved by the owner 15 Nov 2026, with decisions 83 to 89._ All data stays simulated; money figures stay illustrative. Mock-ups: "PredictIQ redesign mock-ups" canvas (frames 1 Home, 1b Home on a phone, 2 Alerts, 3 Machine page, 4 Work plan; the three v1 frames are superseded). Placeholders in the mock-ups are not results._

Builds on `docs/specs/redesign-maintenance-tool.md` (v1, decision 82, stages 1 to 6 merged as #19 to #24). Where this spec is silent, v1 and the existing rules stand.

## Why
v1 made the site read as a tool, but the first screen still opens on numbers. v2 adds a landing page that says what the product is and who it is for in one screen, gives alerts their own page ranked by cost, gathers the evidence on one machine page, and merges "recommended" and "my jobs" into one work plan list.

## What changes (v1 as built, then v2)
| Area | v1 as built | v2 |
|---|---|---|
| Navigation | Left sidebar: Overview, Assets, Work plan, Alert accuracy, In a real plant, About this demo | Top bar: Home, **Alerts** (with the count), Assets, Work plan, Alert accuracy, About this demo. "In a real plant" moves into a link in "What is real and what is not" on Home and the footer |
| Header time | Plant time, Advance 1 h, Time controls panel | Same, plus a **Play** button beside Advance 1 hour; the Time controls panel keeps Start, Step back, Step size and the timeline. The plan page says "Plan follows the plant time" |
| Landing | Overview: headline, alert cards, status by type | **Home**: hero (what it is, one button "See the N alerts"), "Demo plant at the simulated plant time" (act today count, normal count, crew slots booked, Advance), How it works (three steps), Needs action today (top 3 alerts), Where to go (four cards with a live fact each), Who it is for, What is real and what is not |
| Alerts | Cards on Overview | New **Alerts** page: ranked by cost at risk, each with reason, likely part (only with a 48 h warning, decision 85), chance, cost at risk, View machine, Add to work plan; a "Since the last hour" line after Advance; the rest of the plant by equipment type |
| Asset page | Header, score, why, explanation table, parts panel, charts, lists | **Machine page**: "All alerts" back link, "Priority n of N", Dismiss and Add to work plan, chance, "What to check first" (patterns, not a diagnosis), Parts (48 h warning, chance before next window, last replaced), Sensors with a fleet-normal band and status words, one History list; the current explanation table sits under "Model details" (collapsed) |
| Work plan | My jobs, then the machine and parts planner | **One list of jobs**: costliest risk first; Act today jobs "this shift", wear-risk jobs "next shutdown window"; Status Recommended, Scheduled, Done; Plan settings in a side panel; Crew slots, next window and cost at risk across the top |
| Status words | Alert, Below cut-off | **Act today**, **Normal** (decision 84) |
| Alert accuracy | Plain answer then the evaluation | Unchanged; Home shows "N of N failures caught" only with "on simulated data" beside it |

Pages that stay as they are: Assets (ranked table and filters), Alert accuracy evaluation, About this demo, In a real plant.

## Decisions answered by the owner (15 Nov 2026)
83. **Onboarding returns, in the v2 Home.** Decision 0 of v1 (no onboarding copy) is superseded for Home only: a hero, "How it works", "Where to go" and "Who it is for" are in.
84. **Status words are Act today and Normal; no "right now".** The amber tag with a triangle stays. "Right now" is not used; Home says "Demo plant at the simulated plant time". The words live, now (as in current moment), current and real-time stay banned for replayed data. "Normal" is a model status, not a claim about the machine: Home and Alerts carry the line "Normal means below the Act today level. It is not a guarantee." The accessible name of every status keeps the word "predicted".
85. **Likely part and "What to check first" only when a 48-hour warning exists.** Otherwise the alert shows the machine-level reason only. Parts without a warning appear on the Machine page with their wear estimate labelled as a weak estimate (decision 79).
86. **Spec first, then stacked stages.** Same rules as v1: one pull request per stage, owner merges, gate report at the end.

## Decisions 87 to 89 (approved by the owner, 15 Nov 2026)
- **87. "Cost at risk" replaces "expected exposure" in the interface.** Same number and same formula, labelled "(example cost)" or Illustrative; "savings" stays banned. Default: yes.
- **88. Alerts are ranked by cost at risk, not by chance.** The page says why the order can differ from chance order (as the mock-up does for Exhaust fan 15). Default: yes, same rule as the planner today.
- **89. Job state moves to one list.** Recommended jobs are computed from the model; Scheduled and Done are saved in the browser only; "Reset demo" stays. Saved v1 job state (machines added) is carried over as Recommended jobs for those machines. Default: yes.

## Goals
1. A first-time visitor can say what the site is, who it is for and what to do next within 10 seconds of landing (the five-second test, at least five people, unchanged from v1).
2. Home never makes the model look better than the evidence supports: "N of N failures caught" always sits next to "on simulated data" and "real equipment would score lower".
3. The job flow still works alert to scheduled to done in under 60 seconds (hand-timed).
4. Palette, accessibility checks (axe, contrast, 44 px targets, keyboard) and the disclosure strip stay in force.

## Anti-goals
A visitor believes the data is real; "Normal" reads as a guarantee; a weak wear estimate reads as a warning; the site goes back to looking like a chart showcase; any check is weakened to pass.

## Non-goals
No change to models, saved scores, the bundle or the existing data service answers (the Alerts and Home facts use the answers that exist today; if a new field is needed, it is a separate decision). No accounts, server storage, dark mode or new colour roles.

## Constraints
`CLAUDE.md` stage gates, branch from updated `main`, stacked pull requests, only the owner merges, no co-author trailer, STATUS.md and TASKS.md every session, new decisions from 90. All existing checks pass without being weakened; tests that assert old copy are updated deliberately, one decision at a time. Independent review: `codex` is not installed in the build environment, so the owner chooses between waiving it and running it.

## Proposed stages (one stacked PR each)
1. Shell: top navigation, header Play, footer strip, status words, route `/alerts`; redirect old links.
2. Home.
3. Alerts page.
4. Machine page.
5. Work plan (one list, settings panel, job state migration).
6. Test sweep, accessibility sweep, screenshots, gate report.

## Left to the builder
Exact copy within the wording rules; icons (lucide); mobile layouts (Home on a phone is frame 1b; the others follow the 1024 px rule); the Time controls panel; empty, loading and error states (existing UX spec carries over); replacing the schematic sensor lines and placeholder values with real data; the fleet-normal band (computed from the data service answers if possible; if it needs a new field, ask).

## Success checks
Five-second test with at least five people who have not seen the site; the 60-second timed job flow; every automated check green; no honesty issue open at the gate.
