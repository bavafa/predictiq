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

**11. Model alerts are amber; red means a recorded failure only.** The brief reserves red for verified risk. A prediction is not verified, so the "Alert" tag is amber. Red marks failures that really appear in the data. Error messages also use amber, with an icon. *Status: proposed.*

**12. Two status levels: "Alert" and "Below cut-off".** A middle "watch" level would need a second, arbitrary cut-off. *Status: proposed.*

**13. One shared alert cut-off.** The same value drives Fleet Overview, Asset Details tags, the Planner and the Model Performance explorer, and sits in the web address. Its default is chosen on validation data. *Status: proposed.*

**14. Fleet and Asset Details show the main model only.** The baseline appears only on Model Performance. We read "filter by model" in the brief as the machine model (model1–model4). *Status: proposed; owner to confirm.*

**15. Controls appear only where they do something.** Replay controls are read-only on Model Performance (it covers the whole test period) and on About & Data. *Status: proposed.*

**16. Planner costs can be set per machine model.** With one cost for every machine, ranking by exposure equals ranking by risk. An optional per-model cost makes the cost lever visibly matter. Net benefit appears only after the user sets an assumed risk reduction. *Status: proposed.*

**17. Asset Details is a full page, not a drawer.** It can be linked and shared, and works the same on mobile. *Status: proposed.*

**18. Light surfaces only in the first release; wireframes are greyscale.** Colour lives in the tokens. *Status: proposed.*

**19. Model comparison colours: teal (main, solid) and violet (baseline, dashed).** A slate-grey baseline failed the colour-blind separation check; teal and violet pass. *Status: proposed.*

**20. Input edge colour darkened to #768295.** The earlier #8792A2 measured 2.94:1 on the page background, below the 3:1 minimum. *Status: proposed.*

## Pending owner decisions
- Design gate approval, after independent review.
- Decision 14 (main model only on Fleet and Asset Details).
- Open questions in the experience spec: starting replay time, illustrative cost defaults.
