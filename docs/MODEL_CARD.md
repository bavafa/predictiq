# Model card: PredictIQ failure-warning models

**Model version:** `piq-20261114-efc9c243` (the final model of this demo). The performance results on this page were **measured on simulated held-out data** (the test window below, which the models were not fitted or tuned on). Where a figure comes from training or validation data instead, such as row counts or the validation numbers used to choose cut-offs, it says so. All of it is simulated. Nothing here describes real machines or a real company.

Data: Microsoft Predictive Maintenance Modelling Guide sample dataset (simulated), from github.com/microsoft/sqlworkshops (pinned commit e836f4e). Microsoft states content in that repository is licensed under CC BY 4.0; the repository's license file is MIT.

| Fact | Value |
|---|---|
| Version / built | `piq-20261114-efc9c243`, built 2026-11-14 (the date inside the version name; the saved evaluation records no date of its own) |
| Task | Chance that a machine has a recorded failure event within the next 24 hours, scored every hour |
| Models | Main: XGBoost 3.4.1. Baseline: logistic regression (scikit-learn 1.9.1) |
| Features | 35, all built from records before the scoring hour |
| Test window | 2015-11-01 00:00 to 2015-12-30 06:00 (1,423 hours, 142,300 machine-hours for 100 machines; 110 failure events) |
| Source of every metric below | `artifacts/piq-20261114-efc9c243/evaluation.json` (committed; `make verify` recomputes it from the saved models and compares) |
| Metadata and file hashes | `artifacts/piq-20261114-efc9c243/metadata.json`, `manifest.json` |

## Intended use and not intended use

**Intended use.** A portfolio demonstration: to show how failure-warning scores, a plain baseline for comparison, risk drivers and a transparent assumption-based maintenance ranking fit together, using simulated public sample data. A reader can replay the test period, see which machines the model flagged, and check how the model was built and tested.

**Not intended for.**
- Any decision about real equipment, safety, scheduling, spending or staffing. This is not a production, certified or safety system, and it is not connected to any real machine.
- Judging how well these models would do on real data. The data is simulated and its failures are easy to see in the sensors; real-world performance is not measured here and is expected to be lower.
- Causal claims. The explanations ("what drove this score") describe patterns the model used, not physical causes.
- Savings or return-on-investment claims. The costs in the planner are illustrative values, not real costs.
- Use as a live monitoring tool. The demo replays a fixed historical period; it is not live.

## What was built

Two models score each machine at the start of every hour. Each score is a chance (0 to 100%) that the machine will have a failure event in the next 24 hours.

- **Baseline:** logistic regression on scaled features. Missing values are filled with the training median. No class weighting, regularisation strength 1.0.
- **Main model:** XGBoost (gradient-boosted trees). Fixed seed, one thread, so the same data gives the same files. A small grid of four settings (depth 3 or 5, 100 or 300 trees) was compared on the validation period only. Depth 5 with 300 trees had the best validation precision-recall area (0.9949 against 0.9798 to 0.9930 for the others).

Both models use the same 35 features, built only from records before the scoring hour: the last sensor reading, 3-hour and 24-hour averages and spread, a 24-hour slope, 24-hour error counts by type, hours since each part was last replaced, and the machine's model number and age. No failure record is used as an input.

An **event** is one machine-hour with at least one failure row (761 failure rows are 719 events). An hour is labeled positive when an event falls in the next 24 hours.

## Splits

| Period | Hours scored | Used for |
|---|---|---|
| Train | 2015-01-02 06:00 to 2015-08-30 23:00 | Fitting both models |
| Gap | 2015-08-31 | Not used (24-hour gap) |
| Validation | 2015-09-01 to 2015-10-30 23:00 | Model settings, calibration, default cut-off |
| Gap | 2015-10-31 | Not used (24-hour gap) |
| Test | 2015-11-01 00:00 to 2015-12-30 06:00 | Looked at once, after everything was fixed |

Twenty of the 100 machines were set aside with a fixed seed before any fitting. They are in no training or validation data. They are scored on the same test period. That is the held-out-machines test: it is the only basis for any statement about machines the models never saw. The other 80 are the "seen" machines (trained on their earlier hours, scored on their later hours).

