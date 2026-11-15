# PredictIQ: Architecture

How the parts fit, in plain words. Everything here uses *simulated* sample data published by Microsoft; money figures are *illustrative*. Status: proposed, 13 Nov 2026; revised the same day after the independent review (`docs/QA_REPORTS/architecture-codex-review.md`); awaits owner approval. Nothing is built or deployed. Decisions 32–45 in `DECISIONS.md` record each choice.

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
- **End of data (censoring):** the data never says how far failure recording runs. The last failure event is at 2015-12-31 06:00, but telemetry and repairs run to 2016-01-01 06:00, and we cannot prove that a quiet last day means no failures. So coverage is taken to end at the last observed failure, 2015-12-31 06:00. Any hour whose 24-hour window passes that point is unlabeled and is not scored, evaluated or replayed. The last scored hour is **2015-12-30 06:00**.

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
| Test | 2015-11-01 00:00 → 2015-12-30 06:00 | Evaluated once; also the replay window |

**Data facts** (719 events by event time): before the first scored hour 17; train 473; first embargo 3; validation 109; second embargo 3; test 110; after the last test hour 4 (all at 2015-12-31 06:00, still labeling 2015-12-30 06:00 positive, so 114 events label some test hour). Of the **110** test events, **107** have their whole 24-hour lookback inside scored test hours and **3** do not (all at 2015-11-01 06:00, whose lookback starts in the embargo). Separately, the **4** events after the test window (2015-12-31 06:00) are not test events but still label the last scored test hour positive. Test: 1,423 hours × 100 machines = **142,300 machine-hours**. The data stage re-checks these counts before fitting.

Calibration (none or sigmoid) is chosen on validation by Brier score. The default cut-off is the whole percent with the best F1 (balance of precision and recall) on validation; ties go higher. **Unseen-machine test (required, owner decision 13 Nov 2026; built in the data-and-model stage):** 20 machines, picked once with a fixed seed before any fitting, are left out of training and validation entirely. They are scored on the same test period. Results are reported beside the same-machine results and labeled simulated. Any statement about machines the model never saw comes only from this test.

**Test used once, checkable many times.** `evaluate.py --write` runs once per model version and saves `evaluation.json`, with its hash in the manifest. If the file exists it refuses; nothing overwrites it. `evaluate.py --verify` recomputes every test metric from the saved model and freshly built features and compares with the saved file (counts exactly, other numbers at the stored precision). It writes nothing and fails on any mismatch. No setting may be changed because of test results. A later model (a bug fix, say) gets a new version and its own result; the old result stays published.

## Metrics (test period)

- **Hour-level:** precision, recall, precision–recall area, the four right/wrong counts, Brier score (mean squared gap between score and outcome), calibration curve (10 equal-size bins).
- **Share of failure events caught:** caught if any alert occurred in the 24 hours before it. Only events whose whole lookback lies in test hours count; the number excluded is reported.
- **False alerts per 100 machine-days:** consecutive alert hours on one machine are one alert, false if none of its hours is labeled positive. Rate = false alerts ÷ (scored machine-hours ÷ 24) × 100.

## Replay start

`ml/replay.py` applies decision 30 to saved test scores (first test hour with any main-model score at or above the default cut-off, else the first test hour) and stores the hour and branch in `metadata.json`. The replay runs from that hour to 2015-12-30 06:00; it never shows unlabeled hours.

## Data service contract

Base `/api/v1`. Errors use the standard problem-details JSON format.

**Caching. Only the latest model version is served** (owner decision, 13 Nov 2026). Each deployment carries exactly one model version. Vercel caches no function response unless told to (default `max-age=0, must-revalidate`). The web app reads `model_version` from `/metadata` (short cache) and adds `mv=<model_version>` to every other GET. Within a deployment, a URL with the current `mv` always returns the same answer, so it is safe to cache. Any other `mv` gets a `404` with `no-store`. The app then re-reads `/metadata` once and retries; it never shows an old version's data. After a release, browsers may keep an old version's answers for up to one hour (`max-age=3600`). Those answers sit under old-`mv` URLs that the app no longer requests, so they are never mixed with new data. We assume a new deployment starts with an empty network cache for its own responses; the trial deploy checks this. Old model versions are not kept online. Their evaluation results stay in the repository history and the release assets.

| Responses | Header |
|---|---|
| `fleet`, `fleet/trend`, `assets/*`, `model/*` (with `mv`) | `Cache-Control: public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400` |
| `/metadata` | `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` |
| `/health`, `POST /plan`, all errors | `Cache-Control: no-store` |

