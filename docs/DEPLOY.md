# Deploying PredictIQ (Vercel)

Status: **nothing is deployed and the layout below is untested on Vercel.** It was written from Vercel's current docs (read 13 Nov 2026) and checked locally only. The trial deploy (deploy spike, decision 41) must confirm it. The owner holds the Vercel credentials.

## Layout chosen

One Vercel project, one deployment, **an ordinary Vercel Python function. Not Vercel Services** (decision 41).

| Setting | Value |
|---|---|
| **Root Directory** | **`frontend`** |
| Framework preset | Next.js (also set in `frontend/vercel.json`) |
| Install / build / output | Vercel defaults for Next.js (`npm install`, `next build`) |
| Python function | `frontend/api/index.py`, an adapter that imports the FastAPI `app` from `backend/app/` |
| Python version | 3.12 (`frontend/.python-version`; also Vercel's default) |
| Python dependencies | `frontend/requirements.txt`, pinned, generated from `uv.lock` |
| Include source files outside the Root Directory | **must stay enabled** (Project Settings → Build and Deployment; it is the default). The adapter imports `backend/`, which sits next to `frontend/`. |

Routing, in `frontend/vercel.json`:

```json
"rewrites": [{ "source": "/api/v1/:path*", "destination": "/api/index" }]
```

`/api/v1/*` goes to the Python function (FastAPI serves `/api/v1/health` and `/api/v1/metadata` from the original request path). Every other path goes to Next.js. The site and the API share one origin, so the browser calls plain `/api/v1/...` with no CORS.

### Why this and not another layout

Vercel's Python pages say that running a Python backend beside another framework is what **Services** is for. Services is beta, and decision 41 rules it out. The docs do show that `.py` files in an `api/` folder become Python functions, with `app` as the ASGI object, so this layout relies on that older, ordinary mechanism next to a Next.js project. **The docs do not state that this combination works, nor how `api/` maps to a Root Directory.** That is exactly what the trial deploy proves.

### If the trial deploy shows the adapter cannot see `backend/`

Fallback layout, no change of host: copy `backend/app` into `frontend/api/_backend/app` during the build (the adapter already looks there first), or move the Root Directory to the repository root and point `vercel.json` there. If routing itself fails (criterion 1), decision 41 falls back to Render for the data service.

### Bundle size

`frontend/vercel.json` sets `functions["api/index.py"].excludeFiles` to drop `node_modules`, `.next`, `e2e`, `tests`, `components`, `lib`, `public` and test reports from the Python function. Python tests, `ml/`, `data/` and `artifacts/` are outside the Root Directory and are not part of the function. The runtime dependencies are only FastAPI and Pydantic. No model libraries (decision 32). Vercel's limit is 500 MB uncompressed; the trial deploy records the real size.

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
