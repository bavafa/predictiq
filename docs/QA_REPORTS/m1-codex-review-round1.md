# Data and model stage: independent review, round 1 (model part)

Reviewer: Codex (gpt-6-sol, medium effort), read-only, 14 Nov 2026, about 8:55 AM ET. Both findings were fixed in the next commit and confirmed in round 2.

## Findings

- **Medium — Replay verification can trust an unchecked score cache.** [ml/replay.py](/workspace/predictiq/ml/replay.py:48) prefers `test_scores.npz`, while [ml/artifacts.py](/workspace/predictiq/ml/artifacts.py:52) excludes that file from the manifest. [ml/evaluate.py](/workspace/predictiq/ml/evaluate.py:165) rebuilds scores for evaluation metrics but checks the saved replay start through the cache. A stale or altered cache could therefore produce an incorrect replay start that verification accepts. **Must fix:** compare the replay start with freshly computed scores.
- **Low — The model card miscounts the inputs.** [docs/MODEL_CARD.md](/workspace/predictiq/docs/MODEL_CARD.md:14) says 36 features; [ml/features/build.py](/workspace/predictiq/ml/features/build.py:27) defines 35. The provenance document also reports 35.

I found **no future-information leak** in the reviewed label, feature, split, fitting, calibration, or cut-off paths. In four real test failure windows, scores rose before failure alongside earlier sensor and error signals; the same-hour repairs entered the maintenance feature only after the failure hour. The unusually high results are consistent with strong signals in this simulated data, though these checks cannot prove the absence of every leak. The model card clearly labels the results simulated and cautions against applying the absolute scores to real equipment.

Artifact spot checks matched the card: main/all precision **0.971112**, recall **0.947490**, PR-AUC **0.993198**, **107/107** eligible events caught, and **6** false alerts over **142,300** machine-hours, giving **0.101195** per 100 machine-days. Seen/unseen counts are **80/20** machines and **82/25** eligible events.

## Stage 2 acceptance criteria

| Story | Status | Evidence |
|---|---|---|
| Data checks and 24-hour label | Met | Strict `(t, t+24h]` label, same-hour event grouping, post-failure hours retained, and end censoring; real-data checks passed. |
| Past-only features | Met | Telemetry and error windows end at `t−1h`; maintenance uses timestamps strictly before `t`; leakage tests passed; 24-hour split embargoes are present. |
| Baseline and main model | Met | Both models fit on seen-machine training rows; tuning uses seen-machine validation rows; the separate 20-machine unseen test is reported as simulated. |
| Alert cut-off and event measures | Met | Calibration and cut-offs use validation; event catch and merged-alert false-rate formulas match the architecture. Replay verification has the Medium issue above. |

**Verification:** `evaluate --verify` passed. The read-only compatible tests passed (**45** standard and **3** real-data). The requested `uv` suite could not start because this filesystem provides no writable cache or temporary directory; the full suite was therefore not run.

## Verdict

**FAIL** until the Medium replay verification issue is fixed.
