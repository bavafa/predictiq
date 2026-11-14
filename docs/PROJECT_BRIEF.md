# PredictIQ — Project Definition, Scope & AI-Agent Delivery Brief

**Version:** 1.0  
**Date:** November 13, 2026  
**Status:** Approved concept; implementation not started  
**Intended audience:** Grokbot (project orchestrator), Claude Code (primary designer/developer), OpenAI Codex (independent QA reviewer)  
**Product type:** Public, interactive portfolio demonstration — NOT a production industrial safety or control system.

---

## 1. Instructions to Grokbot: your mandate

You are the **product delivery manager and technical orchestrator** for PredictIQ. Turn this brief into a working, publicly accessible, credible portfolio application. **Claude Code is the primary implementer** of application code, UX, dashboard components, ML pipeline, automated tests, and deployment configuration. **OpenAI Codex is the independent QA/review agent** at defined milestones. The human owner approves material scope, spending, deployment credentials and public release.

Your responsibilities:
1. Maintain the scope, backlog, architecture decisions, milestones and acceptance criteria in the repository.
2. Delegate small, bounded implementation tasks to Claude Code; demand code, tests, screenshots and evidence, not only narrative completion claims.
3. After each QA milestone, send the implemented diff/repository and a targeted review brief to Codex. Request read-only code review and relevant independent test execution; do not rely on Claude's self-assessment.
4. Triage Codex findings by severity, send corrections to Claude Code, then ask Codex to re-review affected areas. Do not close a gate until blocking findings are resolved or explicitly accepted by the human owner.
5. Preserve working functionality, commit incremental changes and avoid unnecessary dependencies or feature creep.
6. Report progress using: milestone, delivered artifacts, tests run, Codex findings, open risks, next task, owner decision required.
7. If direct orchestration or invocation of either coding agent is not technically available, produce a copy-paste-ready task prompt and QA prompt. **Do not claim an agent has executed or approved work when it has not.**

**Operating principle:** A truthful, technically defensible smaller product is better than a polished but misleading ML dashboard.

## 2. Product vision

**Name:** PredictIQ  
**Tagline:** From machine failure predictions to maintenance decisions.  
**One-line pitch:** An interactive industrial asset-intelligence application that replays historical machine telemetry, predicts recorded component failures up to 24 hours ahead, explains risk drivers, and helps users prioritize maintenance under limited budgets or capacity.

**Business problem:** Operations and maintenance managers lack a simple way to connect machine health signals, near-term failure risk and the financial trade-offs of planned maintenance versus unplanned downtime.

**Demonstrated skills:** Industrial analytics, time-series feature engineering, ML model validation, explainability, decision support, asset management workflows, API design and professional enterprise UX. The demo is relevant to mining, manufacturing, energy and infrastructure without claiming actual mine deployment.

**Primary user:** Maintenance/reliability manager.  
**Secondary users:** Plant operations lead; technical evaluator or hiring manager exploring the portfolio.

### Product outcomes
- Show which of 100 machines are at highest modeled risk at a selected historical time.
- Show the underlying telemetry history and evidence behind a risk estimate.
- Let users compare the operational and economic consequences of maintenance prioritization choices.
- Show transparent ML evaluation and limitations instead of unsupported accuracy or savings claims.
- Let a visitor understand the application within 90 seconds without logging in.

## 3. Data source and authenticity requirements

**Preferred source:** Microsoft Azure Predictive Maintenance sample dataset (2015), comprising `PdM_telemetry.csv`, `PdM_errors.csv`, `PdM_maint.csv`, `PdM_failures.csv`, and `PdM_machines.csv`. It is sample/demo industrial machine data; do **not** describe it as verified telemetry from a commercial mining operation. The telemetry contains hourly voltage, rotation, pressure and vibration records across roughly 100 machines (~876,100 telemetry rows). Failure, maintenance, error and machine metadata are separate tables.

**Data ingestion contract:**
- Locate the most authoritative available download source. Record precise source URL, retrieval date, file hashes, schema, provenance and license/redistribution terms in `docs/DATA_PROVENANCE.md` before committing data.
- Do not download or publish files from unknown mirrors without documenting provenance. If redistribution is uncertain, provide a reproducible download script rather than committing raw data.
- Validate machine IDs, timestamp frequency, uniqueness, nulls, data ranges and failure event joins; fail loudly on broken data.
- Use real historical data for charts, risk estimates and model evaluation. Use explicitly labeled **illustrative assumptions** for downtime economics, asset/site names, staffing, maintenance duration and projected savings.
- Do not invent mining fleet types (e.g., haul trucks) as if they are part of the original dataset; any mapping is a clearly marked optional fictional scenario.
- No true operational live feed in MVP. A **historical replay** makes old timestamped records appear sequentially in the demo. Label it "Historical replay," not "Live telemetry."

