# PredictIQ architecture gate review

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Saved verbatim; local file links refer to the orchestrator box._

**Recommendation: FAIL.** The proposed test window includes hours that the architecture’s own label rule says must be dropped. That can make the held-out evaluation materially wrong. The architecture is otherwise broadly aligned with the approved product design, but the test endpoint needs correction before this gate passes. No app code exists, so this review does not certify implementation.

## Findings

### High — The final 24 hours of the test set have incomplete labels

**Evidence:** [architecture.md:27](/workspace/predictiq/docs/architecture.md:27) drops any scored hour whose 24-hour outcome window passes the last failure record, but [architecture.md:52](/workspace/predictiq/docs/architecture.md:52) and [DECISIONS.md:87](/workspace/predictiq/DECISIONS.md:87) score through **2015-12-31 06:00**. A read-only query of `PdM_failures.csv` found its last event at **2015-12-31 06:00**. Under the stated rule, the last fully labeled scoring hour is **2015-12-30 06:00**. The proposed window contains **2,400 machine-hours** after that point; four failure events occur in those final 24 hours.

**Why it matters:** Treating those hours as negatives would bias test metrics and the replayed probabilities’ apparent outcomes. It conflicts with the PRD’s held-out evaluation requirement ([PRD.md:24–28](/workspace/predictiq/docs/PRD.md:24)).

**Recommended fix:** End scored test and replay hours at 2015-12-30 06:00, *or* document evidence that failure-event coverage extends through 2016-01-01 06:00 and define censoring from that verified coverage endpoint rather than the timestamp of the last observed event. Recalculate event denominators after choosing the rule. **Confidence: high.**

### Medium — The proposed Vercel configuration is less certain than stated

