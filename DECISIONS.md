# Decision log

Plain log of decisions. Newest last. Owner approval is noted where given; otherwise the decision is proposed.

## 2026-11-13

**1. Adopt staged gates.** Work runs in order: data check → product brief → requirements → user-experience design → architecture → build in stories. No stage starts until the owner approves the one before. An independent reviewer checks each stage before owner approval. *Status: adopted by owner instruction.*

**2. Data source.** Use Microsoft's copy of the Predictive Maintenance Modelling Guide sample dataset in `microsoft/sqlworkshops`, pinned to commit `e836f4e8…`. Raw files are not committed. A download step will fetch them from the pinned commit and fail if any SHA-256 differs from `docs/DATA_PROVENANCE.md`. *Status: Approved by Meysam (Owner), 2026-11-13 8:41 PM ET.*

**3. Describe the data as simulated.** Microsoft describes the dataset as simulated. All docs and screens say "simulated sample data published by Microsoft". Never real, live, or from a mine or named company. *Status: adopted (fact from the data check).*

**4. Brief's original link replaced.** The brief links `Azure/AI-PredictiveMaintenance`. That repository holds a data generator, not the dataset files. The older gallery and template links no longer connect. The `microsoft/sqlworkshops` copy is the surviving Microsoft-owned source. *Status: adopted (fact from the data check).*

**5. Requirements draft follows the brief's milestones.** The requirements and stories keep the brief's five milestones (M0–M4). M0 is split into the staged documents plus a project skeleton. The model performance page stays in M4, as in the brief. *Status: Approved by Meysam (Owner) with the requirements, 2026-11-13 8:41 PM ET.*

**6. Planner shows expected exposure, not savings.** Ranking uses chance of failure × user-set illustrative cost. A benefit figure appears only if the user sets an assumed risk reduction. *Status: Approved by Meysam (Owner) with the requirements, 2026-11-13 8:41 PM ET.*

## 2026-11-13, owner decisions (8:41 PM ET)

**7. Data license: use the data and publish with the draft credit line.** The credit line in the data provenance document is applied as written. *Status: Approved by Meysam (Owner), 2026-11-13 8:41 PM ET.*

**8. Simulated data is acceptable for the portfolio framing.** *Status: Approved by Meysam (Owner), 2026-11-13 8:41 PM ET.*

**9. Gate 0 (data check) approved; requirements and stories approved.** The user-experience design stage may start. Architecture waits for the design gate. *Status: Approved by Meysam (Owner), 2026-11-13 8:41 PM ET.*