**Reference links for verification (links are starting points, not proof of license):**
- https://github.com/Azure/AI-PredictiveMaintenance
- https://github.com/anthropics/claude-code
- https://learn.chatgpt.com/docs/codex/cli

## 4. MVP scope: user-facing features

### 4.1 Global application shell
- Desktop-first, polished responsive enterprise SaaS interface; accessible at common mobile/tablet widths.
- Navigation: **Fleet Overview**, **Asset Details**, **Maintenance Planner**, **Model Performance**, plus concise **About/Data Provenance**.
- Persistent disclosure: **Portfolio demo — historical sample data; estimated economics are illustrative.**
- Global replay timestamp and a clear indicator that the application is showing archived data.
- No login required; no personal information collection; no external production equipment control.

### 4.2 Fleet Overview
**Displays:** fleet size; high-risk asset count; 24-hour failure predictions/alerts based on chosen threshold; predicted risk distribution; ranked asset table; selected-window telemetry/risk trend. Avoid showing a financial number as an actual realized saving.

**User controls:** select replay timestamp; play/pause historical replay; optionally step through time in larger increments for responsiveness; filter by machine, model and risk category; adjust the alert threshold (initial default determined from validation set, not arbitrary). Selecting a machine opens Asset Details.

**Acceptance:** All visible KPIs and risk badges reflect the selected replay time, the model, and current threshold. A high-risk count must agree with the filtered/ranked asset table. Playback stops predictably at dataset boundaries.

### 4.3 Asset Details
**Displays:** machine ID/model/age (if present), recent voltage/rotation/pressure/vibration histories, current 24-hour risk estimate, top predictive risk contributions (e.g., SHAP), recent errors and maintenance events, and historical prediction vs. actual failure outcomes where labels are available.

**User controls:** machine selector; replay time; metric/chart range (24h/7d where available). A **Sensor Sandbox** is an optional stretch feature: changing a raw sensor value must either correctly recompute all affected model features or be clearly marked as a non-model illustrative simulation. It must never imply causal advice or safe real-world setpoints.

**Acceptance:** No future telemetry, error, maintenance or failure information is included in features at the displayed prediction timestamp. Risk explanations correspond to the actual scored observation.

### 4.4 Maintenance Planner
**Displays:** prioritized asset queue with risk, estimated failure consequence, estimated planned maintenance cost and a clearly specified decision metric; optional maintenance action shortlist under a capacity limit.

**User controls:** downtime cost, planned maintenance cost, available maintenance slots/technicians, and risk threshold. Show explicit units and assumptions.

**Decision logic (MVP):** Start with expected failure exposure = calibrated `P(failure within 24h)` × assumed cost if failure occurs. If presenting net expected benefit from maintenance, require a stated assumption about the **effectiveness of maintenance** at lowering risk; use `expected benefit = (risk_before - risk_after) × failure_cost - planned_maintenance_cost`. Without a defensible risk reduction assumption, **rank by exposure and cost, but do not claim actual savings or optimal repair actions**. Simple deterministic sorting is acceptable; optional constrained selection may use OR-Tools.

**Acceptance:** The ranking and any calculated values change deterministically when users change costs, risk or capacity. All currency outputs are labeled illustrative, and the UI clearly distinguishes expected exposure from realized benefits.

### 4.5 Model Performance / Methodology
- Describe target (failure in the next 24 hours), training and test windows, dataset provenance and limitations.
- Show baseline vs. candidate model metrics: precision, recall, PR-AUC, confusion matrix, number of false alerts, failure-event detection rate and probability calibration assessment.
- Let users change the *classification threshold* to visualize the precision/recall and alert-volume trade-off using held-out evaluation data; do not retrain from UI.
- Show dataset imbalance and explain why headline accuracy is misleading.

**Acceptance:** Every metric derives from saved reproducible evaluation artifacts, not UI placeholders. A versioned model identifier and evaluation date appear.

## 5. UX and design requirements

**Visual direction:** Modern, restrained industrial intelligence software. Dark navy/charcoal sidebar, light or dark neutral data surfaces, teal/blue for neutral analytics, amber for warning, red only for verified risk status. High readability and deliberate whitespace. No gratuitous 3D illustrations, misleading motion or generic AI-chatbot aesthetic.

