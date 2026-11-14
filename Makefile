.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help setup lint typecheck test e2e build dev data validate labels features splits test-realdata export-requirements screenshots train evaluate verify replay

help:
	@echo "Targets: setup lint typecheck test e2e build dev data validate labels features splits screenshots export-requirements"
	@echo "         train evaluate verify replay"

setup: ## install Python (uv) and Node (npm ci) dependencies
	uv sync --group ml
	cd frontend && npm ci

lint:
	uv run --group ml ruff check .
	uv run --group ml ruff format --check .
	cd frontend && npm run lint

typecheck:
	uv run --group ml mypy
	cd frontend && npm run typecheck

test:
	uv run --group ml pytest
	cd frontend && npm test

build:
	cd frontend && npm run build

# Playwright smoke test against `next start`. Locally: PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome
e2e: build
	cd frontend && npm run e2e

# Data service on :8000 and the web app on :3000 (which proxies /api/v1 to it).
dev:
	@trap 'kill 0' EXIT; \
	uv run uvicorn app.main:app --app-dir backend --port 8000 & \
	cd frontend && API_PROXY_URL=http://127.0.0.1:8000 npm run dev

# Download the five Microsoft CSV files to data/raw/ and verify SHA-256 (docs/DATA_PROVENANCE.md).
data:
	uv run python scripts/download_data.py

# Data checks, 24-hour label summary, past-only features (timed) and split facts. Need `make data` first.
validate:
	uv run --group ml python -m ml.validate

labels:
	uv run --group ml python -m ml.labels

features:
	uv run --group ml python -m ml.features

splits:
	uv run --group ml python -m ml.splits

# Real-data tests (opt-in; skipped when data/raw is missing).
test-realdata:
	uv run --group ml pytest -m realdata -q

# Regenerate the pinned requirements.txt that Vercel installs (frontend/ is the Vercel Root Directory).
export-requirements:
	uv export --no-dev --no-hashes --frozen --no-emit-project -o frontend/requirements.txt

screenshots: build
	node scripts/screenshots.mjs

# Models, then the one-time test evaluation, then the read-only re-check, then the replay start.
train:
	uv run --group ml python -m ml.train

evaluate: ## once per model version; refuses if evaluation.json exists
	uv run --group ml python -m ml.evaluate --write

verify: ## read-only re-check of the saved test result
	uv run --group ml python -m ml.evaluate --verify

replay:
	uv run --group ml python -m ml.replay