**10. Independent reviewer model: Codex with gpt-6-sol at medium reasoning effort** (plain "gpt-6" is not available on the owner's ChatGPT-linked Codex account). *Status: Approved by Meysam (Owner), 2026-11-13 8:41 PM ET.*

## 2026-11-13, user-experience design (proposed)

**11. Model alerts are amber; red means a recorded failure only.** The brief reserves red for verified risk. A prediction is not verified, so the "Alert" tag is amber. Red marks failures that really appear in the data. Error messages also use amber, with an icon. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**12. Two status levels: "Alert" and "Below cut-off".** A middle "watch" level would need a second, arbitrary cut-off. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**13. One shared alert cut-off.** The same value drives Fleet Overview, Asset Details tags, the Planner and the Model Performance explorer, and sits in the web address. Its default is chosen on validation data. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**14. Fleet and Asset Details show the main model only.** The baseline appears only on Model Performance. We read "filter by model" in the brief as the machine model (model1–model4). *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.; owner to confirm.*

**15. Controls appear only where they do something.** Replay controls are read-only on Model Performance (it covers the whole test period) and on About & Data. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**16. Planner costs can be set per machine model.** With one cost for every machine, ranking by exposure equals ranking by risk. An optional per-model cost makes the cost lever visibly matter. Net benefit appears only after the user sets an assumed risk reduction. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**17. Asset Details is a full page, not a drawer.** It can be linked and shared, and works the same on mobile. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**18. Light surfaces only in the first release; wireframes are greyscale.** Colour lives in the tokens. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**19. Model comparison colours: teal (main, solid) and violet (baseline, dashed).** A slate-grey baseline failed the colour-blind separation check; teal and violet pass. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**20. Input edge colour darkened to #768295.** The earlier #8792A2 measured 2.94:1 on the page background, below the 3:1 minimum. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**21. (2026-11-13) Exactly what each Planner input changes.** Only per-model costs change the order; one shared failure cost scales exposure; planned cost, crew slots and the risk-reduction assumption change spend, shortlist or net benefit, not the order; the cut-off and "also list below" change which machines are listed. The experience spec holds the full table, and each input says what it changes on screen. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET. Responds to design review finding 2.*

**22. (2026-11-13) The visitor guide demonstrates a per-model cost change.** Step 3 now asks the visitor to raise one machine model's failure cost, which really reorders the list and shows "Moved" marks. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**23. (2026-11-13) Machines below the cut-off are never shortlisted.** "Also list below the cut-off" shows them for context only. Spare crew slots stay empty and the summary says so. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET.*

**24. (2026-11-13) Model Performance leads with one main-vs-baseline table at the shared cut-off.** It covers precision, recall, precision–recall area, the four right/wrong counts, false alerts per 100 machine-days, share of failure events caught and calibration gap, with the held-out test period and cut-off stated above it. It replaces the four headline cards and the separate right/wrong table. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET. Responds to finding 3.*

**25. (2026-11-13) Filtered-to-nothing shows zeros, not dashes or old shapes.** Every Fleet card and chart describes the filtered population of 0 machines. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET. Responds to finding 1.*

**26. (2026-11-13) Sliders are native range inputs; mobile controls are at least 44px.** Each slider shows its label, minimum, maximum and current value; keyboard steps are written in the experience spec. *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET. Responds to finding 5.*

**27. (2026-11-13) "Full data record" opens the public data provenance page in the repository.** *Status: Approved by Meysam (Owner) with the design gate, 2026-11-13 9:26 PM ET. Responds to finding 6.*

## 2026-11-13, owner decisions (9:26 PM ET)

**28. Planner design accepted; requirements wording updated to match.** Only different failure costs per machine model reorder the list. Crew slots change the shortlist, and the alert cut-off changes which machines are listed. The requirements now say exactly that. *Status: Approved by Meysam (Owner), 2026-11-13 9:26 PM ET.*

**29. The baseline appears only on the Model Performance page.** Fleet Overview and Asset Details show the main model only. *Status: Approved by Meysam (Owner), 2026-11-13 9:26 PM ET.*

**30. The replay starts at an hour where a machine is already in Alert, chosen by a fixed rule.** Rule, written before any results exist: the first hour of the held-out test period at which at least one machine's main-model score is at or above the default alert cut-off. The default cut-off is set on validation data only. If no hour qualifies, the replay starts at the first test hour and says so. The screen states how the start hour was chosen. *Status: Approved by Meysam (Owner), 2026-11-13 9:26 PM ET (rule wording by the orchestrator, per the owner's instruction).*

**31. Design gate approved.** The architecture stage may start. *Status: Approved by Meysam (Owner), 2026-11-13 9:26 PM ET.*

## 2026-11-13, architecture (proposed)

Full detail in `docs/architecture.md`.

**32. No live inference in the first release.** The app shows only precomputed test-period scores. The server holds no model libraries, so training and serving features cannot differ. Any later live scoring must import the training feature code; a mismatch is a release blocker. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**33. One as-of rule for every record type.** Scoring hour *t* happens at the start of the hour. Records stamped at *t* (telemetry, errors, maintenance, failures) are not available; features use records up to *t*−1h. Reason: 702 of 719 failure events have a same-hour repair record. The data service also returns only records stamped before the replay time. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**34. Label rules.** Positive if a failure event falls in (*t*, *t*+24h]. Failure rows sharing a machine-hour are one event. Hours after a failure are kept and labeled the same way. Failure coverage cannot be proven past the last observed failure (2015-12-31 06:00), so any hour whose window passes it is unlabeled and dropped; the last scored hour is 2015-12-30 06:00. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13; censoring rule revised after independent review (High finding).*

**35. Features and warm-up.** Telemetry last value, 3h/24h mean and spread, 24h slope; 24h error counts by type; hours since each component's last replacement (strictly earlier records); machine model and age. Longest window is 24h, so the first scored hour is 2015-01-02 06:00. No feature comes from the failure table. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**36. Split dates with 24-hour embargoes.** Train 2015-01-02 06:00 to 2015-08-30 23:00; embargo 31 Aug; validation 2015-09-01 to 2015-10-30 23:00; embargo 31 Oct; test 2015-11-01 00:00 to 2015-12-30 06:00 (142,300 machine-hours), evaluated once. The test period is also the replay window. Events by event time: train 473, validation 109, test 110 (3 on each embargo day, 17 before the first scored hour, 4 after the last scored test hour). 107 test events have their full 24-hour lookback inside scored test hours. The data stage re-checks these counts before fitting. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13; test end moved from 2015-12-31 06:00 after independent review.*

