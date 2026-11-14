# Data and model stage: independent review, round 2 (whole stage)

Reviewer: Codex (gpt-6-sol, medium effort), read-only, 14 Nov 2026, about 9:20 AM ET. Lead response: the one Low finding is fixed. The raw function-size record is now saved with the live evidence.

## Findings

- **Low — deployed function size lacks a raw evidence log.** [m1-live-checks.md](/workspace/predictiq/docs/QA_REPORTS/m1-live-checks.md:3) says raw output is committed and reports a 29,996,205-byte deployed function at line 12. The committed evidence logs contain the API response measurements and bundle-free preview responses, but no raw function-size output. The reported 75,473,468-byte uncompressed local build is below the 500 MB limit; its measurement is not independently reproducible from those logs.

**Prior ML findings:** Both are fixed. [evaluate.py](/workspace/predictiq/ml/evaluate.py:176) recomputes replay start with `use_cache=False`, with a poisoned-cache regression test at [test_pipeline.py](/workspace/predictiq/ml/tests/test_pipeline.py:210). [MODEL_CARD.md](/workspace/predictiq/docs/MODEL_CARD.md:15) correctly says **35 features**.

## Criteria

| Criterion | Result | Evidence |
|---|---|---|
| Stage 2 epic: repeatability and no known future leak | **Met** | `ml.evaluate --verify` passed against saved results. Features use records before the scoring hour; a direct probe of all 100 asset responses found no event record at or after `at`. |
| Data checks and 24-hour label | **Met** | [labels.py](/workspace/predictiq/ml/labels.py:29) uses `(t, t+24h]`, merges same-hour failure rows into events, and keeps post-failure hours under the same rule. |
| Past-only features | **Met** | [build.py](/workspace/predictiq/ml/features/build.py:1) excludes records at `t`; [splits.py](/workspace/predictiq/ml/splits.py:25) defines the 24-hour gaps. |
| Baseline and main model | **Met** | Saved logistic and XGBoost models, held-out later results, and separate seen/unseen results appear in [MODEL_CARD.md](/workspace/predictiq/docs/MODEL_CARD.md:7). |
| Cut-off and event measures | **Met** | [train.py](/workspace/predictiq/ml/train.py:58) selects calibration and cut-offs on validation; [metrics.py](/workspace/predictiq/ml/metrics.py:101) counts alert runs and event catches. |
| Check 2: function under 500 MB | **Met, with evidence gap** | The [live report](/workspace/predictiq/docs/QA_REPORTS/m1-live-checks.md:11) records 75,473,468 bytes uncompressed locally and 29,996,205 bytes reported by Vercel. Raw function-size output is missing. |
| Check 4: responses under 256 KB | **Met** | The [live response log](/workspace/predictiq/docs/QA_REPORTS/m1-live-evidence/m1-sizes.log:1) records a maximum of 144,715 bytes. |
| Decision 46: architecture gate | **Met** | Approval is recorded in [DECISIONS.md](/workspace/predictiq/DECISIONS.md:109). |
| Decision 47: personal, non-commercial use | **Met** | Owner confirmation is recorded in [DECISIONS.md](/workspace/predictiq/DECISIONS.md:111). |
| Decision 48: bundle as release asset, outside git | **Met on available evidence** | No bundle or score cache is tracked; the local ZIP matches the committed hash. The [live report](/workspace/predictiq/docs/QA_REPORTS/m1-live-checks.md:5) records downloading the release asset. Network access was prohibited, so I could not inspect the release. |
| Decision 49: test window | **Met** | [splits.py](/workspace/predictiq/ml/splits.py:30) uses 1 Nov–30 Dec 2015, ending at 06:00. |
| Decision 50: 20 unseen machines, fixed seed | **Met** | [splits.py](/workspace/predictiq/ml/splits.py:33) fixes the seed and excludes those machines from train and validation. |
| Decision 51: latest version only | **Met** | [validation.py](/workspace/predictiq/backend/app/validation.py:22) returns 404 for another `mv`; errors use `no-store`. |
| Decision 52: earlier hosting hold | **Met as superseded** | [Decision 53](/workspace/predictiq/DECISIONS.md:125) explicitly supersedes it and retains Vercel. |
| Decision 53: Vercel serving choice | **Met on recorded evidence** | The decision records the earlier hosting checks; the Stage 2 [live report](/workspace/predictiq/docs/QA_REPORTS/m1-live-checks.md:11) re-measures checks 2 and 4. |

The bundle-free preview returns 503 for data endpoints, as documented. The frontend prebuild copies a real bundle when present and refuses one marked synthetic; `vercel.json` includes the copied backend and bundle while excluding unrelated frontend files. No tracked bundle files or obvious credential files were found.

**Verification limit:** `ruff` and `mypy` passed. The full pytest attempt recorded 63 passes and 89 setup errors because this read-only sandbox has no writable temporary directory; those errors do not establish test failures.

## Verdict

**PASS WITH KNOWN ISSUES.** No High or Medium findings. The must-fix threshold is clear; preserve the raw function-size output in the live evidence before relying on check 2 as independently auditable.