**Required UI components:** responsive navigation/sidebar; metric cards; sortable/filterable machine table; line charts with units/time axes; risk tags; asset detail drawer/page; tooltip for model explanation; replay controls; assumptions panel; loading/empty/error states; source/methodology disclosures.

**Technical QA for design:** desktop and mobile screenshot review; accessible contrast; keyboard navigable controls; semantic labels; correct number/unit formatting; chart accessibility where practical. Every visually interactive control must have a real behavior. Do not ship decorative fake filters or buttons.

**Design deliverables before implementation:** low-fidelity screen layout, component list, color/type tokens, key interaction states. Claude Code owns both design and implementation; Grokbot reviews them against acceptance criteria. No need for a Figma file unless it materially helps.

## 6. ML specification (non-negotiable)

**Prediction target:** For each machine at timestamp `t`, predict whether a recorded failure event occurs strictly after `t` and at or before `t + 24 hours`. Define tie handling, duplicate event behavior and any post-failure exclusions explicitly. **Do not use a contemporaneous failure indicator as a predictor.**

**Models:**
1. Logistic Regression baseline (with preprocessing and class imbalance handling as appropriate).
2. XGBoost gradient-boosted trees as the preferred candidate; if deployment complexity is excessive, justify HistGradientBoostingClassifier as an alternative.
3. Calibrate probabilities on a held-out validation/calibration period if reliability analysis indicates a need. Keep threshold tuning separate from test evaluation.

**Feature engineering:** machine metadata (age/model), latest telemetry, trailing rolling means/std/trends (e.g., 6h/24h), past error counts and error types, time since prior maintenance, optional recent replacement history. All joins and windows must be **past-only** and keyed by machine. Handle warm-up windows consistently; report missingness and transformations.

**Validation protocol:** chronological train → validation → test split; include a gap/embargo around prediction horizon where needed to avoid overlapping target leakage across split boundaries. Use the holdout only once for final reported performance. Document same-machine temporal generalization vs. unseen-machine generalization; do not claim the latter without a machine-held-out experiment. Audit leakage from maintenance records and any post-failure behavior.

**Metrics:** PR-AUC (primary), precision/recall/F1 at a chosen threshold, recall at operationally meaningful alert volume, failure-event capture, false alerts per 100 machine-days, Brier score/calibration curve if using probabilities. Clearly document how correlated consecutive positive hours are aggregated into event-level alerts. Do not set target results in advance or fabricate high accuracy.

**Reproducibility:** versioned environment/dependencies, fixed random seeds, data-validation report, training CLI/script, saved model/preprocessor/feature schema, evaluation JSON/plots and README instructions. Prefer a `make train`/`make evaluate` equivalent. When the feature pipeline differs between training and inference, treat that as a release blocker.

**Explainability:** SHAP for XGBoost if performant and correct. Model contributions are descriptive associations, **not proof of causal physical failure mechanism**.

## 7. Technical architecture and deployment

**Preferred stack (change only with documented justification):**
- **Frontend:** Next.js + React + TypeScript, Tailwind CSS, shadcn/ui, Recharts.
- **Backend:** Python 3.11+ with FastAPI and Pydantic.
- **ML:** pandas, scikit-learn, XGBoost, SHAP where feasible.
- **Data:** precomputed Parquet/JSON evaluation outputs; DuckDB for querying archived telemetry. No operational database server required for MVP.
- **Tests:** pytest for Python; Vitest/React Testing Library for components; Playwright for end-to-end flows.
- **Deployment:** frontend on Vercel, backend on a Python-compatible host (e.g., Render) or a single-host deployment if more reliable. Validate free-tier limits and cold starts before committing.
- **Source control:** GitHub repository, CI for lint/typecheck/tests and repeatable deployment instructions.

**Data flow:** archived CSVs → validation & chronological joins → feature pipeline → train/calibrate/evaluate → versioned model + precomputed replay predictions → FastAPI endpoints → React dashboard. Maintenance Planner adds user-provided assumptions in a separate deterministic decision layer. Where interactive inference is needed, use the same production feature pipeline as training.

**Suggested API surface (contract, not mandatory naming):**
- `GET /health`
- `GET /metadata`
- `GET /fleet?at=...&threshold=...&model=...`
- `GET /assets/{id}?at=...`
- `GET /assets/{id}/telemetry?start=...&end=...`
- `GET /assets/{id}/explanation?at=...`
- `POST /maintenance/plan` (bounded assumptions and selected replay timestamp)
- `GET /model/metrics` and `GET /model/threshold-analysis`