**Evidence:** [architecture.md:115–119](/workspace/predictiq/docs/architecture.md:115) recommends one Vercel project and calls the Python runtime “generally available.” Vercel’s [Python runtime documentation](https://vercel.com/docs/functions/runtimes/python) says **Beta**; its [Services documentation](https://vercel.com/docs/services) describes the explicit Next.js-plus-FastAPI, one-project arrangement as **Private Beta with access by request**. Vercel does document a [Next.js and Python example](https://vercel.com/kb/guide/how-to-use-python-and-javascript-in-the-same-application), so the arrangement is plausible, but the proposed repository layout and routing have not been deployed. The cited numerical Hobby limits are broadly supported by [Vercel’s limits](https://vercel.com/docs/limits) and [function limits](https://vercel.com/docs/functions/limitations); Render’s sleep and capacity figures match [Render’s free-tier documentation](https://render.com/docs/free) and [compute plans](https://render.com/docs/compute-plans). Hugging Face’s [Spaces documentation](https://huggingface.co/docs/hub/en/spaces-overview) supports the paid-plan restriction for new compute Spaces.

**Why it matters:** “One host, C$0/month” is a conditional recommendation, not yet a verified deployable configuration. Hobby use also carries [personal or non-commercial terms](https://vercel.com/docs/plans/hobby), which the architecture itself leaves unresolved.

**Recommended fix:** Correct the runtime status, specify whether the design uses ordinary Python functions or Vercel Services, and make the planned deploy spike an explicit decision gate with routing, bundle-size, cold-start and Hobby-eligibility results. **Confidence: high.**

### Medium — Cache protection and rate limits lack an enforceable contract

**Evidence:** [architecture.md:68](/workspace/predictiq/docs/architecture.md:68) and [DECISIONS.md:105](/workspace/predictiq/DECISIONS.md:105) assume GET responses are edge cached, but do not specify cache headers or versioned URLs. Vercel’s [cache documentation](https://vercel.com/docs/caching/cache-control-headers) says function responses default to `max-age=0, must-revalidate`; caching requires explicit headers. [architecture.md:123](/workspace/predictiq/docs/architecture.md:123) proposes a per-instance limiter for `/plan` and telemetry, which cannot impose a dependable limit across independently scaled instances.

**Why it matters:** The stated protection for the four CPU-hour allowance and expensive public requests may not exist in practice.

**Recommended fix:** Define cache headers and version invalidation, identify which GETs are cached, and set an enforceable platform-level or shared limit for expensive requests. Verify both in the deploy spike. **Confidence: high.**

### Medium — Evaluation reproducibility contradicts the “run once” guard

**Evidence:** [architecture.md:54](/workspace/predictiq/docs/architecture.md:54) says `evaluate.py` refuses a second test run for a model version, while [architecture.md:102](/workspace/predictiq/docs/architecture.md:102) requires a second run to reproduce `evaluation.json` exactly. Both cannot hold as written.

**Why it matters:** A reviewer cannot independently reproduce the published test result using the documented command.

**Recommended fix:** Permit a read-only verification run that recomputes and compares the immutable saved result; prohibit test-driven retuning or overwriting that result. **Confidence: high.**

### Low — Two statements present unverified behavior as tested or assured

**Evidence:** [architecture.md:83](/workspace/predictiq/docs/architecture.md:83) says every response is under 256 KB “(tested),” though no API or bundle exists. [architecture.md:115](/workspace/predictiq/docs/architecture.md:115) says “the bundle fits,” while [architecture.md:117](/workspace/predictiq/docs/architecture.md:117) says bundle size with dependencies is unmeasured. The **10–15 MB** figure is correctly labeled an estimate at [architecture.md:106](/workspace/predictiq/docs/architecture.md:106), but its encoding and compression assumptions are unspecified.

**Why it matters:** These statements can be mistaken for completed acceptance evidence.

**Recommended fix:** Change them to targets or estimates, state the bundle format, and report measured bytes and maximum serialized response size during implementation. **Confidence: high.**

## Checks that passed at the document level

- The start-of-hour, strictly earlier feature rule addresses the documented same-hour repair hazard ([architecture.md:23–38](/workspace/predictiq/docs/architecture.md:23), [DATA_PROVENANCE.md:59–60](/workspace/predictiq/docs/DATA_PROVENANCE.md:59)). The 24-hour telemetry warm-up starts at the correct hour, 2015-01-02 06:00.
- The two 24-hour embargo days are sufficient for the stated 24-hour forward label: train labels end no later than 31 August 23:00, before validation starts; validation labels end no later than 31 October 23:00, before test starts. Past-only 24-hour rolling features may use earlier-period observations without looking forward.
- Calibration and the default cut-off are assigned to validation, and the replay-start rule uses saved **scores**, not test labels ([architecture.md:54,64](/workspace/predictiq/docs/architecture.md:54)). The main model alone serves Fleet and Asset Details; the baseline is confined to Model Performance, consistent with [ux-spec.md:20–24](/workspace/predictiq/docs/ux-spec.md:20). Planner references match the approved [input semantics](https://example.invalid) in substance; the actual source is [ux-spec.md:26–40](/workspace/predictiq/docs/ux-spec.md:26).

## Commands run and outcomes

- `git diff HEAD~2 HEAD -- docs/architecture.md DECISIONS.md` and `git status --short`: reviewed the two architecture commits; working tree was clean.
- `rg`, `nl`, `head`, `du`, `wc`: read the requested documents and inspected all five CSV headers and file sizes.
- Read-only `python3` CSV queries: telemetry **876,100 rows**, 2015-01-01 06:00 to 2016-01-01 06:00; errors **3,919**, ending 2016-01-01 05:00; maintenance **3,286**, ending 2016-01-01 06:00; failures **761 rows / 719 distinct machine-hour events**, ending 2015-12-31 06:00. Proposed train/validation/test periods contain **473 / 109 / 114** events by event timestamp, with **3** on each embargo day. Proposed test contains **144,700 machine-hours**; applying the architecture’s stated failure-record endpoint removes **2,400** trailing machine-hours.
- `python` was unavailable; the same query ran successfully with `python3`.
- Checked current hosting and caching claims against the official provider documentation linked above.

## Areas not checked

There is no app, model, serving bundle, evaluation JSON, CI configuration or deployment to run. Feature leakage tests, score parity, API bounds, response sizes, replay disclosure, planner arithmetic, security controls, dependency scans and actual free-tier usage remain implementation-stage checks.