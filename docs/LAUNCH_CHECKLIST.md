# Launch checklist

Status: **prepared, not started.** Nothing below has been run against production. The repository is private, deployment protection is on, no production deployment exists and no domain is planned. Every step waits for **Meysam's go-ahead** (decision 57). Who runs a step is the person named: **Meysam** (owner; holds GitHub admin and Vercel access) or **Builder** (the Claude Code session, only for steps that need no Vercel or GitHub admin rights and only after the go-ahead).

`<PROD_URL>` is the project's production address on `*.vercel.app` (copy it from the Vercel project's Domains tab). `<VERSION>` is `piq-20261114-efc9c243`.

## Part 1: ordered launch steps

### 0. Go-ahead and preconditions
- **Who:** Meysam. **Command:** none; say "go" in writing. Settle the open owner questions first: the personal author email in commit `874a686` (history scan, item 2), a licence for this repository's own code (none chosen yet), the wording of decision 70, and approval of decision 71.
- **Expected:** answers recorded in `DECISIONS.md`.
- **Rollback:** nothing has changed yet.

### 1. Final history-wide secret scan (all commits, not only HEAD)
- **Who:** Builder, on the exact branch that will be merged.
- **Command:**
  ```bash
  uv run python -m scripts.history_scan --out docs/QA_REPORTS/stage5-history-scan-final.txt
  uv run pytest scripts/tests/test_release_hygiene.py
  ```
- **Expected:** exit code 0 and "Nothing found", or only the items already reviewed in `docs/QA_REPORTS/stage5-history-scan.md` and accepted in step 0. Any new finding stops the launch: the owner decides (no history is rewritten by a script).
- **Rollback:** none needed (read-only).

### 2. Merge the Stage 5 branch into `main`
- **Who:** Meysam merges the pull request from `model-perf` (Builder opens it if asked). It carries this checklist, the README, the limitations text and the bundle-download code.
- **Command:** `gh pr create --base main --head model-perf --title "Stage 5: model performance page, testing, launch preparation"` then merge in GitHub.
- **Expected:** merge succeeds. The push to `main` triggers a Vercel build that is **canceled** by the `ignoreCommand` line (still in place); no production deployment appears.
- **Rollback:** revert the merge commit with a pull request.

### 3. Make the repository public
- **Who:** Meysam (needs repository admin). Point of no return for the history: once public it may be cloned and cached.
- **Command:**
  ```bash
  gh repo edit bavafa/predictiq --visibility public --accept-visibility-change-consequences
  ```
- **Expected:** `gh repo view bavafa/predictiq --json visibility` prints `"visibility":"PUBLIC"`. Confirm the GitHub "Security" tab has secret scanning and push protection on (they are free on public repositories).
- **Rollback:** `gh repo edit bavafa/predictiq --visibility private --accept-visibility-change-consequences`. This hides the repository again, but copies already made stay made, so a leaked secret would still have to be rotated.

### 4. Check the bundle can be downloaded without a login
- **Who:** Builder (no credentials; run it logged out of GitHub).
- **Command:**
  ```bash
  d=$(mktemp -d)
  curl -fsSL -o "$d/bundle.zip" "https://github.com/bavafa/predictiq/releases/download/bundle-<VERSION>/bundle.zip"
  sha256sum "$d/bundle.zip"
  cat artifacts/<VERSION>/bundle.sha256
  ```
- **Expected:** the two SHA-256 values are the same (`0ad2916e…2d57d2`). Run the production-style prebuild on a fresh clone with the real URL (no override):
  ```bash
  git clone https://github.com/bavafa/predictiq.git "$d/clone"
  node "$d/clone/frontend/scripts/sync-backend.mjs" --artifacts "$d/clone/artifacts" --out "$d/out"   # with BUNDLE_FETCH=1 in the environment
  ```
  prints "SHA-256 matched; unpacked 10 files" and exits 0. (The same logic is covered by `frontend/tests/fetch-bundle.test.ts`. The localhost end-to-end script `scripts/verify_bundle_download.sh` was written but **not yet run**; run it before this step and save its output as `docs/QA_REPORTS/stage5-bundle-download.log`.)
- **Rollback:** if the download fails (404, hash differs), stop. Do **not** continue to step 5. Fix the release asset (owner) or go back to a private repository (step 3 rollback).

