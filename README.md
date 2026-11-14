# PredictIQ

Portfolio demo: from machine failure predictions to maintenance decisions. See `docs/PROJECT_BRIEF.md`.

> Portfolio demo — historical sample data; estimated economics are illustrative.

## Status: project skeleton only

There is **no model, no scores and no numbers** yet. What exists:

- A Next.js app shell with the five pages (Fleet Overview, Asset Details, Maintenance Planner, Model Performance, About & Data). Four show an honest "Not built yet" state; About & Data is real text about the data.
- A small FastAPI data service with two endpoints, `GET /api/v1/health` and `GET /api/v1/metadata` (it reports `model_version: null`, `model_available: false`).
- A real download script for the Microsoft sample data that checks SHA-256 fingerprints.
- Empty `ml/` modules that exit with "not implemented in the skeleton story".
- CI, tests and a deploy layout for Vercel (**untested on Vercel**; see `docs/DEPLOY.md`).

The data is **simulated sample data published by Microsoft** (see `docs/DATA_PROVENANCE.md`), never real plant or fleet data.

## Run it

Needs Node 24, [uv](https://docs.astral.sh/uv/) (it installs Python 3.12) and `make`.

```bash
make setup      # uv sync + npm ci
make dev        # data service on :8000, web app on :3000 (proxies /api/v1)
make data       # optional now: download the five CSVs to data/raw/ (80 MB) and verify SHA-256
```

Open http://localhost:3000. Without `make`, run the commands inside the Makefile targets.

## Check it

```bash
make lint        # ruff + eslint
make typecheck   # mypy + tsc
make test        # pytest + Vitest
make e2e         # builds, then one Playwright smoke test (locally reuses /usr/bin/google-chrome if present)
make screenshots # docs/QA_REPORTS/skeleton-screenshots/ (needs playwright-core and Chrome; see the script header)
```

`make train`, `make evaluate`, `make verify` and `make replay` print "not implemented yet (data-and-model stage)" and exit 1 on purpose.

## Layout

```text
frontend/   Next.js app (Vercel Root Directory), tests/, e2e/, api/index.py (Vercel adapter)
backend/    FastAPI data service: app/, tests/
ml/         validate.py labels.py features/ train.py evaluate.py replay.py (placeholders), tests/
scripts/    download_data.py (hash-checked download), screenshots.mjs
docs/       brief, requirements, design, architecture, DEPLOY.md, QA reports
```

Decisions are in `DECISIONS.md`; progress in `STATUS.md` and `TASKS.md`.
