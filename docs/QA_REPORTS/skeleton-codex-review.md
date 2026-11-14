# PredictIQ skeleton QA review

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Reviewed git diff 83945b7..a043428 on branch skeleton. Saved verbatim; local file links refer to the orchestrator box._

**Recommendation: PASS WITH KNOWN ISSUES for the skeleton code review.** I found no Critical or High issue in `git diff 83945b7 HEAD`. This does **not** certify CI execution or the Vercel layout: neither has been verified on its target service, and the trial deploy has not happened.

## Findings

### Medium

1. **CI does not run the required accessibility scan.** [ci.yml](/workspace/predictiq/.github/workflows/ci.yml:33) runs Playwright, but [smoke.spec.ts](/workspace/predictiq/frontend/e2e/smoke.spec.ts:1) only checks navigation and text. The [architecture](/workspace/predictiq/docs/architecture.md:114) requires Playwright with axe on every pull request. **Reproduction:** inspect the sole E2E spec; it has no axe invocation. **Why it matters:** CI can pass despite detectable accessibility failures. **Fix:** add an axe check to the E2E suite, including a mobile viewport. **Confidence: high.**

2. **GitHub Actions use mutable version tags.** [ci.yml](/workspace/predictiq/.github/workflows/ci.yml:21) uses tags such as `actions/checkout@v4`, `astral-sh/setup-uv@v6`, and `gitleaks/gitleaks-action@v2`. **Reproduction:** inspect the workflow’s `uses:` entries. **Why it matters:** a tag can resolve to different code later. **Fix:** pin each action to a reviewed commit SHA and keep update notes beside it. **Confidence: high.**

3. **The open mobile menu does not isolate background content for assistive technology.** [app-shell.tsx](/workspace/predictiq/frontend/components/app-shell.tsx:95) adds a visual overlay and traps keyboard Tab within the navigation, but does not make the rest of the page inert or expose the panel as a modal. **Reproduction:** open the menu and inspect the background’s accessibility tree; the page remains available behind it. **Why it matters:** screen reader users can encounter controls that appear blocked visually. **Fix:** use a dialog pattern with appropriate modal semantics and inert background content, or otherwise ensure background content is unavailable while open. **Confidence: medium.**

### Low

4. **Status and provenance notes contain stale stage statements.** [STATUS.md](/workspace/predictiq/STATUS.md:9) still says nothing is built and architecture fixes are uncommitted, despite its later skeleton update. [DATA_PROVENANCE.md](/workspace/predictiq/docs/DATA_PROVENANCE.md:72) calls the download script “not built yet.” **Reproduction:** compare those lines with the files in this diff. **Why it matters:** readers may misjudge what has been implemented. **Fix:** update or clearly date the historical notes. **Confidence: high.**

5. **Dependabot configuration is absent.** The [architecture](/workspace/predictiq/docs/architecture.md:152) calls for Dependabot; `.github/` contains only the CI workflow. **Reproduction:** list tracked files under `.github/`. **Why it matters:** dependency update alerts and PRs are not configured as specified. **Fix:** add a Dependabot configuration for npm, Python, and GitHub Actions. **Confidence: high.**

## Checks and evidence

- **Passed locally:** Ruff check and format check; mypy with its cache disabled; TypeScript typecheck; ESLint; 16 Vitest tests; five selected Python tests; token contrast script; `git diff --check`. `python -m ml.train` printed its stub message and exited **1**.
- **Python suite unverified:** the full pytest command could not create a temporary file in this read-only sandbox. A narrower run stalled at its first FastAPI `TestClient` request and was interrupted. Five tests that did not require that request or a temporary directory passed.
- **Not run here:** Next.js build and Playwright E2E, which produce files; network dependent audits and the data download. CI has not run on GitHub.
- **Reviewed directly:** all 11 desktop, mobile, and menu screenshots. They show the disclosure on each page, “Historical replay” wording, and empty states without fabricated scores, charts, or tables.
- **Security review:** a tracked-file and text scan found no committed credential material. The workflow’s `GITHUB_TOKEN` entry is a reference to GitHub’s token, not a committed token value. The current API has no user input parameters; its health, metadata, and error cache rules match the applicable architecture table. No CORS middleware is needed for the documented same-origin layout. The download script uses a pinned source and verifies file size and SHA-256 before saving.

The Vercel adapter, rewrite, `excludeFiles`, and `ignoreCommand` are internally consistent with [DEPLOY.md](/workspace/predictiq/docs/DEPLOY.md:19); the shell command returns `0` to skip `main` and `1` for other branches. **Actual Vercel routing, bundle contents, caching, and deploy behavior remain unchecked until the trial deploy.**