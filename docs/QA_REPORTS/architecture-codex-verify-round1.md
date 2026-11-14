# Codex targeted re-verification of the architecture stage, round 1

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Saved verbatim._

# PredictIQ architecture re-verification

**Gate recommendation: PASS WITH KNOWN ISSUES.** The High finding is resolved, and the revised dataset counts check out. The hosting design remains conditional on the documented deploy spike. I found two new documentation issues below. This is a document review; no app or deployment exists to verify.

| Earlier finding | Status | Evidence |
|---|---|---|
| **High — incomplete labels at the test end** | **RESOLVED** | [Architecture](/workspace/predictiq/docs/architecture.md:27) now drops hours whose 24-hour outcome window passes the last observed failure. Test scoring and replay end at **2015-12-30 06:00** ([split](/workspace/predictiq/docs/architecture.md:52), [replay](/workspace/predictiq/docs/architecture.md:68)); [decision 34](/workspace/predictiq/DECISIONS.md:83) agrees. |
| **Medium — uncertain Vercel configuration** | **PARTIALLY RESOLVED** | [Architecture](/workspace/predictiq/docs/architecture.md:129) now distinguishes ordinary Python functions from Services and makes routing, bundle size, cold start and Hobby eligibility explicit spike criteria. The proposed Next.js-plus-FastAPI arrangement without Services has not been deployed; the document correctly treats it as unproven. |
| **Medium — cache and rate-limit contract** | **PARTIALLY RESOLVED** | [Architecture](/workspace/predictiq/docs/architecture.md:74) specifies headers and versioned requests; [rate limiting](/workspace/predictiq/docs/architecture.md:148) uses a platform WAF rule rather than per-instance counters. Cache-key behavior and the 429 rule still require the planned spike. A new version-contract inconsistency is noted below. |
| **Medium — “run once” versus reproducibility** | **RESOLVED** | [Architecture](/workspace/predictiq/docs/architecture.md:58) separates one immutable `--write` from read-only, repeatable `--verify`; [decision 43](/workspace/predictiq/DECISIONS.md:101) agrees. |
| **Low — unverified size claims** | **RESOLVED** | [Architecture](/workspace/predictiq/docs/architecture.md:97) calls 256 KB a target, and [bundle sizing](/workspace/predictiq/docs/architecture.md:120) states its format and assumptions as an estimate. Both are assigned measurements in the spike. |

## Recomputed data facts

Read-only queries of `/workspace/pdm-raw` found **761 failure rows / 719 distinct machine-hour events**. The last failure is **2015-12-31 06:00**, so the stated censoring rule gives a last scored hour of **2015-12-30 06:00**. Event-time counts are **17 before scoring, 473 train, 3 first embargo, 109 validation, 3 second embargo, 110 test, and 4 after test**. The inclusive test window has **1,423 hours × 100 machines = 142,300 machine-hours**. Of the 110 test events, **107** have a full 24-hour lookback inside scored test hours. These figures support [the revised split](/workspace/predictiq/docs/architecture.md:46).

## Current provider check

The earlier report’s **“Python runtime Beta” statement is incorrect today**: the [Python runtime page](https://vercel.com/docs/functions/runtimes/python) has no runtime Beta label, and Vercel’s [15 October 2026 GA changelog](https://vercel.com/changelog/python-on-vercel-is-now-generally-available) explicitly announces general availability. [Services](https://vercel.com/docs/services) says **Beta on all plans**, not Private Beta. [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) supports one Hobby rule, an IP key, a 10-second to 10-minute fixed window, and a 429 action. [Terms section 4](https://vercel.com/legal/terms) contains the quoted “personal or non-commercial use” restriction. These checks support the corrected status claims, but do not establish that the proposed deployment works.

## New findings

- **Medium — versioned cache contract conflicts with stale-version rejection.** [Architecture](/workspace/predictiq/docs/architecture.md:74) says a URL is immutable within its model version, yet also says the service returns 404 for a stale `mv`. The same URL can therefore return saved data or 404 after a release; a browser may also retain a 200 response for the specified one-hour `max-age`. [Vercel’s cache documentation](https://vercel.com/docs/caching/cache-control-headers) confirms browser caching at `max-age`. Specify whether old versions remain servable, or describe the URLs as current-version requests and define their release-time cache behavior.

- **Low — event exclusion sentence uses the wrong denominator.** [Architecture](/workspace/predictiq/docs/architecture.md:54) says **107 test events** have full lookback and **“7 do not.”** Only **3 of the 110 test events** lack it. The other **4** occur after the test window; together, those seven are candidate events that can label a scored test hour. Clarify those two populations.

I found no new feature-leakage rule or conflict with the approved [PRD](/workspace/predictiq/docs/PRD.md:24), [stories](/workspace/predictiq/docs/stories.md:64), or [UX specification](/workspace/predictiq/docs/ux-spec.md:20) beyond the documentation issues above.

**Commands run and outcomes:** `git log --oneline -6` identified fixes `868e563` and `c87bccc`; `git diff a98d41d~0 HEAD -- docs/architecture.md DECISIONS.md` reviewed their resulting document changes; `git status --short` was clean. `rg`, `head`, `sed`, and `nl` checked the report, architecture and approved documents. A read-only `python3` CSV query produced the counts above. Official Vercel pages were fetched successfully. No files were edited.