Vercel's docs say the cache key is the request URL and ignore query strings only for static files. We assume function responses are keyed by the full query string; the spike checks this. If so, only repeated questions (the default view, the visitor guide) come from cache, and a visitor stepping through new hours and cut-offs still reaches the function.

| Endpoint | Returns |
|---|---|
| `GET /health` | Status, model version |
| `GET /metadata` | Model version and date, splits, replay window and start, default cut-off, machines, data credit |
| `GET /fleet?at&cutoff&machine_model&status&machine` | Cards, 10-bin distribution, ranked rows (≤100, each with its latest error type and hour, strictly before `at`, or null); Alert count from the same rows |
| `GET /fleet/trend?at&cutoff&range&filters` | Machines in Alert per hour, ≤168 points |
| `GET /assets/{id}?at&cutoff` | Model, age, score, status, last 7 days of errors and repairs, past estimates and failures |
| `GET /assets/{id}/telemetry?at&range=24h\|7d` | ≤168 hourly rows |
| `GET /assets/{id}/explanation?at` | Top 8 contributions plus "all others", with the patterns-not-causes caveat |
| `POST /plan?mv` | Planner list, shortlist and totals (decisions 16, 21, 23). Body and rules: decision 63. Stores nothing, `no-store` |
| `POST /plan?mv` with `level: "component"` | Component planner (decisions 77, 79): parts ranked by chance before the next assumed weekly shutdown window x part cost, crew slots per window, `horizon_days` 7 or 14 (default 14), at most 100 rows. No alert cut-off for the wear view. Needs the optional component files in the bundle, otherwise 503. `no-store` |
| `GET /assets/{id}/components?mv&at&horizon_days` | One machine's four parts: wear chance, chance before its next window, 48-hour warning, days since replacement. Same cache rule as the other data endpoints |
| `GET /model/metrics` | `evaluation.json` for both models |
| `GET /model/threshold-analysis` | Both models at every whole-percent cut-off from 0 to 100 |

