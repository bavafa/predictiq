## Findings

- **High — Production can copy an unverified local bundle.** [fetch-bundle.mjs](/workspace/predictiq/frontend/scripts/fetch-bundle.mjs:172) returns as soon as `bundle/meta.json` exists, before checking the committed hash or allowed file list. [sync-backend.mjs](/workspace/predictiq/frontend/scripts/sync-backend.mjs:50) then checks only `synthetic` and version before copying it. The download path verifies the hash before unpacking and rejects unexpected names, but the existing-bundle path does not provide the claimed production guarantee.
- **Medium — The public-release criterion is still open.** [stage5-history-scan.md](/workspace/predictiq/docs/QA_REPORTS/stage5-history-scan.md:16) records a personal author email in commit `874a686`; [line 19](/workspace/predictiq/docs/QA_REPORTS/stage5-history-scan.md:19) records older private path names. The report discloses these honestly and leaves their disposition to the owner. They remain in history if the repository is made public.
- **Medium — The launch check will not exercise the production download as written.** [LAUNCH_CHECKLIST.md](/workspace/predictiq/docs/LAUNCH_CHECKLIST.md:51) puts `BUNDLE_FETCH=1` in a shell comment, so the fresh-clone prebuild runs without it and skips the download. The checklist’s expected “SHA-256 matched” output cannot follow from that command.

## Criteria

| Criterion | Status | Evidence |
|---|---|---|
| Every page carries the simulated-data and illustrative-costs notice | **Met in code** | Shared disclosure in [nav.ts](/workspace/predictiq/frontend/lib/nav.ts:3) and [app-shell.tsx](/workspace/predictiq/frontend/components/app-shell.tsx:113); five-page, two-viewport coverage in [notice.spec.ts](/workspace/predictiq/frontend/e2e/notice.spec.ts:29). |
| No secrets, personal information or private notes remain | **Not met** | The history report records a personal author email and older private path names. Its pattern scan found no secrets, but cannot establish the broader absence of all private material. |
| README credit, licensing and claims | **Met** | The credit line in [README.md](/workspace/predictiq/README.md:51) matches the approved line in [DATA_PROVENANCE.md](/workspace/predictiq/docs/DATA_PROVENANCE.md:86). The README states the data-licence ambiguity, absent code licence, simulated data and illustrative costs; its live link is explicitly pending. |
| Model card and About & Data limitations | **Met** | Spot checks against the committed `artifacts/piq-20261114-efc9c243/evaluation.json` matched the 1,423-hour window, 142,300 machine-hours, 110 events, 51% and 27% cut-offs, all-group precision/recall, PR-AUC, Brier scores and alert counts in [MODEL_CARD.md](/workspace/predictiq/docs/MODEL_CARD.md:64). [About & Data](/workspace/predictiq/frontend/app/about-data/page.tsx:84) states the main limitations. |
| Safe, executable launch sequence | **Not met** | Owner approval and history review precede publication, protection is retained until the owner changes it, and rollback limits are acknowledged. Step 4’s command needs correction; production bundle validation also needs closing. |
| Stage 5 / M4 release | **Not met yet** | [LAUNCH_CHECKLIST.md](/workspace/predictiq/docs/LAUNCH_CHECKLIST.md:103) correctly marks the public URL, production smoke checks and portfolio link open. The [brief’s M4 exit condition](/workspace/predictiq/docs/PROJECT_BRIEF.md:184) requires a public demo that passes the checklist. |

**Verdict: FAIL** for launch readiness. This is a review of preparation at `5312ade`, not a claim that a public launch was attempted.

**Ran:** read-only `git show 5312ade:<path>`, `git ls-tree`, `git grep`, and a `python3` JSON spot-check on the committed evaluation. I did not run tests, the history scanner, deployment commands or network checks; those would use the changing working tree or require writes/network access.
