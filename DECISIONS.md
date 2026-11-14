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

## Pending owner decisions
- None at present.
