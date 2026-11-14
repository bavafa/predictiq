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

## Pending owner decisions
- None open for Gate 0 or the requirements. User-experience design approval comes next.
