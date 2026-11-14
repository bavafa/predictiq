# Deploying PredictIQ (Vercel)

Status: **nothing is deployed and the layout below is untested on Vercel.** It was written from Vercel's current docs (read 13 Nov 2026) and checked locally only. The trial deploy (deploy spike, decision 41) must confirm it. The owner holds the Vercel credentials.

## Layout chosen

One Vercel project, one deployment, **an ordinary Vercel Python function. Not Vercel Services** (decision 41).

| Setting | Value |
|---|---|
| **Root Directory** | **`frontend`** |
| Framework preset | Next.js (also set in `frontend/vercel.json`) |
| Install / build / output | Vercel defaults for Next.js (`npm install`, `next build`) |
| Python function | `frontend/api/index.py`, an adapter that imports the FastAPI `app` from `frontend/_backend/app/`, a build-time copy of `backend/app/` |
| Python version | 3.12 (`frontend/.python-version`; also Vercel's default) |
| Python dependencies | `frontend/requirements.txt`, pinned, generated from `uv.lock` |
| Include source files outside the Root Directory | **must stay enabled** (Project Settings → Build and Deployment; it is the default). The build copies `backend/app/` into `frontend/_backend/app/`, because Vercel does not bundle `../backend` through `includeFiles`. |

Routing, in `frontend/vercel.json`:

```json
"rewrites": [{ "source": "/api/v1/:path*", "destination": "/api/index" }]
```

`/api/v1/*` goes to the Python function (FastAPI serves `/api/v1/health` and `/api/v1/metadata` from the original request path). Every other path goes to Next.js. The site and the API share one origin, so the browser calls plain `/api/v1/...` with no CORS.

### Why this and not another layout

Vercel's Python pages say that running a Python backend beside another framework is what **Services** is for. Services is beta, and decision 41 rules it out. The docs do show that `.py` files in an `api/` folder become Python functions, with `app` as the ASGI object, so this layout relies on that older, ordinary mechanism next to a Next.js project. **The docs do not state that this combination works, nor how `api/` maps to a Root Directory.** That is exactly what the trial deploy proves.

### How the backend gets into the function
`backend/` stays the only source. `npm run build` first runs `frontend/scripts/sync-backend.mjs` (the `prebuild` step), which copies `backend/app` into `frontend/_backend/app` (git-ignored, never edited by hand). `vercel.json` then lists `_backend/app/**` under `includeFiles` so the function bundle contains it, and `excludeFiles` removes the Next.js `app/**` folder so the Python package name `app` is not ambiguous. `api/index.py` imports only from the bundle's own `_backend/` and fails loudly if it is missing. Check it without deploying by building locally and calling `/api/v1/health` and `/api/v1/metadata` (the end-to-end run, `npm run e2e` in `frontend/`, does the same against the real data service). If routing itself fails, decision 41 falls back to Render for the data service.

### Bundle size

`frontend/vercel.json` sets `functions["api/index.py"].excludeFiles` to drop `node_modules`, `.next`, `e2e`, `tests`, `components`, `lib`, `public` and test reports from the Python function. Python tests, `ml/`, `data/` and `artifacts/` are outside the Root Directory and are not part of the function. The runtime dependencies are only FastAPI and Pydantic. No model libraries (decision 32). Vercel's limit is 500 MB uncompressed; the trial deploy records the real size.

## The model bundle (data-and-model stage, session 3)

The data endpoints read a **serving bundle**: one folder per model version, about 10.1 MB uncompressed (10 files: NumPy arrays plus small JSON), 8.1 MB as `bundle.zip`. It is never committed. The service finds it in `_backend/bundle/` beside the app (the Vercel copy), or in `artifacts/<version>/bundle/` in a git checkout. **If no bundle is present, every data endpoint answers 503 (never cached), `/health` says `model_available: false`, and nothing is faked.**

### Making and publishing a bundle (owner or orchestrator)
1. Build it from the saved model and the real data: `uv run --group ml python -m scripts.build_bundle`. It prints the byte totals and writes `artifacts/<version>/bundle.zip`, `bundle.sha256` (committed) and a `bundle` entry in `manifest.json` (committed). Running it twice gives the same hash.
2. Create the release once (not done by any script; this is the exact command, run from the repository root):

```bash
gh release create bundle-piq-20261114-efc9c243 artifacts/piq-20261114-efc9c243/bundle.zip \
  --repo bavafa/predictiq --prerelease \
  --title "Serving bundle piq-20261114-efc9c243 (simulated data)" \
  --notes "Serving bundle for model version piq-20261114-efc9c243. Simulated sample data. SHA-256 is in artifacts/piq-20261114-efc9c243/manifest.json."
```

3. Anyone else gets it with `uv run python -m scripts.fetch_bundle`. It runs `gh release download bundle-<version> --repo bavafa/predictiq --pattern bundle.zip`, checks the SHA-256 against the committed manifest, refuses anything that does not match (or that is marked synthetic), and unpacks into `artifacts/<version>/bundle/`.

### Putting it in the Vercel function
`npm run build` runs `frontend/scripts/sync-backend.mjs` first. It copies `artifacts/<latest version>/bundle/` into `frontend/_backend/bundle/` (git-ignored) when it exists, and `vercel.json` includes `_backend/bundle/**` in the function. **The copy refuses to run (exit 1) if the bundle's `meta.json` is not marked `"synthetic": false`**, so a test bundle can never be deployed. Because `artifacts/*/bundle/` is git-ignored, a build that Vercel runs from a Git push has no bundle (data endpoints answer 503). A deploy made from a machine that has run `fetch_bundle.py` (or `build_bundle.py`) includes it. Measure the function size on the deploy as before; the function should grow by about 10 MB plus numpy (about 30 MB). The largest-request test (`backend/tests/test_sizes.py`) prints the response sizes; against the real bundle the biggest answer is `model/threshold-analysis` at about 145 KB (limit 256 KB).

### Runtime
Only `numpy` was added to the function's dependencies (pinned in `pyproject.toml` and `frontend/requirements.txt`). Arrays are read memory-mapped. Explanations use XGBoost's own `pred_contribs` at build time, so `shap` is not used anywhere. No model library is imported at runtime.

## Builds are skipped for `main`

`frontend/vercel.json`:

```json
"ignoreCommand": "[ \"$VERCEL_GIT_COMMIT_REF\" = \"main\" ]"
```

Vercel's rule: exit code `0` means **skip** the build, `1` means build. So pushes to `main` exit 0 and are canceled (no production deployment until the owner decides). Every other branch exits 1 and gets a **preview** build. A deploy with no branch (CLI) also builds. `backend/tests/test_deploy_layout.py` checks the command for `main`, other branches, and an unset branch. Canceled builds still appear in the Vercel dashboard and count toward deployment quotas.

To allow production later, delete the `ignoreCommand` line (or change the branch name) and record the owner's decision.

## Keeping `requirements.txt` in sync

`uv.lock` is the source of truth. After changing Python dependencies:

```bash
uv lock && make export-requirements   # or the uv export command inside that target
```

CI re-exports and fails on any difference. `frontend/requirements.txt` contains no dev tools.

## Cache headers

Set by FastAPI per the architecture: `/health` and every error `no-store`; `/metadata` `public, max-age=0, s-maxage=60, stale-while-revalidate=300`. Whether Vercel honours them for a function response, and whether the query string is in the cache key, are checks in spike criterion 5.

## Local setup that mirrors Vercel

Vercel itself cannot run here. Locally, `make dev` starts FastAPI on :8000 and Next.js on :3000; Next.js proxies `/api/v1/*` to FastAPI when `API_PROXY_URL=http://127.0.0.1:8000` is set (it is not set on Vercel, where the rewrite above does the job). `vercel dev` would be closest but needs the owner's credentials.

## Not part of the skeleton story

The WAF rate-limit rule, project creation, environment variables (none are needed), domain, and the owner's written Hobby-eligibility confirmation (done in decision 47). Deploys never run from CI.