**Performance targets:** initial dashboard usable within a few seconds on a normal desktop connection after host wake-up; common queries respond in ~1 second when warm; replay should avoid fetching the entire historical dataset in the browser. Treat these as engineering targets, not a claim of measured performance before testing.

**Security/reliability:** read-only public demo by default; validate inputs and date bounds; rate-limit expensive operations; no secrets in frontend or repository; dependency scanning; clear error responses; data-source fallback or documented error state if archives are unavailable.

## 8. Explicit out-of-scope items

No real mine integration; no OPC UA/MQTT connector; no control/actuation; no closed-loop automation; no LLM chatbot; no real work-order or EAM/CMMS integration; no user accounts or enterprise permissions; no real maintenance cost data; no claimed production deployment; no actual savings claims; no advanced digital twin; no large cloud data platform; no automated retraining pipeline; no native mobile app. Stretch features require explicit scope approval after MVP is working.

## 9. Definition of done — release acceptance criteria

1. A public URL opens a working application without login, and the portfolio project card can link to it.
2. Fleet, Asset Details, Planner and Model Performance pages are usable and visually polished.
3. Data comes from the documented public sample; UI explicitly distinguishes historical, predicted and illustrative values.
4. The 24-hour target, feature windows, splits and reported metrics are reproducible; leakage checks pass.
5. All primary UI controls affect state/output, including timestamp, machine selection, risk threshold and cost assumptions.
6. Maintenance economic logic is transparent, tested and appropriately caveated.
7. No mock risk estimates or placeholder evaluation results remain in the released application.
8. Unit, integration, E2E, accessibility and deployment smoke checks pass; known limitations are documented.
9. Codex performs independent review at gates below, with critical/high findings resolved or explicitly accepted by the human owner.
10. README and portfolio case study provide problem, dataset, design, architecture, ML evaluation, demo link and limitations.

## 10. Milestone delivery plan and QA gates

| Gate | Claude Code implementation deliverables | Independent Codex QA focus | Exit condition |
|---|---|---|---|
| M0 — Foundation | Repo, architecture note, UI wireframes, design tokens, data source validation, first working shell | Scope correctness, dependency choices, licensing/provenance, UI affordances | App boots; data source verified; architecture documented |
| M1 — Data & ML | Validation scripts, training/feature pipeline, trained model, metrics, replay predictions | Temporal leakage, event labels, splits, baseline, calibration, evaluation reproducibility | `train`/`evaluate` reproducible; no known leakage |
| M2 — Core UX & API | Fleet/Asset pages, backend contracts, time replay, charts, explanations | API tests, timestamp consistency, UI state, misleading labels, responsive visuals | Working vertical slice using real predictions |
| M3 — Decision layer | Maintenance planner, financial assumptions, thresholds, prioritization | Unit economics, sensitivity, bounds, impossible states, false savings claims | Actions respond correctly to user levers |
| M4 — Launch | Model page, E2E tests, CI, docs, production deployment, screenshots | Full regression, accessibility, security, deployment smoke, provenance and claims | Public demo passes release checklist |

At the end of **every milestone**, Claude Code must provide: changed files/commit, commands executed and results, screenshots where UI changed, known issues, and handoff notes. Grokbot calls Codex only after an implemented and testable milestone exists. Codex reports findings with severity, file/line, reproduction steps, proposed fixes and confidence. Claude fixes; Codex verifies. No silent bypass.

### Severity and gate policy
- **Critical:** Security exposure, materially incorrect model evaluation, future-data leakage, broken core product; must fix.
- **High:** Incorrect calculations, incorrect risk display, non-working primary controls, significant accessibility issue; must fix.
- **Medium:** Nonblocking edge cases, performance degradation, confusing copy; prioritize and track.
- **Low:** Cosmetic and optional improvements; backlog.
- Final approval remains with the human owner. Codex is a reviewer, not an authority to approve spending or release unilaterally.

## 11. Suggested repository structure

