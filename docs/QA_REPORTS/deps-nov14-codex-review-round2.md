## Findings

- **Medium — [route guard](/workspace/predictiq/backend/tests/test_api.py:76):** The new test scans source text for selected strings; it does not inspect served routes. For example, adding a Starlette `Route` through `app.router.routes.append(...)` would evade the scan and OpenAPI check. The recorded probe adds a comment containing `include_in_schema`, so it proves only that the string scan fires. The claim in [the checks report](/workspace/predictiq/docs/QA_REPORTS/deps-nov14-checks.md:17) that the guard catches any schema-hidden served route is too broad. I found no extra route in the current app.

## Round 1 items

- **Route test: not fixed.** The new guard narrows the gap but does not establish the exact served contract.
- **Evidence logs: fixed.** The checked-in logs now show 239 and 255 passing pytest tests, passing lint and Vitest, and no known vulnerabilities from `pip-audit`. The earlier Playwright and preview logs remain consistent with the report’s note that subsequent commits changed tests and docs only.
- **Decision 67: fixed.** [DECISIONS.md](/workspace/predictiq/DECISIONS.md:195) now says four updates were included and TypeScript 7 was left out, matching [STATUS.md](/workspace/predictiq/STATUS.md:7).

This was a read-only, offline review of the diff and checked-in evidence; I did not rerun the checks.

**Verdict: PASS WITH KNOWN ISSUES**