**Validation:** `at` is an hour inside the replay window; `cutoff` a whole percent 0–100; machines 1–100, else 404. Planner costs 0–10,000,000 whole units; crew slots 0–100; risk reduction off or 0–90% in 5-point steps. Out-of-range values are refused, never adjusted. Every record returned is stamped strictly before `at`, as the model saw it. **Size limits:** at most 168 time points or 100 machines per response. Target: every response under 256 KB (Vercel's cap is 4.5 MB). Tests check the largest allowed request per endpoint once the API exists. The browser never loads the history.

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

**Every pull request** runs lint, type checks, pytest, Vitest, Playwright with axe (on a small synthetic test bundle that a release check keeps out of builds), pip-audit, npm audit and a secret scan. The full pipeline needs the 80 MB download, so it runs on demand and before release; it includes `evaluate.py --verify`, which must match the saved `evaluation.json`.

## Hosting at C$0/month

**Bundle format and size estimate** (not measured). One folder per model version: uncompressed NumPy arrays on a dense machine × hour grid (no stored keys), 4-byte floats and 1-byte feature codes, plus small JSON files for events, metadata and metrics. For 142,300 test machine-hours: scores ~0.6 MB; top-8 explanations plus "all others" ~6.3 MB; telemetry for test plus the 7 days before (1,591 hours × 100 machines × 4 sensors) ~2.5 MB; events and metrics <1 MB. About 10 MB; the 10–15 MB range allows for overhead. No compression is assumed (a stored copy may be zipped; the function reads it uncompressed). The spike measures real bytes. **Storage:** each version's bundle is attached to a GitHub release with its hash recorded, never committed (decision 48, Lead default). The build downloads it and checks the hash.

| | (a) Vercel + Render free | (b) One host for both | (c) All on Vercel |
|---|---|---|---|
| Wake-up | Render sleeps after 15 idle minutes; waking "takes about one minute" | On Render, the whole site waits, not just data | No idle sleep stated; cold starts not documented |
| Compute | 0.1 CPU, 512 MB | Render: same. Hugging Face Docker Spaces now need a paid plan | 2 GB, 1 virtual CPU; 500 MB Python bundle; 4.5 MB response |
| Monthly limits | 750 instance hours | Same | 1M calls, 4 CPU-hours, 100 GB transfer; over limit, wait 30 days |
| Caveat | Render: "Do not use them for production" | Not C$0 on Hugging Face | Static-files-only variant has no server, but moves validation and planner to the browser and drops FastAPI |

**Vercel Python status, as read 2026-11-13.** The runtime page (vercel.com/docs/functions/runtimes/python, updated 12 Aug 2026) shows no Beta label in its text. It links the changelog "Python on Vercel is now generally available" (published 15 Oct 2026). Only Large Functions is marked "(public beta)". Default Python is 3.12, and the bundle limit is "500 MB uncompressed". **Services** (several apps in one project) says "Services are available in Beta on all plans". The reviewer read the runtime page as Beta and Services as "Private Beta"; both pages say otherwise today. The runtime page files `/api` folder functions under "Existing projects using `/api`" and tells new projects to use `tool.vercel.entrypoint`. It does not say whether either form runs beside Next.js in a new project without Services.

**Recommendation: (c), conditional on a deploy spike.** The design uses an **ordinary Vercel Python function**: FastAPI inside the Next.js project, wired by the documented entrypoint (or the `/api` folder if that is what works). It does **not** use Services. Moving to Services needs a new decision, because Services is beta. Why (c): no minute-long wake-up, one origin, and the FastAPI contract stays. It becomes the choice only if the project-skeleton spike passes all of these on a new Hobby project:

1. **Routing:** `/api/v1/*` reaches FastAPI and every other path reaches Next.js, in one project and one deployment.
2. **Bundle:** the Python function, with its dependencies and the real bundle, is under 500 MB uncompressed. Bytes are recorded.
3. **Cold start:** measured over 10 cold requests. Pass if the median is under 3 s and the worst is under 10 s.
4. **Response size:** the largest allowed request for each endpoint stays under the 256 KB target, and none comes close to 4.5 MB.
5. **Caching and limits:** a repeated GET returns a cache HIT with the headers above, a different query string is a MISS, and the rate-limit rule returns 429 when it should.
6. **Hobby eligibility:** Vercel's Terms (section 4, updated 19 Oct 2026) say: "You shall only use the Services under a Hobby plan for your personal or non-commercial use." The part of the terms we read, and the Hobby and fair-use pages, neither define "commercial" nor mention portfolios. The owner confirms in writing that the demo is personal and non-commercial (no ads, no paid work, no client or employer use).

**Fallback (a), Vercel frontend + Render free backend,** if any of criteria 1–5 fails and cannot be fixed within the spike. Its "waking up" screen is already designed. If criterion 6 fails, the fallback does not help (its frontend is also on Vercel Hobby), so hosting goes back to the owner.

Sources, all read 2026-11-13: vercel.com/docs/functions/runtimes/python; /changelog/python-on-vercel-is-now-generally-available; /docs/services; /docs/functions/limitations; /docs/plans/hobby; /docs/limits/fair-use-guidelines; /legal/terms; /docs/caching/cache-control-headers; /docs/caching/cdn-cache; /docs/caching/cdn-cache/purge; /docs/vercel-firewall/vercel-waf/rate-limiting; render.com/docs/free, /docs/compute-plans; huggingface.co/docs/hub/en/spaces-overview, /docs/hub/main/spaces-gpus.

## Security

Read-only; the one POST stores nothing. Pydantic validates every input.

**Rate limiting.** No in-app counters, because each instance would keep its own count. Instead there is one Vercel WAF rate-limit rule (Hobby: 1 rule, keyed by IP, fixed window 10 s–10 min, counted per region): path starts with `/api/`, at most 300 requests per 60 s per IP, otherwise 429. The spike sets the real number at about 3 times one visitor's peak during replay. Behind the rule: strict input bounds, response caps, and cheap deterministic work (array lookups; the planner sorts at most 100 machines). Target: median active CPU per uncached request under 20 ms, about 720,000 uncached requests in the 4 CPU-hour monthly allowance. The spike measures it.

**Residual risk:** many IPs, or one IP across regions, can still use up the allowance. On Hobby that pauses the function until the 30-day reset; it does not create a bill. The site shows its error state, or the owner moves to fallback (a). Accepted for a portfolio demo.

No secrets in the frontend or repository; `.env*` gitignored. Lockfiles, Dependabot, audits, secret scan. No stack traces in responses.

## Reproducibility

Python 3.12 with `uv.lock`; `package-lock.json`; fixed seeds for models and SHAP. `make train`, `make evaluate` (once per version), `make verify` (read-only re-check), `make replay`. Model version `piq-<date>-<8-character hash of data hashes, config and commit>`, shown on screen. `evaluation.json` records splits, cut-off, calibration, metrics and library versions.