```text
predictiq/
  README.md
  CLAUDE.md                   # Claude Code project instructions
  AGENTS.md                   # Independent reviewer / Codex instructions
  docs/
    PROJECT_BRIEF.md
    ARCHITECTURE.md
    DATA_PROVENANCE.md
    MODEL_CARD.md
    QA_REPORTS/
    DECISIONS.md
  frontend/
    app/ components/ lib/ tests/
  backend/
    app/ api/ services/ schemas/ tests/
  ml/
    ingest/ features/ train.py evaluate.py replay.py tests/
  data/
    README.md                 # datasets not committed if license unclear
    processed/                 # gitignored unless safe small artifacts
  models/
    README.md                 # versioned artifact policy
  scripts/
  .github/workflows/
```

## 12. Agent prompts and working procedure

### 12.1 Grokbot kickoff directive

> You are managing PredictIQ according to this entire project brief. First, inspect the repository and environment, verify Claude Code and Codex access without assuming you can invoke them, identify any blockers, and create a milestone-based delivery backlog. Do not begin coding personally if Claude Code is available as the designated implementer. Ask Claude Code to implement M0 as a small, reviewable commit. After Claude's evidence-based handoff, ask Codex for an independent M0 review. Track findings and iterate until the M0 gate is met. Continue one milestone at a time. Prefer minimum viable complexity; preserve data authenticity and leakage safeguards. Do not claim tests or reviews have run unless you have their output. Escalate only decisions requiring credentials, paid services, legal/license judgments or material scope changes.

### 12.2 Reusable Claude Code task template

> ROLE: Primary application designer and implementer. PROJECT: PredictIQ. MILESTONE: [M#]. Read `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md` and `CLAUDE.md`. Implement only these acceptance criteria: [specific items]. Prioritize real working behavior, professionally designed components, tests and documentation. Avoid broad refactors outside scope. Do not use placeholder ML metrics or invented business results. Run the relevant commands and report exact results. Deliver: changed files, implementation rationale, tests run, screenshots for UI work, known limitations, and an explicit list of acceptance criteria satisfied/not satisfied. Make a commit or provide a reviewable diff.

### 12.3 Reusable Codex independent review template

> ROLE: Independent QA reviewer. PROJECT: PredictIQ. MILESTONE: [M#]. Inspect the current repository and the diff since the previous approved milestone. Compare changes against `docs/PROJECT_BRIEF.md` and milestone acceptance criteria. Do not implement features or rewrite the product during this review. Independently run appropriate automated tests and inspect model/evaluation artifacts; for UI milestones, validate visual and interaction behavior via browser-based checks if available. Prioritize bugs, leakage, fabricated data, unreliable risk probabilities, financial calculation errors, security, accessibility, and broken controls. Return findings ordered Critical/High/Medium/Low with evidence (file/line, reproduction, recommended fix), executed commands and outcomes, remaining untested areas, and a gate recommendation: PASS / PASS WITH KNOWN ISSUES / FAIL. If you could not run tests or access the app, say so; never certify a gate without evidence.

### 12.4 Grokbot post-review action

> Read the latest Codex QA report. Convert findings into a prioritized fix list without losing issue context. Give Claude Code a bounded remediation prompt. Require changed files, tests and evidence. Re-request targeted Codex verification. Mark findings resolved only when demonstrated. Escalate genuine scope conflicts to the owner.

## 13. Initial tasks for the first agent run

1. Inspect local tools, available coding agents, GitHub repo and deployment constraints; report what can genuinely be automated.
2. Verify the preferred Azure sample dataset source and rights; create `docs/DATA_PROVENANCE.md`.
3. Draft `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, backlog and initial wireframes.
4. Have Claude Code scaffold a minimal Next.js frontend and FastAPI backend with test/lint/typecheck scripts.
5. Implement a static but clearly marked **layout prototype** using illustrative sample values for visual review; do not present it as finished ML functionality.
6. Hand the M0 commit and screenshot/test evidence to Codex for independent QA.
7. Do not start M1 until M0 is accepted.

## 14. Portfolio positioning and truthful disclosures

The final portfolio description should read approximately: **"PredictIQ is a prototype asset-intelligence application built on a public predictive-maintenance sample dataset. It predicts recorded component failures over a 24-hour horizon and links model outputs to transparent, assumption-based maintenance prioritization. It is a demonstration of industrial analytics and product design, not a deployed production system."**

**Never claim:** real mine telemetry, real maintenance optimization savings, validated physical causality, production certification, or predictive accuracy that has not been measured on held-out data.

---

**Final instruction to Grokbot:** Treat this document as the source of truth. If an implementation decision conflicts with scope, acceptance criteria, or model integrity, preserve the latter and record the trade-off. The application must be convincing because it works and is truthful, not because it imitates industrial software visually.