**37. Calibration and default cut-off chosen on validation only.** Calibration: none or sigmoid, by validation Brier score. Default cut-off: the whole percent with the best validation F1, ties to the higher value (whole percent matches the slider's 1-point steps). Models train on the train period only. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**38. Event-level measures.** An event is caught if any alert occurred in the 24 hours before it; only events with a full lookback inside the test hours count. A run of consecutive alert hours on one machine is one alert, false if none of its hours is positive. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**39. Replay start computed offline.** Decision 30's rule runs on saved test scores in `ml/replay.py`; the hour and branch (rule or fallback) are stored in `metadata.json`. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**40. Data service contract.** Nine read-only GET endpoints under `/api/v1` plus one POST for the planner, which stores nothing. Cut-off is a whole percent. Fleet responses hold at most 100 machines; time series at most 168 points; target of every response under 256 KB, checked by tests once built. Out-of-range input is refused, not adjusted. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**41. Hosting: one Vercel project (Next.js + FastAPI as an ordinary Python function, not Vercel Services), C$0/month, conditional on a deploy spike.** Vercel's Python runtime page (read 2026-11-13) shows no Beta label and links the changelog "Python on Vercel is now generally available" (15 Oct 2026). Services says "available in Beta on all plans" and is not used. The runtime page lists `/api` folder functions under "Existing projects" and points new projects to `tool.vercel.entrypoint`; whether either runs beside Next.js without Services is undocumented, so the spike must prove it. Reason: no 15-minute sleep and one-minute wake-up as on Render's free tier, one origin, FastAPI kept. The skeleton-stage spike must pass: routing in one project; Python bundle under 500 MB; cold start measured (median under 3 s, worst under 10 s); largest responses under 256 KB; cache HIT (and query string in the cache key) and 429 rule working; and Hobby eligibility ("personal or non-commercial use", Terms section 4) confirmed by the owner for a non-commercial portfolio demo. Fallback: Vercel frontend + Render free backend if any technical criterion fails. If eligibility fails, hosting returns to the owner. Rejected: one host on Render free (whole site sleeps); Hugging Face Docker Spaces (now need a paid plan). *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13; made conditional after independent review. Owner holds deploy credentials.*

**42. Serving bundle delivered by version, not committed raw data.** A ~10–15 MB (estimate: uncompressed NumPy arrays on a machine × hour grid plus small JSON files, no compression assumed, measured in the spike) bundle of derived scores, explanations, test-period telemetry and events is built offline per model version and checked by hash at build time. Where it is stored (repository or release asset) is for the owner. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**43. Reproducibility.** Python 3.12 (Vercel's default) pinned with `uv.lock`; `package-lock.json`; fixed seeds; `make train` / `make evaluate` / `make verify` / `make replay`; model version `piq-<date>-<8-character hash>`; `evaluation.json` with splits, cut-off, calibration, metrics, library versions. `evaluate.py --write` runs once per model version and never overwrites. `evaluate.py --verify` recomputes the test metrics, compares them with the saved file, writes nothing and fails on mismatch. No setting may be changed because of test results. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13; verify mode added after independent review.*

**44. Pull-request checks.** Lint, type checks, pytest, Vitest, Playwright with axe on a synthetic test bundle (kept out of release builds by a check), dependency audits and a secret scan on every pull request. The full pipeline runs on demand and before release. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13.*

**45. Rate limiting and caching.** Data GETs carry `mv=<model_version>` and `Cache-Control: public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400`. `/metadata` uses `s-maxage=60, stale-while-revalidate=300`. `/health`, `POST /plan` and errors use `no-store`. There is no per-instance limiter. Instead there is one Vercel WAF rate-limit rule (available on Hobby: 1 rule, IP key, 10 s–10 min window): `/api/*`, starting at 300 requests per 60 s per IP and set in the spike. Behind it: input bounds, response caps and cheap lookups. Residual risk: requests spread over many IPs can use up the 4 CPU-hour allowance; on Hobby the result is a pause until reset, not a bill. Both are verified in the spike. *Status: Approved by Meysam (Owner) with the architecture gate, 2026-11-13 10:03 PM ET; originally proposed, 2026-11-13; rewritten after independent review.*

## 2026-11-13, owner decisions (10:03 PM ET)

**46. Architecture gate approved.** Build in stories may start, beginning with the project skeleton. Decisions 32–45 are approved with the gate. *Status: Approved by Meysam (Owner), 2026-11-13 10:03 PM ET.*

**47. PredictIQ is a personal, non-commercial portfolio demo.** This meets Vercel Hobby's "personal or non-commercial use" condition, check 6 of the trial deploy. *Status: Approved by Meysam (Owner), 2026-11-13 10:03 PM ET.*

**48. The serving bundle (precomputed scores, explanations, test-period telemetry) is attached to a GitHub release, not committed.** Each model version gets its own release asset with a recorded hash. *Status: Lead default, owner can override (owner did not choose), 2026-11-13.*

**49. Test window confirmed:** 1 Nov 2015 00:00 to 30 Dec 2015 06:00. *Status: Approved by Meysam (Owner), 2026-11-13 10:03 PM ET.*

**50. Add the unseen-machine test.** A machine-held-out experiment is documented now and built in the data-and-model stage. A fixed, seeded set of machines is kept out of training and validation entirely and scored on the same test period. The app may describe performance on unseen machines only from this experiment's results, labeled simulated. *Status: Approved by Meysam (Owner), 2026-11-13 10:03 PM ET.*

**51. Only the latest model version is served.** Requests for any other version get "not found" without caching. Old versions' evaluation results stay in the repository history and release assets. This resolves the caching contradiction raised in the architecture re-check. *Status: Approved by Meysam (Owner), 2026-11-13 10:03 PM ET.*

**52. Hosting decision 41 stays open.** The trial deploy builds and deploys on Vercel, but the live checks could not be measured because the protected preview cannot yet be reached by a sanctioned route. Under "no evidence means not met" it neither passes nor falls back to Render. Only the non-commercial check is met (decision 47). *Status: Lead record, 2026-11-13 11:10 PM ET; needs Meysam to grant access, then re-measure.*

## 2026-11-14

**53. Hosting decision 41: stays on Vercel. Every check the skeleton can test was met, and two are measured again later.**
- One project serves both parts.
- Cold start median is 1.50 s and worst is 1.66 s (n=10, end-to-end from the build machine).
- The cache serves HITs and MISSes as designed.
- The rate-limit rule returns 429. This was shown at a temporarily lowered limit.
- Non-commercial use is confirmed.
- **Measured again in the data-and-model stage**, because the real model bundle and data endpoints don't exist yet:
  - the data service size, now about 6.5 MB;
  - the largest response, now 10,879 bytes.

The Render fallback is not used unless one of those later checks fails. This supersedes decision 52. *Status: Lead record from measured evidence, revised after independent review, 2026-11-14 1:20 AM ET; the owner can review it with the skeleton story.*

**54. Vercel settings changed in the trial (all approved).**
- One free firewall rate-limit rule on this project: paths starting with /api/, at most 300 requests per 60 seconds per address, otherwise 429. It was approved by Meysam (Owner) on 13 Nov 2026. For the 429 test it was lowered to 20 for about 30 seconds and then set back.
- The Vercel command-line tool, signed in as the owner, created one "protection bypass for automation" secret for this project only, so that live checks could reach the protected preview. The secret is kept out of the repository and reports, and it can be revoked in the project's settings.
- Deployment protection stayed on.
- Ten extra preview copies of this branch were made for timing and left in place.

Nothing went to production, and no domains or environment variables were added. *Status: Lead record, 2026-11-14 1:15 AM ET.*

## 2026-11-14, data service (session 3)

**55. Example planner costs: proposed, owner to confirm.** These are **illustrative, not real**: the dataset has no money figures. They live in `backend/app/config.py` and are returned by `/metadata` as `planner_defaults`, labelled "illustrative". They are placeholders so the planner can be built and tested; the owner may replace them.

| Machine model | Cost if a failure happens | Planned repair cost |
|---|---|---|
| model1 | 10,000 | 2,500 |
| model2 | 8,000 | 2,000 |
| model3 | 12,000 | 3,000 |
| model4 | 9,000 | 2,250 |

Crew slots: 5. Why these numbers: round figures that differ a little by model (so the "cost per machine model" ordering feature has something to show); a planned repair costs a quarter of an unplanned failure (the planner's point is that planned is cheaper; the quarter is an assumption, not a finding); 5 crew slots is a visible shortlist out of 100 machines. Units are "illustrative currency units". Allowed input ranges stay 0 to 10,000,000 and 0 to 100 slots (architecture). *Status: Approved by Meysam (Owner) as proposed, 2026-11-14 9:53 AM ET; still illustrative units.*

**56. Serving details (Lead default).** Explanations come from XGBoost `pred_contribs` (no `shap` package); the bundle is about 10.1 MB; scores and contributions are served rounded to 6 decimals and ranking, status and alert counts all use those rounded numbers; a missing `mv` is a 400, another `mv` a 404 (both `no-store`); `at` is `YYYY-MM-DDTHH:00[:00]`, out-of-window and malformed values are 422. *Status: Lead default, 2026-11-14.*

**57. How the model data reaches a deployment (Lead default, owner to decide for launch).** The serving bundle lives on a GitHub pre-release of this private repository, not in git (decision 48). Vercel's own branch builds can't download it without a stored access key, and we don't add secrets. So:
- **Branch previews** run without model data. The data questions answer "model data unavailable", and the health check says no model is loaded.
- **For checks and demos,** the bundle is fetched on the build machine (hash checked), then built and uploaded as a protected preview.
- **For the public launch:** Meysam chose to make the repository public, so that Vercel's builds can download the release bundle without a stored key. This happens only at the launch gate, with his go-ahead, and not before.
- **Until then:** the repository stays private, and live checks use previews built on the build machine and kept protected.

*Status: Approved by Meysam (Owner), 2026-11-14 9:53 AM ET.*

**58. Builder model for this stage.** Every part was built by Claude Code Sonnet at medium effort. No part needed Opus: the modelling followed the approved architecture with standard methods. *Status: Lead record, 2026-11-14.*

## 2026-11-14, owner decisions (9:53 AM ET)

**59. Data-and-model gate approved.** Stage 3 may start. Decisions 55 and 57 are resolved as recorded above. *Status: Approved by Meysam (Owner), 2026-11-14 9:53 AM ET.*

## 2026-11-14, owner decisions (12:24 PM ET)

**60. Core-screens gate (M2) approved.** Stage 4 may start. *Status: Approved by Meysam (Owner), 2026-11-14 12:24 PM ET.*

**61. Machine details show the last 7 days of repairs, not the 90 days in the wireframe.** *Status: Approved by Meysam (Owner), 2026-11-14 12:24 PM ET.*

**62. Dependency update requests are held until after Stage 4.** These are the automatic update pull requests for typescript, pydantic, eslint, pydantic-core and fastapi. Once Stage 4 is done, they will be tested together on a separate branch. Until then, nobody touches them. *Status: Approved by Meysam (Owner), 2026-11-14 12:24 PM ET.*

**63. `POST /plan` request and response shape (Lead default, 2026-11-14).** JSON body, `mv` in the query like every other call (missing 400, other 404, both `no-store`). Fields: `at`, `failure_cost`, `planned_cost`, `crew_slots` (required); `cutoff_percent` (default: the model's), `failure_cost_by_model` and `planned_cost_by_model` (optional, keys model1 to model4; see decision 64), `risk_reduction_percent` (null = off, else 0 to 90 in steps of 5), `include_below_cutoff` (default false). Costs are whole numbers 0 to 10,000,000, slots 0 to 100. JSON integers only: 5.0, "5", true and null are refused, as are unknown fields and bodies over 4,096 bytes (413, refused on a longer declared Content-Length before reading and by stopping the read once 4,096 bytes are exceeded, so chunked bodies are covered); the message names the field and the allowed range and never echoes the value. Exposure is computed in exact integers (score in millionths × whole-unit cost), so ties are real ties. Ranking: exposure, then higher chance, then lower machine number. "Moved" is present only when the four effective model costs are not all equal, and compares with the order by chance alone among the same listed machines. A 0% risk reduction counts as "on" (net benefit = minus planned spend); null is off. Responses carry `label: "illustrative"` and never use the word savings. *Status: Approved by Meysam (Owner), 2026-11-14 3:26 PM ET (kept at M3 approval).*

**64. Planner screen starting values (Lead default where marked; reconciled with decision 55, 2026-11-14).** Decision 55, approved by the owner, sets BOTH a failure cost and a planned repair cost for each machine model (failure: 10,000 / 8,000 / 12,000 / 9,000; planned: 2,500 / 2,000 / 3,000 / 2,250 for model1 to model4). The planner follows it, so planned cost is no longer a Lead default of 2,500. What deviates from the spec's single-field wording, and why:
- **Planned cost is per machine model.** `POST /plan` takes `planned_cost` (the shared fallback, still required) and an optional `planned_cost_by_model` (keys model1 to model4, same 0 to 10,000,000 range). Planned spend is the sum, over the shortlisted machines, of each one's model's planned cost; each machine's net benefit uses the same figure. Planned cost still never changes the order or who is shortlisted.
- *(Superseded by decision 65; kept as history.)* **The screen kept the spec's "Planned maintenance cost" input** (and its "Cost if a failure happens" input), but both were the shared fallback for any machine model whose own field is blank. The four per-model planned costs sit next to the four per-model failure costs inside the "Set cost per machine model (optional)" panel. This is the one small deviation from the spec's single planned-cost field; it exists so the approved decision 55 values are the real starting values rather than only model1's.
- **The per-model failure cost fields start filled with the decision 55 values**, not blank (session 2 had left them blank with a shared 10,000, which ignored decision 55). Consequence: the list opens ordered by expected exposure with the "Moved" column showing against the order by predicted chance alone, which is exactly how the spec defines "moved" (the uniform-cost order is the order by chance). The visitor guide step (decision 22) still works: the visitor RAISES one model's cost in its own (always visible) field, and machines of that model can move up. Amended by decision 65: the shared inputs are now "Set every machine model to" controls with an "Apply to all models" button, so they no longer start inert and blank per-model fields are no longer a fallback.
- Reset to defaults restores all of these. Both sets of defaults come from `/metadata` `planner_defaults` (decision 55) with the same numbers as built-in fallback.
Still Lead defaults: crew slots start at 5; the risk-reduction assumption is **off**, and when switched on the slider starts at 20% (an illustrative guess, 0 to 90 in 5-point steps); the "Set every machine model to" fields start at 10,000 (failure) and 2,500 (planned), model1's values, and change nothing until Apply is pressed (decision 65). Planner inputs are not kept in the web address (the spec puts only replay time, cut-off and machine there); they reset on reload. All amounts are in "illustrative currency units". *Status: Approved by Meysam (Owner), 2026-11-14 3:26 PM ET (kept at M3 approval).*

**65. Shared costs apply to all models (Lead default, owner may amend, 2026-11-14).** Independent review found the shared "Cost if a failure happens" and "Planned maintenance cost" inputs did nothing at the starting values, because all four per-model fields start filled (decision 55). UI-only fix; `POST /plan` and the decision 55 starting values are unchanged. Each shared input becomes a "Set every machine model to" control with an "Apply to all models" button that writes the value into the four per-model fields (failure or planned). The per-model fields are the main inputs, visible by default and prefilled with decision 55's values; they must be filled (blank is a range error). The shared value is range-checked as before (message, last result kept). The request sends model1's current value as `failure_cost` / `planned_cost` plus both per-model maps. Help text matches the ux-spec table: equal costs give the order by predicted chance alone and leave Moved empty; failure costs that differ by model can change the order and, at some hours, who is shortlisted; planned cost never changes the order or shortlist. Reset restores decision 55 values. *Status: Approved by Meysam (Owner), 2026-11-14 3:26 PM ET (kept at M3 approval).*

**66. Maintenance-planning gate (M3) approved.** PR #31 merged (6a33938); planner defaults in decisions 63 to 65 kept. Stage 5 waits for the owner's go. *Status: Approved by Meysam (Owner), 2026-11-14 3:26 PM ET.*

**67. Dependency updates tested together on branch `deps-nov14`** (decision 62): the five automatic update pull requests #24 to #28 are tested together on one branch: four are included (#25, #26, #27, #28) and TypeScript 7 (#24) is left out because typescript-eslint does not support it yet. The original pull requests are left for Meysam to close. *Status: Approved by Meysam (Owner) earlier; carried out 2026-11-14.*

## 2026-11-14, Stage 5 session 1 (Model Performance page)

**68. Where the saved evaluation does not match the spec's wording exactly, and what the page does (Lead default, owner may amend, 2026-11-14).** The page reads `/model/metrics` (evaluation.json) and `/model/threshold-analysis` (threshold_analysis.json) for the "all 100 machines" group and recomputes nothing from scores. Five places needed a choice:
- **Evaluation date (corrected 2026-11-14, fix session 2b).** evaluation.json has no date of its own, and the evaluation is run as a separate step after training (`make evaluate`), so the model's build date is not the date the results were produced. The page therefore labels the date from `/metadata` (`model_created`, the date inside the version name) "Model built" and says in one sentence that the date the saved results were produced is not recorded. The earlier label "Evaluation date" and the sentence "Every number on this page comes from the saved evaluation" were too strong and were removed: the results come from the saved evaluation; the version and build date come from the model record. If `model_created` is missing it shows "—".
- **Precision at a cut-off with no alerts.** The saved cut-off table stores precision as null when no alert is raised (for example at 100%). The cell shows "—" with "(no alerts at this cut-off)". Recall and the other rows show their saved values. A cut-off that is missing from the saved table would show "—" with "(not in the saved cut-off table)" in every cut-off row; the real and the test bundles have all 101 cut-offs, so this only shows if the file is damaged.
- **Alerts per day by cut-off** is not stored. The chart shows the saved alert count (runs of consecutive alert hours on one machine count once) divided by the days in the test period (saved hours ÷ 24), across all machines. Arithmetic on two saved numbers, stated in the chart's summary.
- **Accuracy figures** ("why accuracy misleads") are not stored either. They are (caught + quiet and correct) ÷ all machine-hours at the shared cut-off, and (machine-hours − failure hours) ÷ machine-hours for a rule that always says "no failure", all from saved counts. If the four counts at a cut-off do not add up to the saved machine-hour total, the cell shows "—".
- **Curves are drawn from the saved points**: the precision–recall curves from the 101 saved cut-offs per model (cut-offs with no precision are left out), the calibration chart from the 10 saved groups per model. Nothing is smoothed or interpolated beyond the straight line between saved points. The seen / unseen machine groups in the saved files are not shown on this page.
*Status: Lead default, owner can override, 2026-11-14.*

**69. Dependabot pull requests after the dependency branch.** PR #32 was merged by Meysam at 3:49 PM ET (merge eafd576). Dependabot #25, #26, #27 and #28 were closed with the comment "Superseded by #32 (merged), per owner decision." #24 (TypeScript 7) stays open until typescript-eslint supports TypeScript 7. The Stage 5 branch `model-perf` targets main. *Status: Approved by Meysam (Owner), 2026-11-14 3:48 PM ET; carried out 3:50 PM ET.*

**70. Banner wording says "simulated" (Lead default, owner may amend at the launch gate, 2026-11-14).** The top notice on every page now reads "Portfolio demo — simulated historical sample data; estimated economics are illustrative." The old wording said only "historical sample data", so a visitor on a phone never saw the word "simulated" at the top; the story "Public release and limitations" asks for a simulated-data and illustrative-costs notice on every page. Changed in the component text, `docs/ux-spec.md`, the design notes, the project brief, the wireframes, the README and the tests. *Status: Lead default, owner can override at the launch gate.*

**71. Production bundle download in the build (Lead default, owner to approve at the launch gate, 2026-11-14).** Implements decision 57 once the repository is public. `frontend/scripts/fetch-bundle.mjs`, called by the prebuild (`sync-backend.mjs`):
- **When:** `VERCEL_ENV=production`: always, and a local `artifacts/<version>/bundle` folder is never trusted (the verified download replaces it; round 5 review). Otherwise only with `BUNDLE_FETCH=1` and no local bundle (a local bundle, as fetched and verified by `scripts/fetch_bundle.py`, is used as it is). `<version>` is the newest committed `artifacts/piq-*/manifest.json`.
- **What:** downloads `https://github.com/bavafa/predictiq/releases/download/bundle-<version>/bundle.zip` (no token; `BUNDLE_URL` overrides it for tests only, https or localhost http). Checks the size against the manifest, then the **SHA-256 against the committed manifest before anything is unpacked**, then allows only the ten file names of `scripts/fetch_bundle.py` (a test keeps the two lists equal), each once, no paths, encryption, zip64 or comment, matching sizes and CRCs, a 200 MB total cap, and `meta.json` with `"synthetic": false` and the right version.
- **Failure:** on `VERCEL_ENV=production` a missing, failed, mismatched or refused bundle **fails the build**: no production site that silently answers 503. Previews and local builds without the variables behave as before (no bundle, data endpoints answer 503).
- **No new dependency:** Node built-ins (`fetch`, `node:zlib`, `node:crypto`) are enough for a ten-file zip; reading it by hand is small, and every check runs before inflation, so a zip library was not added.
- **Proof:** `frontend/tests/fetch-bundle.test.ts`, `backend/tests/test_deploy_layout.py`, and `scripts/verify_bundle_download.sh` (localhost server, clean worktree; written but **not yet run**, because the session that wrote it was not allowed to run it; its log goes in `docs/QA_REPORTS/stage5-bundle-download.log`).
Nothing was deployed, no Vercel setting was changed and the repository stays private until the launch steps in `docs/LAUNCH_CHECKLIST.md`. *Status: Lead default, owner to approve at launch gate.*

## 2026-11-14, launch decisions (owner, evening ET)

**72. Fresh public repository.** To keep a personal author email out of public history, the old repository was renamed `bavafa/predictiq-archive` (private) and a new `bavafa/predictiq` was created from `main` with history kept and only that commit's author email rewritten to the no-reply address. The older internal path names and public Microsoft addresses found by the history scan stay in history (accepted). Open PRs, other branches and PR history stay in the archive. *Status: approved by Meysam.*

**73. No licence for the repository's own code** (all rights reserved; one file can be added later). *Status: approved by Meysam.*

**74. Production domain `predictiq-demo.vercel.app`**, replacing `predictiq-eight.vercel.app`, which now redirects to it (307). The Vercel project was re-linked to the new repository; protection is unchanged (Standard Protection). The `ignoreCommand` was removed so `main` builds as production. Branch protection on `main` requires the four CI jobs (e2e, frontend, python, security) and blocks force-pushes and deletion (GitHub offers it only on public repositories on this plan). *Status: approved by Meysam.*

**75. Illustrative machine types and assumed units.** The source names no machine types or units (checked 2026-11-15 against the sqlworkshops notebook and guides, the Microsoft blog and the Azure sample README). Telemetry is near-identical across machines, so types cannot be inferred from it; the only data-backed split is that comp3 fails only on model1 and model2. Display names: model1 = Centrifugal pump, model2 = Air compressor, model3 = Industrial mixer (age 0-10) or Exhaust fan (11-20), model4 = CNC spindle (0-10) or Conveyor drive (11-20); the age split is arbitrary, for variety. Units shown: V, rpm, psi, mm/s; vibration is displayed as source value / 10 (display only; the model uses source values). All labelled as best guesses on About & Data and "(assumed)" on charts. Lookup: `frontend/lib/machine-types.ts`. Renamed from "Reciprocating compressor" on 2026-11-15 so the Planner table fits its box (CI axe check). *Status: approved by Meysam, 2026-11-15.*

**76. Hatch-inspired palette and plain unit labels.** Colours taken from hatch.com on 2026-11-15 (orange-red #E84A37, slate #425563, charcoal #363636, light greys): sidebar slate #2B3843, primary buttons #C8341F (darker than #E84A37 so white text passes 4.5:1), links and sensor lines slate, focus ring and risk/main-model lines #E84A37. Semantic colours (alert amber, recorded-failure red, value labels) unchanged. Chart axes show only the unit (V, rpm, psi, mm/s); About & Data still says types and units are best guesses. All contrast checks pass. *Status: requested by Meysam, 2026-11-15.*

**77. Component-level planner, 14-day wear view.** Spec `docs/specs/component-planner.md`. Two layers per component: a 7 or 14 day wear estimate (part age, model, machine age; must beat a plain age-and-model rule) and a 48-hour component warning (the simulated data shows failure signatures only about 2 days ahead). Default horizon 14 days; one assumed weekly shutdown window per machine model; illustrative component names (comp1 Motor winding, comp2 Bearing, comp3 Seal / valve, comp4 Coupling), labelled as assumed. New model version beside the current one; Codex review. Gate after training: stop if the wear view does not beat the plain rule. *Status: approved by Meysam, 2026-11-15.*

**78. Wear input: a failure counts as a replacement (owner, 15 Nov 2026).** In the simulated data, 18 failures (all stamped 2015-01-02 03:00) have no replacement record. For the wear view's "days since replacement", the latest of replacement or failure of that part is used, so those parts do not look old right after failing. Found in the step 1 review (`docs/QA_REPORTS/component-planner-step1-claude-review.md`). The longer gap for 7, 14 and 48-hour labels (rows whose label window reaches the next period are dropped) is built in step 1 and was confirmed by the owner on 15 Nov 2026 (decision 81).

**79. The wear view is a ranking, not an alert (owner, 15 Nov 2026).** After the step 2 test result (`docs/MODEL_CARD.md`, "Component models"), the 7 and 14 day wear view is accepted as a ranking with weak lift over the base failure rate. It has no alert cut-off: the Planner ranks parts by chance before the next window times cost, and the crew slots per window decide what is shortlisted. Only the 48-hour warning has a cut-off (its validation default). The page says so.

**80. No Codex review for the component planner (owner, 15 Nov 2026).** The owner waived the independent Codex review for steps 1 to 4 of the component planner. Step 1 had a Claude subagent review (`docs/QA_REPORTS/component-planner-step1-claude-review.md`); steps 2 and 3 have no independent review, only the tests listed in their pull requests. This is an exception to the CLAUDE.md rule, for this feature only.

**81. Purge rule for the longer labels (owner, 15 Nov 2026).** For the 7-day, 14-day and 48-hour component labels, rows in train and validation whose label window reaches the start of the next period are dropped, because the 1-day gap between splits is shorter than those labels. For the 24-hour machine model it removes nothing. Built in `ml/component_labels.py` (`purge()`); the step 2 test result (`docs/MODEL_CARD.md`, "Component models") was produced with it, so no retraining is needed. *Status: confirmed by Meysam, 15 Nov 2026.*

**82. Redesign as a maintenance tool, stage 1: the shell (owner, 15 Nov 2026).** Spec and approach B approved by the owner on 15 Nov 2026 (no onboarding copy; folds component planner step 4 into Work plan; middle-path job state in the browser only). Stage 1 changes: nav names (Overview, Asset page, Work plan, Alert accuracy, In a real plant, About this demo; routes unchanged until stage 5); the header shows "Simulated plant time" and an "Advance 1 h" button, and the full controls (Start, Step back, Play, Step forward, Step size, timeline) sit in a "Time controls" panel that remembers it is open (localStorage); the "Historical replay" badge is gone; value tags are hidden by default behind a "Show data labels" switch but stay in each number's accessible name, and "Illustrative" tags (money) always show. Unchanged: the disclosure strip, palette (decision 76), the words "live", "now", "current" and "real-time" stay banned for replayed data. Tests that asserted the old copy were updated in the same change. *Status: approved by Meysam, 15 Nov 2026 (spec); stage 1 pending gate.*

## Pending owner decisions
- Launch gate (see `docs/LAUNCH_CHECKLIST.md`): go-ahead; the personal author email in commit `874a686` and the older internal paths in history (`docs/QA_REPORTS/stage5-history-scan.md`); a licence for this repository's own code; approval of decisions 70 and 71. (Vercel protection is Standard Protection, `all_except_custom_domains`; no change is expected, see the checklist, step 6.)
