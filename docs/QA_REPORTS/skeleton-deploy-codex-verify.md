# Trial deploy check: independent review

Reviewer: Codex (gpt-6-sol, medium effort), read-only, 13 Nov 2026 about 11:07 PM ET. Its own sandbox could not reach GitHub or the preview, so it relied on the evidence below for those items.

## Evidence given to the reviewer

- The Vercel integration reported both new commits as deployed successfully (10:58 PM and 11:03 PM ET).
- Without signing in, every page of the preview returns Vercel's sign-in redirect (302, 263 bytes). Protection is on, as intended.
- Neither of our sanctioned ways in works yet: the Vercel connector is authorised only for another project, and the Vercel command-line tool on the build machine is not signed in.
- A local Vercel build (no sign-in) showed the data service was missing from the function. After the fix, the function holds 511 files, 11,081,986 bytes uncompressed (estimate, local build), and health and metadata both answer 200 with the intended caching headers when called inside the build.

## Review

## Findings

- **High — The Vercel trial deploy has not passed its hosting gate.** The supplied Vercel integration statuses report success for `5f167a9` and `043c547`, but they establish deployment completion, not working routes. The preview’s reported 302 protection redirects provide no Next.js or FastAPI response. I could not independently confirm the statuses or redirects: GitHub API and curl requests failed from this sandbox.
- **Medium — The Python bundle fix is locally supported, with live timing still unverified.** The supplied `vercel build` check found 511 bundled files (11,081,986 uncompressed bytes) and got 200 from in-process ASGI calls to health and metadata. That supports the [prebuild copy](/workspace/predictiq/frontend/scripts/sync-backend.mjs:5), [include/exclude rules](/workspace/predictiq/frontend/vercel.json:11), and [adapter import](/workspace/predictiq/frontend/api/index.py:15). It does not prove the same build order or runtime behavior on Vercel.
- **Low — Test and documentation gaps.** The [adapter test](/workspace/predictiq/backend/tests/test_deploy_layout.py:16) can pass through its checkout fallback without testing a function bundle. The [mobile menu test](/workspace/predictiq/frontend/tests/app-shell.test.tsx:91) prevents navigation, so it verifies focus after closing the menu but not after a real route change. The [adapter docstring](/workspace/predictiq/frontend/api/index.py:3) still describes the former `backend/app` bundle layout. The focus implementation itself is coherent: the root layout retains `AppShell`, and the effect focuses the main landmark after the menu closes. The generated copy is correctly gitignored.

## Check table

| Hosting check | Result | Evidence and limit |
|---|---|---|
| One project serves Next.js and `/api/v1` | **PARTIAL** | Successful deployment statuses and local FastAPI ASGI calls; no live response from either route. |
| Python bundle under 500 MB | **PARTIAL** | Local build estimate: 11,081,986 bytes uncompressed. No measured deployed bundle size. |
| Cold starts: median <3 s, worst <10 s, n≥10 | **NOT MET** | No live timing samples. |
| Largest allowed response <256 KB | **NOT MET** | Protection redirects are not application payloads; no endpoint maximum was measured. |
| Cache headers, HIT/MISS, WAF 429 | **PARTIAL** | Local ASGI responses had the specified health and metadata headers. No live cache result or WAF 429 evidence. |
| Owner confirms non-commercial use | **MET** | Owner approval is recorded in [decision 47](/workspace/predictiq/DECISIONS.md:111). |

## Verdict

**Do not mark the Vercel trial deploy passed.** The bundle repair has credible local evidence, and the menu focus change is reasonable, but the protected preview leaves the live routing, performance, response size, caching, and WAF checks unverified. Under “no evidence means not met,” the hosting decision gate remains open.