### 5. Pull request that lets `main` build: remove the `ignoreCommand` line
- **Who:** Builder prepares, **Meysam merges.**
- **Change:** delete the `"ignoreCommand": ...` line from `frontend/vercel.json`, and update `backend/tests/test_deploy_layout.py` (the test that runs the command for `main`, other branches and no branch) so it expects the key to be absent and checks the JSON is still valid. Update `docs/DEPLOY.md` ("Builds are skipped for `main`") and `DECISIONS.md` with the date.
- **Command:** `uv run pytest backend/tests/test_deploy_layout.py` locally, then `gh pr create --base main`.
- **Expected:** CI green. On merge, Vercel's Git integration builds `main` as a **production** deployment (production branch is `main`, the default). The build log shows `fetch-bundle: SHA-256 matched; unpacked 10 files`, then the Next.js build. A failed download or hash makes the **build fail**, and the previous production deployment (none at first) stays as it was.
- **Rollback:** revert the pull request (the `ignoreCommand` returns, so no further `main` builds run). To take down a live production deployment, see step 9.

### 6. Deployment protection: public production, protected previews
- **Who:** Meysam, in the Vercel dashboard (Project → Settings → Deployment Protection). Builder does not change Vercel settings.
- **Target:** previews stay behind Vercel Authentication; the production site is reachable without login. This is the dashboard's **Standard Protection** (it protects preview and generated deployment URLs and leaves the production domain open). **To confirm:** the exact API value name (`ssoProtection.deploymentType`; candidates are `all_except_custom_domains` and `prod_deployment_urls_and_all_previews`) is not written down anywhere in this repository, and the two differ in whether the production *domain* is open. Pick the dashboard option whose description says the production domain is public, then verify with the check below rather than trusting the label.
- **Check (logged out):** `curl -sS -o /dev/null -w "%{http_code}\n" https://<PROD_URL>/` prints `200`; the same request to a **preview** URL still prints `401`.
- **Expected:** production 200 without login; previews 401.
- **Rollback:** set the protection option back to its previous value (the dashboard shows it before saving; note it down first). The site is private again within seconds.

### 7. Production smoke checks
- **Who:** Builder (logged out, plain `curl` and a headless browser). Do not run load tests: the rate-limit rule is 300 requests per 60 s per IP on `/api/*`.
- **Commands and expected results:**
  | Check | Command | Expected |
  |---|---|---|
  | Health | `curl -s https://<PROD_URL>/api/v1/health` | 200, `model_available: true` |
  | Metadata | `curl -s https://<PROD_URL>/api/v1/metadata` | 200, `model_version` equals `<VERSION>`, `synthetic` false, planner defaults labelled illustrative |
  | Five pages | `for p in "" asset-details maintenance-planner model-performance about-data; do curl -s -o /dev/null -w "%{http_code} /$p\n" https://<PROD_URL>/$p; done` | all `200`, no login page |
  | Notice | open each page in the headless browser (`scripts/screenshots.mjs` or `npm run e2e:real` against `<PROD_URL>`) | the simulated-data notice is the first thing on each page |
  | Data endpoints | fleet, asset, model metrics, threshold analysis with the `mv=<VERSION>` parameter, from the metadata response | 200 with data; a missing `mv` gives 400 |
  | `/plan` size | `POST /api/v1/plan` with the default assumptions, then with an oversize body | 200 with a small answer (about 20 to 30 KB); a body over 4,096 bytes gets 413, as in `stage4-live-checks.md` |
  | Rate-limit rule | Vercel dashboard, Firewall tab: the rule "`/api/` 300 per 60 s per IP" is listed and active. Do not trigger it | rule present and active |
  | Cache headers | `curl -sI "https://<PROD_URL>/api/v1/health"`, `/metadata`, and a data URL with `mv` | `/health`: `no-store`; `/metadata`: `s-maxage=60, stale-while-revalidate=300`; data with `mv`: `public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400`; `POST /plan`: `no-store` |
  | Function size and cold start | Vercel build log and one request after idle | within the limits recorded in `stage4-live-checks.md`; cold start under a minute |
- **Rollback:** any failed check: go to step 9 (rollback) and record the result.

