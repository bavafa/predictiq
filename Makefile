.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help setup lint typecheck test e2e build dev data export-requirements screenshots train evaluate verify replay

help:
	@echo "Targets: setup lint typecheck test e2e build dev data screenshots export-requirements"
	@echo "         train evaluate verify replay (stubs until the data-and-model stage)"

setup: ## install Python (uv) and Node (npm ci) dependencies
	uv sync
	cd frontend && npm ci

lint:
	uv run ruff check .
	uv run ruff format --check .
	cd frontend && npm run lint

typecheck:
	uv run mypy
	cd frontend && npm run typecheck

test:
	uv run pytest
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

# Regenerate the pinned requirements.txt that Vercel installs (frontend/ is the Vercel Root Directory).
export-requirements:
	uv export --no-dev --no-hashes --frozen --no-emit-project -o frontend/requirements.txt

screenshots: build
	node scripts/screenshots.mjs

train evaluate verify replay:
	@echo "$@: not implemented yet (data-and-model stage)" >&2
	@exit 1
