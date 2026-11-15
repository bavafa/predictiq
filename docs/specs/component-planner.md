# Spec: component-level planner with a 7 to 14 day view

_Draft for owner approval, 2026-11-15 (America/Toronto). Nothing here is built. All data is simulated (Microsoft sample dataset); every number below is from that simulated data._

## Goal

Let the Maintenance Planner say things like **"Replace component 2 on Air compressor 69 in the next shutdown window"**, with a 7 or 14 day risk view per component, instead of only "this machine may fail in the next 24 hours".

## What the data supports (checked 2026-11-15)

Analysis run on the five raw files (pinned commit e836f4e), one score per machine-component per day.

**1. How often a component fails within the window (base rate, all of 2015):**

| Component | Within 7 days | Within 14 days |
|---|---:|---:|
| comp1 | 3.4% | 6.9% |
| comp2 | 4.9% | 9.8% |
| comp3 | 2.5% | 5.0% |
| comp4 | 3.4% | 6.7% |

**2. Each component has its own warning sign, but only about 2 days ahead.** Average reading on the day before a failure, in standard deviations from the fleet average:

| Failing part | Sensor that moves | 1-2 days before | 3, 7 or 14 days before |
|---|---|---:|---:|
| comp1 | voltage | +1.3 | about 0 |
| comp2 | rotation | -1.5 | about 0 |
| comp3 | pressure | +2.2 to +2.3 | +0.1 or less |
| comp4 | vibration | +1.9 | about 0 |

Error codes behave the same way. In the day before a failure, 96 to 99% of failures show a matching error (error1 for comp1, error2 and error3 for comp2, error4 for comp3, error5 for comp4). Between 1 and 7 days before, the matching error shows on 1 to 7% of failures, about the background rate.

**3. Component age is a weak signal.** Over 14 days, a component replaced 30 days ago or less almost never fails (0 to 6%). After that the chance is roughly flat at 7 to 21%, with no clear rise with age. comp3 fails only on model1 and model2 (decision 75). comp4 failures rise with machine age.

**What this means.** In this simulated data, nothing seen 3 or more days ahead tells a failing part apart from a healthy one, except "recently replaced parts rarely fail" and the model and machine-age patterns. A 7 to 14 day view can therefore only be a **wear-and-exposure estimate**, not an early warning. The sharp signal stays at about 48 hours. The spec is built around that, and the page must say so.

## Proposed design

### Two layers per component

| Layer | Question | Horizon | What drives it | Shown as |
|---|---|---|---|---|
| **Wear view** (new) | Chance this part fails before the next window | 7 or 14 days | Days since this part was replaced, machine model, machine age, past failures of this part | "Wear estimate", labelled weak |
| **Warning** (new, per component) | Is this part showing its failure signature now? | 48 hours | Its sensor and error signature, plus the wear inputs | "Warning: comp2 signature" |

The current 24-hour machine model stays as it is on Fleet Overview and Asset Details. This change only affects the Planner and a new component panel on Asset Details.

### Models

- **Wear view:** one model per component, scored once a day at 06:00. Logistic regression or a small gradient-boosted model on age-type inputs only (no telemetry). The label is "this component has a recorded failure in the next H days", for H = 7 and 14.
- **Warning:** one model per component on the existing 35 features, with the label "this component fails in the next 48 hours". The 48 hours come from finding 2.
- **Same rules as today:** time splits, two 1-day embargo gaps, the 20 unseen machines, records at the scoring time treated as unknown, and cut-offs set on validation and reported on test once. The horizon makes overlap worse: one failure labels up to 14 days positive. So the headline numbers are **event-level** (parts caught before failure, false calls per 100 machine-weeks), not day-level.
- **Baseline to beat:** the wear view must beat a plain rule, "chance by days since replacement and model, from training data". If it cannot, we ship the rule and say so.

### Shutdown windows (assumed)

The data has no shutdown or maintenance windows. Proposal: one **illustrative weekly window per machine model**, for example model1 on Sundays 06:00 to 18:00, model2 on Mondays, and so on, set in a config file and shown on the page as "assumed". The Planner asks "will this part fail before its next window?" A part that will probably fail before its window is flagged **"act before window"**.

### Planner output

Rows become machine-component pairs, ranked by expected exposure until the next window (chance × failure cost for that component), the same idea as today. For example:

| Rank | Machine | Part | Chance before next window | Next window (assumed) | Signal | Action |
|---|---|---|---:|---|---|---|
| 1 | Air compressor 69 | comp2 | 14.8% | Sun 8 Nov, 06:00 | Wear estimate | Replace in window |
| 2 | CNC spindle 48 | comp4 | 61.0% | Sun 8 Nov, 06:00 | Warning: comp4 signature | Act before window |

_Numbers in this example are placeholders, not results._

- Costs become per component (illustrative, with defaults per component and model), and crew slots become **slots per window**.
- Horizon switch: 7 days / 14 days.
- Every number carries the existing labels (Predicted, Illustrative). Wear-view rows also carry **"Wear estimate: weak signal in this data"**.

### Data service

- New saved scores: component-day wear scores and component-hour warning scores, in the bundle like today's scores (nothing calculated live).
- `POST /plan` gains `level: "machine" | "component"` and `horizon_days: 7 | 14`. The default stays the current machine plan, so nothing existing breaks.
- New `GET /assets/{id}/components` returns each part's wear chance, warning state and days since replacement.

## Honesty rules (must hold)

- The page states, near the horizon switch: "In this simulated data, warning signs appear about 2 days before a failure. The 7 to 14 day view is a wear estimate from part age and history, not an early warning."
- The shutdown windows and component costs are labelled assumed / illustrative.
- The component names stay comp1 to comp4. We do not invent part names unless the owner asks, and if so they get the same "illustrative" label as the machine types.
- If the wear view does not beat the plain rule on validation, the page says so and uses the rule.

## Size and order of work

| Step | What | Rough size |
|---|---|---|
| 1 | Labels and features for component-day and component-hour; tests | 1 session |
| 2 | Train, calibrate, evaluate (once), model card section, Codex review | 1 to 2 sessions |
| 3 | Bundle and data service (`/plan` options, `/components`), tests | 1 session |
| 4 | Planner UI (rows, horizon switch, windows, labels), Asset Details component panel, e2e | 1 to 2 sessions |
| 5 | Docs, decisions, About & Data and In a Real Plant updates | part of the above |

That is 4 to 6 sessions, one stacked PR per step. Steps 1 and 2 end with a gate: if the wear view is no better than the plain rule, we stop and decide before building the UI.

## Decisions for the owner

1. Approve the two-layer design (wear view plus 48-hour warning), given that the data shows no early warning beyond about 2 days.
2. Default horizon: 14 days (recommended, since a weekly window plus lead time fits it), or 7 days.
3. Shutdown windows: one assumed weekly window per machine model (recommended), or one plant-wide window.
4. Keep the part names comp1 to comp4 (recommended), or give them illustrative names, for example comp2 = "bearing".
5. Model version: this is a new model version beside the current one, under architecture and model-card rules, with a Codex review.