### 8. Add the live link
- **Who:** Builder drafts, Meysam merges. Change the README line "Live demo: (added at launch)" to the production address, and add the same link to the portfolio card. Keep the portfolio description from the brief word for word and keep "simulated" in it.
- **Expected:** README on the public repository shows a working link; the link opens without login.
- **Rollback:** revert the pull request.

### 9. Rollback (any time after step 5)
Fastest first:
1. **Hide the site, keep the code:** Vercel dashboard → Deployment Protection → restore the previous option (production behind login again).
2. **Go back to the previous production deployment:** Vercel → Deployments → pick the last good one → "Promote to Production" (or `vercel rollback`; the first launch has no earlier production deployment, so use option 1 or 3).
3. **Stop new production builds:** revert the step 5 pull request, so the `ignoreCommand` cancels every `main` build again.
4. **Make the repository private:** `gh repo edit bavafa/predictiq --visibility private --accept-visibility-change-consequences`. Note that a production build then cannot download the bundle, so any further production build fails (by design). The live site keeps serving its last build.
5. **Bad bundle:** do not edit the release in place. Build a new model version with `scripts/build_bundle.py`, publish a new `bundle-<version>` release, commit its manifest, and redeploy.

No domain is added at any step, and no environment variable or secret is needed.

## Part 2: release acceptance criteria (PROJECT_BRIEF section 9) with evidence

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | A public URL opens a working application without login; the portfolio card can link to it | Steps 3 to 8 above | **Open** (launch not done) |
| 2 | Fleet, Asset Details, Planner and Model Performance are usable and polished | Screenshots in `docs/QA_REPORTS/stage3-screenshots`, `stage4-screenshots`, `stage5-screenshots`; reviews `stage3-codex-review-round1..3`, `stage4-codex-review-round2..7`, `stage5-codex-review-round1..4` | Done (human review of polish is the owner's) |
| 3 | UI separates historical, predicted and illustrative values; data from the documented sample | Three value labels (`docs/ux-spec.md`), `docs/DATA_PROVENANCE.md`, the notice on every page (`frontend/e2e/notice.spec.ts`) | Done |
| 4 | Target, windows, splits and metrics reproducible; leakage checks pass | `ml/tests` (past-only scramble test), `make verify` recomputes `evaluation.json`; `docs/MODEL_CARD.md` | Done |
| 5 | All primary controls affect state or output | Vitest page tests, `frontend/e2e/*.spec.ts` | Done |
| 6 | Economic logic transparent, tested, caveated | Planner tests (`backend/tests`), decisions 55 and 64, `stage4-live-checks.md` | Done |
| 7 | No mock estimates or placeholder results in the released app | Production build refuses a synthetic bundle and fails without a real one (`frontend/tests/fetch-bundle.test.ts`; the end-to-end script `scripts/verify_bundle_download.sh` is not yet run) | Done in code; **open until production is checked** (step 7) |
| 8 | Unit, integration, E2E, accessibility and deployment smoke pass; limitations documented | `docs/QA_REPORTS/stage5-testing.md` (automated accessibility only: no human screen-reader or real-device test), About & Data limitations section, model card | Done except deployment smoke on production: **open** |
| 9 | Independent review at gates; critical and high findings resolved or accepted | `docs/QA_REPORTS/*-codex-review-*`; Stage 5 round 3 "pass with known issues", round 4 findings Medium/Low only | Done for Stage 5 sessions 1 to 2; a review of this launch-preparation session is **open** |
| 10 | README and portfolio case study: problem, dataset, design, architecture, ML evaluation, demo link, limitations | `README.md` (live link "(added at launch)"), `docs/MODEL_CARD.md` | README done; **portfolio case study and card are the owner's: open**; demo link open |

Also from the story "Public release and limitations": notice on every page (done, tested); data credit (applied as approved); limitations section (About & Data, Model Performance, model card); no secrets, personal information or private notes remain: the history scan found no secrets but **one personal author email in commit history and some internal paths in older commits** (see `docs/QA_REPORTS/stage5-history-scan.md`): owner decision **open**.

## Part 3: not part of this launch
Custom domains, accounts, analytics, a licence file for this repository's own code (owner to choose), human screen-reader testing, and any real-data claim.
