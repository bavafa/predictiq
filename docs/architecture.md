# PredictIQ: Architecture

How the parts fit, in plain words. Everything here uses *simulated* sample data published by Microsoft; money figures are *illustrative*. Status: proposed, 13 Nov 2026, for review and owner approval. Nothing is built or deployed. Decisions 32–45 in `DECISIONS.md` record each choice.

## Data flow

1. **Download:** fetch the five CSV (comma-separated) files from the pinned commit; stop if any SHA-256 fingerprint differs from `DATA_PROVENANCE.md`. Raw files stay gitignored.
2. **Validation** fails loudly on IDs, hourly steps, duplicates, blanks, ranges, joins and the recorded counts (761 failure rows → 719 events).
3. **Past-only features and labels** (rules below).
4. **Train, calibrate, evaluate:** logistic regression baseline; XGBoost (gradient-boosted trees) main model.
5. **Versioned artifacts** in `artifacts/<model_version>/`: model, feature fingerprint, `evaluation.json`, `metadata.json`, hash manifest.
6. **Precomputed replay scores** and SHAP explanations (each input's push on a score) for the test period, packed into a small serving bundle.
7. **Data service** (FastAPI) answers read-only questions from the bundle; the **web app** (Next.js) asks only for what one screen needs.

## Three modes

- **Offline training:** owner's machine or a manual CI (continuous integration) job, never the server.
- **Precomputed replay scores:** built offline; **this is what the app shows.**
- **Live inference: none in the first release.** Every hour the app shows is already scored and the Sensor Sandbox is out of scope, so the server needs no model libraries and training and serving cannot drift apart. If ever added, it must import the training `ml/features` code; a mismatch is a release blocker.

## The 24-hour label

- **Event:** all failure rows for one machine in one hour form one event (761 rows → 719 events).
- **Label:** machine *m* at scored hour *t* is positive if an event for *m* falls strictly after *t* and at or before *t*+24h. An event at exactly *t* does not count; one at *t*+24h does.
- **As-of rule:** scoring hour *t* happens at the start of that hour. Records stamped at *t* (telemetry, errors, maintenance, failures) are **not** available. This matters: 702 of 719 events have a repair logged in the same hour.
- **Hours after a failure** are kept and labeled by the same rule: the machine was repaired and telemetry continues, and dropping them would hide false alerts after repairs.
- **End of data:** hours whose 24-hour window passes the last hour of failure records are unlabeled and dropped.

## Feature rules

All windows are keyed by machine and end at *t*−1h.

- **Telemetry:** last reading; 3h and 24h mean and spread; 24h slope; for each of the four sensors.
- **Errors:** count of each error type in the past 24h.
- **Maintenance:** hours since last replacement of each component, from records strictly earlier than *t* (records start in 2014, so no gap).
- **Machine:** model and age. Failure records are never a feature.

**Warm-up:** the longest window is 24h, so the first scored hour is 2015-01-02 06:00; earlier hours are dropped and counted.

**Leakage test:** for sampled (machine, *t*) pairs, randomize every row stamped at or after *t* in all five tables, rebuild, and assert features and scores at *t* are unchanged.

## Splits (proposed)

Chronological, with a 24-hour embargo at each boundary so no label window reaches a later period.

| Split | Scored hours (proposed) | Use |
|---|---|---|
| Train | 2015-01-02 06:00 → 2015-08-30 23:00 | Fit both models |
| Embargo | 2015-08-31, all day | None |
| Validation | 2015-09-01 00:00 → 2015-10-30 23:00 | Model settings, calibration, default cut-off |
| Embargo | 2015-10-31, all day | None |
| Test | 2015-11-01 00:00 → 2015-12-31 06:00 | Scored once; also the replay window |

Calibration (none or sigmoid) is chosen on validation by Brier score. The default cut-off is the whole percent with the best F1 (balance of precision and recall) on validation; ties go higher. `evaluate.py` refuses a second test run for one model version. An optional experiment holds out 20 fixed machines; without it, no unseen-machine claim is made.

## Metrics (test period)

- **Hour-level:** precision, recall, precision–recall area, the four right/wrong counts, Brier score (mean squared gap between score and outcome), calibration curve (10 equal-size bins).
- **Share of failure events caught:** caught if any alert occurred in the 24 hours before it. Only events whose whole lookback lies in test hours count; the number excluded is reported.
- **False alerts per 100 machine-days:** consecutive alert hours on one machine are one alert, false if none of its hours is labeled positive. Rate = false alerts ÷ (scored machine-hours ÷ 24) × 100.

## Replay start

`ml/replay.py` applies decision 30 to saved test scores (first test hour with any main-model score at or above the default cut-off, else the first test hour) and stores the hour and branch in `metadata.json`.

## Data service contract

Base `/api/v1`. GET answers never change within a model version, so the CDN (content delivery network) caches them. Errors use the standard problem-details JSON format.

| Endpoint | Returns |
|---|---|
| `GET /health` | Status, model version |
| `GET /metadata` | Model version and date, splits, replay window and start, default cut-off, machines, data credit |
| `GET /fleet?at&cutoff&machine_model&status&machine` | Cards, 10-bin distribution, ranked rows (≤100); Alert count from the same rows |
| `GET /fleet/trend?at&cutoff&range&filters` | Machines in Alert per hour, ≤168 points |
| `GET /assets/{id}?at&cutoff` | Model, age, score, status, last 7 days of errors and repairs, past estimates and failures |
| `GET /assets/{id}/telemetry?at&range=24h\|7d` | ≤168 hourly rows |
| `GET /assets/{id}/explanation?at` | Top 8 contributions plus "all others", with the patterns-not-causes caveat |
| `POST /plan` | Planner list, shortlist and totals (decisions 16, 21, 23) |
| `GET /model/metrics` | `evaluation.json` for both models |
| `GET /model/threshold-analysis` | Both models at every whole-percent cut-off from 0 to 100 |

**Validation:** `at` is an hour inside the replay window; `cutoff` a whole percent 0–100; machines 1–100, else 404. Planner costs 0–10,000,000 whole units; crew slots 0–100; risk reduction off or 0–90% in 5-point steps. Out-of-range values are refused, never adjusted. Every record returned is stamped strictly before `at`, as the model saw it. **Size limits:** at most 168 time points or 100 machines per response, each under 256 KB (tested). The browser never loads the history.

## Repository layout

```text
ml/         validate.py features/ labels.py train.py evaluate.py replay.py tests/
backend/    app/ api/ services/ (planner) schemas/ tests/
frontend/   app/ components/ lib/ tests/ e2e/ api/index.py (Vercel adapter)
artifacts/  data/   (gitignored except READMEs)
scripts/    download_data.py build_bundle.py
docs/ .github/workflows/ Makefile pyproject.toml uv.lock
```

## Testing

- **pytest:** label edge cases (event at *t*, at *t*+24h, two parts in one hour, end of data); leakage test; feature parity (stored scores equal the saved model on freshly built features); embargo; planner arithmetic; API bounds and size caps.
- **Vitest + React Testing Library:** component states, labels, formats, keyboard use.
- **Playwright:** visitor path, every control changes output, replay ends, axe accessibility scan, desktop and mobile.

**Every pull request** runs lint, type checks, pytest, Vitest, Playwright with axe (on a small synthetic test bundle that a release check keeps out of builds), pip-audit, npm audit and a secret scan. The full pipeline needs the 80 MB download, so it runs on demand and before release; a second run must reproduce `evaluation.json` exactly.

## Hosting at C$0/month

**Size estimate** (not measured): 144,700 test machine-hours give scores ~1 MB, top-8 explanations ~5–7 MB, telemetry (test period plus 7 days before) ~3 MB, events and metrics <1 MB: a ~10–15 MB bundle.

| | (a) Vercel + Render free | (b) One host for both | (c) All on Vercel |
|---|---|---|---|
| Wake-up | Render sleeps after 15 idle minutes; waking "takes about one minute" | On Render, the whole site waits, not just data | No idle sleep stated; cold starts not documented |
| Compute | 0.1 CPU, 512 MB | Render: same. Hugging Face Docker Spaces now need a paid plan | 2 GB, 1 virtual CPU; 500 MB Python bundle; 4.5 MB response |
| Monthly limits | 750 instance hours | Same | 1M calls, 4 CPU-hours, 100 GB transfer; over limit, wait 30 days |
| Caveat | Render: "Do not use them for production" | Not C$0 on Hugging Face | Static-files-only variant has no server, but moves validation and planner to the browser and drops FastAPI |

**Recommendation: (c) with a Python function:** Next.js and FastAPI in one Vercel project. No minute-long wake-up; one origin, so no cross-origin setup; the FastAPI contract stays; the bundle fits; cached GET responses protect the CPU-hour limit. If the skeleton spike fails, fall back to (a), whose "waking up" screen is already designed.

**Not measured:** cold starts, bundle size with dependencies, memory and CPU per request, cache hit rate, wiring a Python function beside Next.js, Hobby rate-limit rules, Hobby terms on portfolio use.

Sources, all read 2026-11-13: vercel.com/docs/limits, /docs/plans/hobby, /docs/functions/limitations, /docs/functions/runtimes/python (Python generally available, 3.12 default); render.com/docs/free, /docs/compute-plans; huggingface.co/docs/hub/en/spaces-overview, /docs/hub/main/spaces-gpus.

## Security

Read-only; the one POST stores nothing. Pydantic validates every input. Rate limits on `/plan` and telemetry (per-instance limiter; platform rules if Hobby allows). No secrets in the frontend or repository; `.env*` gitignored. Lockfiles, Dependabot, audits, secret scan. No stack traces in responses.

## Reproducibility

Python 3.12 with `uv.lock`; `package-lock.json`; fixed seeds for models and SHAP. `make train`, `make evaluate`, `make replay`. Model version `piq-<date>-<8-character hash of data hashes, config and commit>`, shown on screen. `evaluation.json` records splits, cut-off, calibration, metrics and library versions.
