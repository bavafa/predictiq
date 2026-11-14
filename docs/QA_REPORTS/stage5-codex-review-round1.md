## Findings

- **Medium — Evaluation date is presented as a recorded fact without a saved evaluation date.** [model-performance-screen.tsx](/workspace/predictiq/frontend/components/model-performance-screen.tsx:100) labels `model_created` from metadata as “Evaluation date.” `evaluation.json` has no evaluation-date field. Decision 68 discloses this substitution, but the page itself does not; its “Every number … comes from the saved evaluation” claim is also too broad. Label it “Model build date” or save and display the actual evaluation date. **Must fix.**
- **Low — Small synthetic test bundles can contain impossible counts.** [bundle.py](/workspace/predictiq/ml/bundle.py:266) fixes positive hours at 2,590 regardless of bundle size. Existing tests create bundles with only 300 or 2,400 machine-hours, so some generated true-negative counts are negative. This does **not** affect the real bundle.

## Criteria

| Criterion | Result | Evidence |
|---|---|---|
| Saved results, version, date; rare-failure accuracy explanation | **Not met** | Results and accuracy arithmetic match the saved files; the displayed evaluation date lacks evaluation provenance. |
| Specified comparison rows and one shared cut-off | **Met** | Both models use the same saved cut-off row. At 51%, each model’s four counts sum to **142,300** machine-hours; the 30% screenshots also match. |
| Event rates, calibration, charts, labels and definitions | **Met** | Saved event counts and rates match; all-cut-off rows are marked; charts, cut-off markers, table views and ⓘ definitions are present. |
| Desktop/mobile layout, states and accessibility | **Met on review** | Inspected matching commit screenshots for desktop, mobile, changed cut-off and error; code provides native slider, table headers, chart summaries and loading/error/unavailable states. No interactive accessibility audit was run. |
| Honest limitations and decision 68 deviations | **Not met** | Decision 68 documents the date substitution, but the page does not identify it to visitors. |
| Real bundle unchanged | **Met** | `bundle.zip` SHA-256 is `0ad2916e96323e9b95a86d306924b5d66beb3c1f3185efc510a7bcbc4b2d57d2`. The `ml/bundle.py` diff changes only synthetic bundle generation. |

**Verdict: FAIL** — the Medium date-provenance finding is a must-fix.

I ran read-only `git show`/diff inspections, parsed both real saved JSON files, checked all 101 cut-offs per model for count totals and false-alert-rate arithmetic, verified the bundle hash, and inspected four screenshots whose blob hashes match `dedf659`. I ran no build or test suite.