Training used 462,240 machine-hours of the 80 seen machines (8,394 labeled positive). Validation used 115,200 machine-hours (2,034 positive).

## Calibration and cut-off (chosen on validation only)

Calibration asks whether a score of 30% means about 30 in 100 such hours fail. For each model, "none" and "sigmoid" (a two-number correction) were compared by Brier score on validation.

| Model | Calibration chosen | Validation Brier (none / sigmoid) | Default cut-off | Validation precision / recall at cut-off |
|---|---|---|---|---|
| Baseline | sigmoid | 0.006305 / 0.006266 | 27% | 0.725 / 0.894 |
| Main | none | 0.000953 / 0.000964 | 51% | 0.976 / 0.957 |

The default cut-off is the whole percent with the best F1 (a balance of precision and recall) on validation; a tie goes to the higher percent. An alert is raised when the score is at or above the cut-off. Several alert hours in a row on one machine count as one alert.

## Results on the test period (simulated)

Test window: 2015-11-01 00:00 to 2015-12-30 06:00, 1,423 hours. Numbers are at each model's default cut-off. "Events" are failure events in the window; the catch share counts only events whose whole 24-hour lookback is inside the window (3 events at the very start are left out, all on seen machines). Precision is the share of alert hours that were followed by a failure within 24 hours; recall is the share of failure-bound hours that were alerted.

### Main model (XGBoost, cut-off 51%)

| Machines | Machine-hours | Events (counted / total) | Precision | Recall | PR-AUC | Brier | Events caught | False alerts per 100 machine-days |
|---|---|---|---|---|---|---|---|---|
| Seen (80) | 113,840 | 82 / 85 | 0.970 | 0.956 | 0.995 | 0.00095 | 82 of 82 (100%) | 0.11 (5 of 94 alerts) |
| Unseen (20) | 28,460 | 25 / 25 | 0.975 | 0.920 | 0.988 | 0.00165 | 25 of 25 (100%) | 0.08 (1 of 27 alerts) |
| All (100) | 142,300 | 107 / 110 | 0.971 | 0.947 | 0.993 | 0.00109 | 107 of 107 (100%) | 0.10 (6 of 121 alerts) |

### Baseline (logistic regression, cut-off 27%)

| Machines | Machine-hours | Events (counted / total) | Precision | Recall | PR-AUC | Brier | Events caught | False alerts per 100 machine-days |
|---|---|---|---|---|---|---|---|---|
| Seen (80) | 113,840 | 82 / 85 | 0.726 | 0.890 | 0.798 | 0.00598 | 82 of 82 (100%) | 1.52 (72 of 177 alerts) |
| Unseen (20) | 28,460 | 25 / 25 | 0.760 | 0.932 | 0.845 | 0.00614 | 25 of 25 (100%) | 1.43 (17 of 44 alerts) |
| All (100) | 142,300 | 107 / 110 | 0.734 | 0.900 | 0.809 | 0.00601 | 107 of 107 (100%) | 1.50 (89 of 221 alerts) |

Right and wrong counts (true alerts, false alerts, misses, quiet and right) for the 100 machines: main 2,454 / 73 / 136 / 139,637; baseline 2,331 / 845 / 259 / 138,865. The full counts for each group, the 10-bin calibration curves, and both models at every whole-percent cut-off from 0 to 100 are in `artifacts/piq-20261114-efc9c243/evaluation.json`.

### What the numbers say

- The main model beats the baseline on the same test hours, on both seen and unseen machines. Its false alerts are about 15 times fewer per 100 machine-days (0.10 against 1.50 for all 100 machines).
- On the 20 unseen machines the main model scored about as well as on seen machines (precision 0.975, recall 0.920 against 0.970 and 0.956). The unseen group is small: 25 events and 602 positive hours. A gap of a few points between the groups is within what that size can produce.
- Both models caught every event with a full lookback. That result is easy to over-read. With 107 events, 107 of 107 is still compatible with a true catch rate a few points below 100% (a common rule of thumb puts the lower end near 97%).

## Limitations

