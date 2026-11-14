# Codex targeted re-verification, round 2

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Saved verbatim._

## Round-2 re-verification

| Round-1 finding | Status | Evidence |
|---|---|---|
| Repeated-key counts use the wrong unit | **RESOLVED** | The revised [provenance table](/workspace/predictiq/docs/DATA_PROVENANCE.md:57) distinguishes rows in shared machine-hours from extra rows beyond the first. Recalculation found **577 / 303** for errors and **1,514 / 758** for maintenance, respectively. Both files have zero identical rows; every shared-key group contains different error types or components. |
| License-credit compliance is overstated | **RESOLVED** | The revised [credit paragraph](/workspace/predictiq/docs/DATA_PROVENANCE.md:73) calls the credit a draft for owner review, expressly says it alone does not satisfy both licenses, and leaves publication terms to the owner. |

**New issues:** None found in the targeted diff.

**Commands run and outcomes:** `git diff HEAD~1 HEAD -- docs/DATA_PROVENANCE.md` showed the two corrections; document and round-1 report reads completed; `git status --porcelain=v1` showed a clean workspace. `wc -l` showed 3,919 error data rows and 3,286 maintenance data rows. The first CSV audit invocation failed because `python` is unavailable; the same read-only audit succeeded with `python3` and reproduced the counts above.

**GATE 0 (data check): PASS.** Owner license sign-off remains a separate human decision.