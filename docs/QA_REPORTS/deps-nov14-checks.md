# Dependency updates tested together (branch `deps-nov14`, 14 Nov 2026)

This branch applies the automatic update pull requests from Dependabot on top of main `6a33938` (decision 62). The original pull requests were opened against an older main, so each version bump was made again here rather than merged.

| Pull request | Update | Result |
|---|---|---|
| #28 | fastapi 0.136.1 → 0.162.4 | **Included.** One test needed a fix (below). FastAPI 0.162 also adds `opentelemetry-api` as a dependency. |
| #25 | pydantic 2.13.4 → 2.14.3 | **Included.** No changes needed. |
| #27 | pydantic-core 2.46.4 → 2.50.4 | **Included.** This is the version pydantic 2.14.3 requires. |
| #26 | eslint 9.39.5 → 10 (range `^10.14.0`, locked at 10.15.0) | **Included.** No code changes needed. See the eslint risk below. |
| #24 | typescript 6.0.3 → 7.0.2 | **Left out.** Linting cannot run with it (below). |

## Why TypeScript 7 is left out
`npm run lint` stops with "typescript-eslint does not support TS 7.0." The latest typescript-eslint, 8.72.2, supports only TypeScript up to 6.0. Next's lint setup (`eslint-config-next` 16.4.6) depends on typescript-eslint. Making TypeScript 7 work would mean dropping the TypeScript lint rules, which is not a clean fix. Type checking and the unit tests did pass with TypeScript 7. Try again when typescript-eslint supports TypeScript 7.

## The FastAPI fix
In FastAPI 0.162, `app.routes` no longer lists the routes added through `include_router`; it holds one internal wrapper object instead. Only one test read that list: the route-contract test in `backend/tests/test_api.py`. It now reads the app's OpenAPI schema. It checks the same ten paths and, new, their methods. It also checks that an unknown `/api/v1` path returns 404. A second new test fails if the app code ever serves a route the schema would not show (`include_in_schema`, mounted apps, raw routes, websockets, or extra `add_api_route` calls). I checked that this guard fails when such a line is added. No app code changed.

## ESLint 10 still applies the same rules
- The resolved lint setup has 113 rules on both main (ESLint 9) and this branch.
- A test file with deliberate mistakes got the same five findings from both versions: rules of hooks, `any`, unused variable, image without alt text, and `<img>` instead of Next's image component.
- The React, import and accessibility lint plugins officially list ESLint up to 9, so npm warns about their supported versions. They load and run correctly.

## Results (box, 14 Nov 2026, about 3:15–3:35 PM Toronto time)
- Python: ruff and mypy pass.
- pytest, after the fixes: 239 passed, 16 deselected by default; 255 passed with the opt-in real-data and real-bundle tests. Before the fix, 1 test failed (the old route-contract test).
- `frontend/requirements.txt` matches `uv export` exactly.
- Frontend: lint passes, typecheck passes, Vitest 142 passed, `next build` succeeds.
- Playwright: synthetic 60 passed and 4 skipped; no-bundle 7 passed; real model bundle 64 passed.
- Security audits: `pip-audit` found no known vulnerabilities. `npm audit --audit-level=high` passes. The 7 moderate warnings (minimatch, via typescript-eslint) are development-only tools.
- Protected preview built on the box with the hash-checked real bundle: `dpl_ACF5No61Y9LkJkEKvasJjM3QYky2`, preview only, protection on.
  - Data-service function size: 30,288,382 bytes (main: 30,005,883). The limit is 500 MB.
  - health, metadata and fleet return 200. A wrong model version returns 404, and an unknown path returns 404.
  - The largest planner answer was 25,466 bytes, the same as main, over three identical answers. The error responses were unchanged: 404, 422, 422 and 413. All were no-store.
  - The pages return 200. Without the bypass, requests are redirected to sign-in (302).

Raw output is in `deps-nov14-evidence/`. It holds pytest, static checks, the requirements sync, pip-audit, the frontend checks (lint, typecheck, Vitest, versions), Playwright and the live preview. `manual-checks.txt` holds the TypeScript 7 failure, the ESLint comparison and the route-guard probe, copied from the terminal. The Playwright and live-preview logs come from before the two test-only commits; those commits did not change app code.