- **Simulated data.** The sensor readings and failures were generated by Microsoft's simulator, and failures leave a clear mark in the sensors and error counts. The very high scores here are not a forecast for real equipment, where signs are weaker and noisier. Treat the comparison between the two models as meaningful and the absolute levels as an artefact of the data.
- **One year, 100 machines, 719 events.** The test period has 110 events. Intervals around every figure are wide; none are given because no resampling test was run.
- **Hour-level scores count overlapping hours.** One failure labels up to 24 hours positive, so hour-level precision and recall are not event-level. The catch share and false alerts per 100 machine-days are the event-level measures.
- **Cut-off is a default, not a rule.** It balances precision and recall on validation. A different cost of a miss or a false alarm needs a different cut-off. The cut-off table in `evaluation.json` shows every choice.
- **Calibration was fitted on the same validation hours used to pick it.** The sigmoid has two numbers, so the risk of fooling ourselves is small, but it is not zero.
- **Sample dates.** Events at 2015-12-31 06:00 are not test events, but they label the last test hours positive. Hours after the last observed failure are not scored, so the test ends at 2015-12-30 06:00.
- **The test period was used once.** No setting changed after seeing it. A later fix gets a new model version and its own published result. There is a single evaluation: no repeated runs, cross-validation or resampling, so no spread between runs is available.
- **Twenty unseen machines.** The only evidence about machines the models never saw is 20 machines and 25 events.
- **Replay, not live.** The demo steps through saved scores for a fixed historical period. Nothing is scored live, and no real-time data is read.
- **Explanations are descriptive.** They come from the model's own feature contributions and show associations, not causes.
- **Illustrative costs.** The maintenance planner's money amounts are assumptions you can change. They are not measured and give no estimate of real savings.
- **No real-world claim.** Nothing here is evidence about real machines, a real company or any mine.

## Replay start

The replay starts at 2015-11-01 00:00, the first test hour, because at least one machine already scored at or above the main model's 51% cut-off in that hour (rule: decision 30, branch `first_hour_with_alert`). It ends at 2015-12-30 06:00.

## How to reproduce

`make data`, `make train`, `make evaluate` (once per version), `make verify`, `make replay`. Python 3.12, scikit-learn 1.9.1, xgboost 3.4.1, locked in `uv.lock`. The pipeline was run twice from scratch on 14 Nov 2026; every saved file, including `evaluation.json`, was byte-identical. `make verify` recomputes all test metrics from the saved models and compares them with `evaluation.json` (counts exactly, other numbers at six decimals). `manifest.json` lists the SHA-256 of every file in the version folder.

## Component models: wear view and 48-hour warning (version comp-20261115-228daea1, simulated)

_Spec: `docs/specs/component-planner.md`; decision 77. Built beside the machine model; nothing user-facing uses it yet. Component names are illustrative (assumed, not stated by the source); the data only has comp1 to comp4. Every number below is from the simulated Microsoft sample data._

**What it is.** Two layers per part. The **wear view** (7 and 14 days) uses only part age, machine model, machine age and past failures of that part. It is a wear estimate, not an early warning. The **48-hour warning** uses the 35 sensor and error features plus the part's own age inputs. Both were fitted on the 80 seen machines (train), with models, calibration and cut-offs chosen on validation. The test period was scored once (`ml/component_evaluate.py`); no setting changed after seeing it.

**Rule to beat.** "Chance by machine model and days since replacement, from training data." For each part and horizon, the wear model was shipped only if it beat the rule on validation (higher PR-AUC and Brier no worse). It did for 7 of 8 part-and-horizon pairs. For comp3 at 14 days the rule is shipped. On the test period the wear model also scored higher PR-AUC than the rule in all 8 pairs, but by a small margin for comp1, comp2 and comp3 at 14 days.


**7-day wear view, test period, all 100 machines (simulated)**

