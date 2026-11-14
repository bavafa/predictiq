# Codex targeted re-verification, round 1

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Saved verbatim._

## Targeted re-verification

| Earlier finding | Status | Evidence |
|---|---|---|
| 1. License description | **RESOLVED** | [Data provenance, lines 65–75](/workspace/predictiq/docs/DATA_PROVENANCE.md:65) now records the root MIT `LICENSE`, absent `LICENSE-CODE`, and README links to a different repository. It says the CSV license is “**unresolved on the face of the source**” and calls for an “**Owner decision**.” This matches the pinned-commit facts supplied for this review; my attempt to fetch the pinned files directly was unsuccessful. A separate new attribution issue appears below. |
| 2. Predetermined model win | **RESOLVED** | [PRD, line 23](/workspace/predictiq/docs/PRD.md:23) requires publishing the comparison “**whatever the result**” and says improvement is “**an observation, not a goal**.” |
| 3. Label and event rules | **RESOLVED** | [PRD, line 24](/workspace/predictiq/docs/PRD.md:24) specifies strictly after scoring through 24 hours, one event for simultaneous component failures, edge tests, and a post-failure rule. [Stories, lines 55–61](/workspace/predictiq/docs/stories.md:55) make these acceptance criteria. |
| 4. Leakage controls | **RESOLVED** | [PRD, lines 25–26](/workspace/predictiq/docs/PRD.md:25) excludes records logged at scoring time and separates training, tuning, and final test periods with a stated gap. [Stories, lines 63–69](/workspace/predictiq/docs/stories.md:63) require a rule for each record type and a leakage test. Exact gap boundaries remain an implementation deliverable. |
| 5. Event evaluation and generalization | **RESOLVED** | [PRD, lines 28–29](/workspace/predictiq/docs/PRD.md:28) requires event capture, false alerts per 100 machine-days, aggregation of consecutive alert hours, and a separate test before claims about unseen machines. [Stories, lines 71–84](/workspace/predictiq/docs/stories.md:71) repeat these checks. |
| 6. Data-validation record | **PARTIALLY RESOLVED** | [Data provenance, lines 55–60](/workspace/predictiq/docs/DATA_PROVENANCE.md:55) adds continuity, blank and identical-row checks, ID coverage, failure joins, and same-hour maintenance counts. The repeated-key numbers are mislabeled; see new finding A. |
| 7. Story length and IDs | **PARTIALLY RESOLVED** | Headings now use “**Stage 1**” through “**Stage 5**” ([stories, line 5](/workspace/predictiq/docs/stories.md:5); [PRD, lines 41–47](/workspace/predictiq/docs/PRD.md:41)). Stories fell from 1,307 to **1,195 words**, but remain longer than the requested approximately one-page list. All 24 epics and stories retain **Problem**, **What we’ll build**, and **2–4 acceptance criteria**. |

### New findings

- **Medium — Repeated-key counts use the wrong unit.** [Data provenance, line 57](/workspace/predictiq/docs/DATA_PROVENANCE.md:57) says “**303 rows share a machine-hour**” in errors and “**758**” in maintenance. Recomputed from the CSVs, **577 error rows** and **1,514 maintenance rows** belong to repeated-key groups. **303** and **758** count *extra rows beyond one per key*. State that definition, or replace the figures.

- **Medium — Proposed license compliance is overstated.** [Data provenance, line 73](/workspace/predictiq/docs/DATA_PROVENANCE.md:73) says “**Following CC BY 4.0 attribution … covers both readings**.” The [MIT text](https://opensource.org/license/mit) requires retaining its copyright **and permission notices** in copies or substantial portions; [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) has its own attribution conditions. The proposed credit alone does not establish compliance with both. Leave the publication terms for owner review without claiming one credit covers them.

I found no new unexplained acronym, milestone ID, file name, or unlabeled numeric claim in the PRD or stories, and no missing required story structure.

**Commands run and outcomes:** `git log --oneline` and the requested `git diff ccaffb9 HEAD -- …` completed; numbered document reads and `wc -w -l` completed; a read-only Python CSV audit reproduced 876,100 telemetry rows, hourly continuity, zero blanks or identical rows, 719 failure events, 702 events with same-hour maintenance, 1,022 maintenance rows at failure timestamps, and 743 same-component matches. A story-section check passed **24/24** sections. Direct web retrieval of the pinned README and license returned a cache miss.

**Updated recommendations:** **GATE 0 (data check): PASS WITH KNOWN ISSUES**—correct the two provenance statements above. License sign-off remains a separate human owner decision. **PRD draft: ready for owner review — yes.**