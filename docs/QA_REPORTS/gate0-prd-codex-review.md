# Independent QA review — Gate 0 and PRD draft

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Saved verbatim; local file links refer to the orchestrator box._

**Gate 0 recommendation: FAIL pending a provenance correction.** The five local CSVs match the documented sizes, row counts, SHA-256 hashes, and Git blob hashes. The license description, however, conflicts with the repository’s published README, and I could not inspect the license files at the pinned commit. That is material to a data provenance gate.

**PRD draft recommendation: revise before approval.** Its demo framing is largely faithful to the owner’s brief, but one success criterion presupposes a model result, and the M1 requirements leave several evaluation rules open.

## Findings

### High

1. **License description needs correction and pinned-commit verification.** [DATA_PROVENANCE.md](/workspace/predictiq/docs/DATA_PROVENANCE.md:51) says the repository’s `LICENSE` is MIT and proposes crediting the data as “CC BY 4.0 / MIT” ([line 57](/workspace/predictiq/docs/DATA_PROVENANCE.md:57)). The repository’s [published README](https://github.com/microsoft/sqlworkshops) instead assigns documentation and other content to **CC BY 4.0 via `LICENSE`**, and code to **MIT via `LICENSE-CODE`**. Neither wording establishes a CSV-specific license. **Why it matters:** the proposed public attribution may identify the wrong terms for the data and derived outputs. **Fix:** inspect the README and both license files at the pinned commit, quote their exact scope, and describe CSV rights as unresolved where the text is silent; settle the planned publication credit before Gate 0 closes. **Confidence:** high for the README conflict; medium for the pinned-commit terms, which I could not retrieve.

2. **The PRD sets a favorable model result in advance.** [PRD.md](/workspace/predictiq/docs/PRD.md:27) makes “the model beats a simple baseline” a success check, while the [owner’s brief](/workspace/predictiq/docs/PROJECT_BRIEF.md:126) says not to set target results in advance. **Why it matters:** a valid evaluation could appear to fail merely because the candidate does not beat the baseline, creating pressure to tune against the holdout. **Fix:** require a reproducible baseline comparison and publication of the results *whatever they are*; treat improvement as an observed outcome. **Confidence:** high.

### Medium

3. **M1 must specify the exact label and event rules.** [PRD.md](/workspace/predictiq/docs/PRD.md:11) says “next 24 hours”; [stories.md](/workspace/predictiq/docs/stories.md:69) says simultaneous component failures count as one event. Neither states the brief’s required interval—failure **strictly after** prediction time `t` and **at or before** `t + 24 hours`—or resolves ties, repeated events, and predictions immediately after failure ([brief §6](/workspace/predictiq/docs/PROJECT_BRIEF.md:115)). The local 761 failure rows represent **719 machine-time events**, including **42 two-component events**. **Why it matters:** differing rules change labels and event detection rates. **Fix:** add an M1 acceptance requirement for a documented label function, deduplication key, boundary tests, and post-failure policy. **Confidence:** high.

4. **The leakage controls are directionally right but incomplete.** [PRD.md](/workspace/predictiq/docs/PRD.md:36) and [stories.md](/workspace/predictiq/docs/stories.md:78) call for past-only joins and a split gap. Yet **702 of 719 failure events** have maintenance at the same machine-hour; **1,022 maintenance rows** occur at failure-event timestamps. The docs do not define whether equal-time records are available when scoring, the exact embargo, or whether model fitting, calibration, and threshold selection use distinct periods. **Why it matters:** a timestamp-only join can expose failure-time repairs or overlapping 24-hour labels. **Fix:** at M1, define an as-of cutoff for every source, exclude unavailable equal-time records, specify split and embargo boundaries, and reserve the test period for final evaluation. **Confidence:** high.

5. **Event-level evaluation and generalization claims lack acceptance checks.** The [PRD’s metrics](/workspace/predictiq/docs/PRD.md:28) and [model-page story](/workspace/predictiq/docs/stories.md:195) omit the brief’s failure-event capture, false alerts per 100 machine-days, alert aggregation across consecutive positive hours, and same-machine versus unseen-machine distinction ([brief §6](/workspace/predictiq/docs/PROJECT_BRIEF.md:124)). **Why it matters:** hourly precision can obscure repeated alerts for one failure, and a chronological split of the same machines cannot establish performance on new machines. **Fix:** make these definitions and disclosures explicit M1 deliverables; require a machine-held-out experiment before claiming unseen-machine performance. **Confidence:** high.

6. **The provenance document does not record the full data-validation picture requested by the brief.** [DATA_PROVENANCE.md](/workspace/predictiq/docs/DATA_PROVENANCE.md:37) reports telemetry nulls and uniqueness but little comparable detail for the other four tables. My checks found zero blank fields and zero identical rows in all five files; errors and maintenance have **303** and **758** repeated machine-hour keys respectively, which can be legitimate multiple records. The [brief](/workspace/predictiq/docs/PROJECT_BRIEF.md:53) also calls for frequency and failure-join validation. **Fix:** record per-table null and duplicate definitions, machine-ID coverage, hourly continuity, and failure-to-telemetry join results, distinguishing legitimate multi-record hours from duplicate rows. **Confidence:** high.

### Low

7. **The story list misses the requested compact style.** [stories.md](/workspace/predictiq/docs/stories.md:1) is **1,307 words and 220 lines**, rather than about a page, and uses milestone IDs such as “M0” in headings. [PRD.md](/workspace/predictiq/docs/PRD.md:41) also uses those IDs. Every epic and story **does** have *Problem*, *What we’ll build*, and **2–4 acceptance criteria** (all have 2 or 3); the prose is generally plain English. **Fix:** shorten the story list or agree that the one-page preference does not apply to the full backlog, and replace unexplained milestone IDs with stage names in reader-facing text. **Confidence:** high.

## Verified data and source limits

| Local check | Result |
|---|---|
| Five CSV fingerprints | All documented byte sizes, data-row counts, SHA-256 hashes, and Git blob hashes match. |
| Telemetry | 876,100 rows; 100 machines with 8,761 hourly rows each; no blank fields or duplicate machine-hours; documented dates and rounded sensor ranges match. |
| Failures | 761 component rows, 719 machine-time events, 98 machines; component counts match the document; every event joins to a telemetry machine-hour. |
| Other tables | Documented schema and date ranges match; all machine IDs resolve to machine metadata. |

The [pinned commit exists on GitHub](https://github.com/microsoft/sqlworkshops/commit/e836f4e866028db7fd7d1a66b88f79664a1f4eac), and the repository publicly [shows a telemetry CSV](https://github.com/microsoft/sqlworkshops/blob/master/SQLServerAndAzureMachineLearning/ML%20Services%20for%20SQL%20Server/data/PdM_telemetry.csv). The [Azure repository](https://github.com/Azure/AI-PredictiveMaintenance) is archived and documents a data generator. I **could not independently fetch the pinned CSV URLs, pinned license files, GitHub API listing, or archived Microsoft announcement**. Thus the local hashes are verified, but the document’s claims about retrieval history, last data-changing commit, and byte identity with the remote pinned files are not independently certified here.

## Commands executed and outcomes

- `rg --files`, `wc`, and numbered reads of the brief, three reviewed documents, decision log, status, and tasks: completed. The status and task files correctly mark review and owner approval as pending.
- `python3` standard-library CSV audit: completed; recalculated all five hashes, Git blob hashes, sizes, row counts, columns, blanks, duplicates, date ranges, machine counts, failure counts, and telemetry ranges.
- `python3` cross-table audit: completed; found 719 failure events, 702 with same-hour maintenance, and no failure event lacking same-hour telemetry.
- `wc -w` and story-section check: completed; PRD 752 words, stories 1,307 words; every epic and story has the required fields and 2–4 criteria.
- `git status --short` and tracked-file check: clean working tree; no raw CSV is tracked in this repository.
- `curl -I` to the pinned raw GitHub license: failed because the shell could not resolve `raw.githubusercontent.com`. Web access supplied only partial GitHub verification.

**Areas not checked:** original download logs or retrieval date, remote pinned CSV bytes and license text, archived announcement wording, legal rights in derived artifacts, and any ML implementation or tests—none were provided for this draft review.