| Part | Base rate | Rule PR-AUC | Wear model PR-AUC | Lift over base rate (wear model) | Wear model Brier vs rule | Shipped |
|---|---:|---:|---:|---:|---|---|
| comp1 (Motor winding) | 2.9% | 0.052 | 0.090 (xgb) | 3.1x | 0.0274 vs 0.0282 | xgb |
| comp2 (Bearing) | 5.5% | 0.081 | 0.146 (xgb) | 2.6x | 0.0495 vs 0.0521 | xgb |
| comp3 (Seal / valve) | 2.2% | 0.152 | 0.212 (xgb) | 9.8x | 0.0181 vs 0.0189 | xgb |
| comp4 (Coupling) | 2.7% | 0.072 | 0.114 (logistic) | 4.2x | 0.0254 vs 0.0259 | logistic |

**14-day wear view, test period, all 100 machines (simulated)**

| Part | Base rate | Rule PR-AUC | Wear model PR-AUC | Lift over base rate (wear model) | Wear model Brier vs rule | Shipped |
|---|---:|---:|---:|---:|---|---|
| comp1 (Motor winding) | 5.4% | 0.106 | 0.116 (xgb) | 2.1x | 0.0495 vs 0.0511 | xgb |
| comp2 (Bearing) | 11.4% | 0.160 | 0.162 (logistic) | 1.4x | 0.0999 vs 0.1012 | logistic |
| comp3 (Seal / valve) | 4.6% | 0.329 | 0.335 (xgb) | 7.2x | 0.0334 vs 0.0334 | rule |
| comp4 (Coupling) | 5.8% | 0.146 | 0.252 (logistic) | 4.4x | 0.0476 vs 0.0513 | logistic |

**48-hour warning, test period (simulated)**

| Part | PR-AUC | Failures caught (all) | Failures caught (20 unseen machines) | False-alert hours per 100 component-weeks | Cut-off |
|---|---:|---:|---:|---:|---:|
| comp1 (Motor winding) | 0.903 | 24/24 | 8/8 | 23.7 | 27% |
| comp2 (Bearing) | 0.927 | 44/44 | 8/8 | 48.8 | 35% |
| comp3 (Seal / valve) | 0.951 | 18/18 | 5/5 | 12.1 | 36% |
| comp4 (Coupling) | 0.942 | 21/21 | 4/4 | 21.0 | 40% |

**Wear view alert volume at the validation cut-off (shipped model, all machines)**

| Horizon | Part | Share of component-days that alert | Failures caught |
|---|---|---:|---:|
| 7 days | comp1 (Motor winding) | 9% | 8/18 |
| 7 days | comp2 (Bearing) | 5% | 8/39 |
| 7 days | comp3 (Seal / valve) | 3% | 5/16 |
| 7 days | comp4 (Coupling) | 10% | 9/18 |
| 14 days | comp1 (Motor winding) | 3% | 2/11 |
| 14 days | comp2 (Bearing) | 74% | 29/31 |
| 14 days | comp3 (Seal / valve) | 7% | 9/12 |
| 14 days | comp4 (Coupling) | 8% | 8/17 |

**How to read this**
- **The wear view ranks parts; it does not warn.** Lift over the base rate is 1.4x to 9.8x. Much of comp3's lift is the rule that comp3 only fails on model1 and model2 (decision 75), which the plain rule also finds. A part ranked high is somewhat more likely to fail, but most high-ranked parts still do not fail in the window.
- **Its alert cut-off is not usable as a call list.** The cut-off was set for best F1 on validation. For comp2 at 14 days that means 74% of component-days alert (base rate 11%), so "caught 29 of 31" says almost nothing. Rule and wear-model cut-offs differ, so their caught counts are not comparable either. A planner should use the ranking and a stated capacity, not this cut-off.
- **The 48-hour warning is the strong signal.** It caught every failure whose full 48-hour window was in the test period (107 of 107 part failures across the four parts, including all 25 on the 20 unseen machines). With so few events, that is still compatible with a true catch rate well below 100%, and the simulator makes failures leave a clear mark about 2 days ahead.
- **False alerts are counted in rows.** One failure makes up to 7, 14 or 48 rows positive, and alert rows overlap. "False-alert hours per 100 component-weeks" is false alert rows divided by component-time, not distinct false alarms.
- **Not done:** no bootstrap intervals; no matched-alert-rate comparison of rule and wear model; no `--verify` command for this version yet; independent Codex review not run (Codex is not installed); one Claude subagent review covered step 1 only.
