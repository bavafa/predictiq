#!/usr/bin/env bash
# Fresh-copy check: does everything pass on a clean copy of the repository, with nothing left over from this machine?
#
#   scripts/fresh_copy_check.sh            clone HEAD of this repository into a temporary folder and run every check there
#   KEEP=1 scripts/fresh_copy_check.sh     keep the temporary folder afterwards (its path is printed)
#   REQUIRE_REAL=1 scripts/fresh_copy_check.sh   skipping the real-bundle part is a FAILURE (exit 1), not a note
#
# Only COMMITTED files are in the copy (git clone of the local repository), so uncommitted changes are not tested:
# commit first. The copy has no node_modules, no .venv, no .next, no data/raw and no bundle.
#
# Steps, in order. The first failing step stops the run with a non-zero exit code.
#   web:     npm ci, lint, typecheck, Vitest, build, Playwright on the synthetic test bundle, then with no bundle
#   python:  uv sync --frozen --group ml, ruff check, ruff format --check, mypy, pytest (default selection)
#   release: the release-hygiene test (it is part of the default pytest run; it runs on its own too, for the log)
#   real:    only if `python -m scripts.fetch_bundle` can fetch and verify the real bundle (needs the GitHub CLI and
#            network): the real-bundle Playwright run and `pytest -m ""`. Otherwise this part is SKIPPED and the last line says
#            "PASSED (real-bundle checks skipped: <reason>)", never plain "PASSED". With REQUIRE_REAL=1 a skip fails.
#
# Nothing here sets or reads an API key, and nothing touches Vercel.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/predictiq-fresh.XXXXXX")"
COPY="$WORK/predictiq"
STARTED=$SECONDS
REAL_SKIP_REASON=""
DATA_SKIP_REASON=""

cleanup() {
  if [[ "${KEEP:-0}" == "1" ]]; then
    echo "Kept the copy at $COPY"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

step() {
  echo
  echo "=================================================================================="
  echo "== $*"
  echo "=================================================================================="
}

if [[ -n "$(git -C "$SRC" status --porcelain)" ]]; then
  echo "NOTE: $SRC has uncommitted changes. They are NOT part of the copy and are not tested."
fi

step "clone HEAD into a temporary folder"
git clone --quiet "$SRC" "$COPY"
echo "commit under test: $(git -C "$COPY" rev-parse HEAD)"
echo "branch:            $(git -C "$SRC" rev-parse --abbrev-ref HEAD)"
echo "files in the copy: $(git -C "$COPY" ls-files | wc -l)"

cd "$COPY/frontend"
step "web: npm ci";                  npm ci --no-audit --no-fund
step "web: lint";                    npm run lint
step "web: typecheck";               npm run typecheck
step "web: Vitest";                  npm test
step "web: build";                   npm run build
step "web: Playwright, synthetic bundle, then no bundle (npm run e2e)"; npm run e2e

cd "$COPY"
step "python: uv sync --frozen --group ml"; uv sync --frozen --group ml
step "python: ruff check";           uv run --group ml ruff check .
step "python: ruff format --check";  uv run --group ml ruff format --check .
step "python: mypy";                 uv run --group ml mypy
step "python: pytest (default)";     uv run --group ml pytest
step "release hygiene test";         uv run --group ml pytest scripts/tests/test_release_hygiene.py -rxX
step "design token and contrast test, and the contrast script"
uv run --group ml pytest scripts/tests/test_design_tokens.py -q
python3 -I docs/design/check-contrast.py | tail -3

step "real bundle: fetch and verify (python -m scripts.fetch_bundle)"
if uv run --group ml python -m scripts.fetch_bundle; then
  step "real bundle: Playwright (npm run e2e:real)"
  (cd "$COPY/frontend" && npm run e2e:real)
  if [[ "${REQUIRE_REAL:-0}" == "1" ]]; then
    step "real data: download and verify SHA-256 (scripts/download_data.py, as in make data)"
    uv run python scripts/download_data.py
  else
    DATA_SKIP_REASON="raw data not downloaded (set REQUIRE_REAL=1 to download it), so realdata tests skip"
    echo "NOTE: $DATA_SKIP_REASON."
  fi
  step 'real bundle: pytest -m ""'
  uv run --group ml pytest -m ""
else
  REAL_SKIP_REASON="the real bundle could not be fetched and verified (no network, no GitHub CLI login, or no release)"
  echo "SKIPPED: $REAL_SKIP_REASON."
  echo "The real-bundle Playwright run and pytest -m \"\" were NOT run in the fresh copy."
  if [[ "${REQUIRE_REAL:-0}" == "1" ]]; then
    echo "FRESH COPY CHECK FAILED: REQUIRE_REAL=1 and the real-bundle checks were skipped: $REAL_SKIP_REASON." >&2
    exit 1
  fi
fi

echo
echo "=================================================================================="
SKIPS=""
if [[ -n "$REAL_SKIP_REASON" ]]; then SKIPS="real-bundle checks skipped: $REAL_SKIP_REASON"; fi
if [[ -n "$DATA_SKIP_REASON" ]]; then SKIPS="${SKIPS:+$SKIPS; }real-data tests skipped: $DATA_SKIP_REASON"; fi
if [[ -n "$SKIPS" ]]; then
  echo "FRESH COPY CHECK PASSED ($SKIPS). Time: $((SECONDS - STARTED)) s."
else
  echo "FRESH COPY CHECK PASSED (every step above succeeded, including the real-bundle and real-data checks). Time: $((SECONDS - STARTED)) s."
fi
echo "=================================================================================="
