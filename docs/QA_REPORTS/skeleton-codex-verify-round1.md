# Codex targeted re-verification of the project skeleton, round 1

_Reviewer: Codex CLI 0.169.0, model gpt-6-sol, reasoning effort medium, read-only sandbox, 13 Nov 2026. Saved verbatim. The reviewer could not reach api.github.com; CI results were checked by the orchestrator with gh (runs 43551738720 pull_request and 43551731238 push on 554e106: frontend, e2e, python and security all succeeded)._

## Targeted re-verification

**Recommendation: PASS WITH KNOWN ISSUES** for the skeleton code at `554e106`. The fixes address the three Medium findings. Two Low issues remain in documentation and menu focus handling. I could not independently confirm the reported CI results.

| Original finding | Status | Evidence |
|---|---|---|
| CI lacks an axe scan | **RESOLVED** | [a11y.spec.ts](/workspace/predictiq/frontend/e2e/a11y.spec.ts:10) runs axe on five routes at desktop and mobile sizes, plus the open menu. It filters `serious` and `critical` violations, and the `toEqual([])` assertions at lines 25 and 35 **will fail** if any are found. [ci.yml](/workspace/predictiq/.github/workflows/ci.yml:48) runs the E2E suite. |
| Actions use mutable tags | **RESOLVED** | Every `uses:` entry in [ci.yml](/workspace/predictiq/.github/workflows/ci.yml:21) has a 40-character commit SHA and an adjacent version comment, including the Node 24 release bumps. |
| Mobile menu exposes background content | **RESOLVED** | [app-shell.tsx](/workspace/predictiq/frontend/components/app-shell.tsx:100) gives the open panel `role="dialog"`, `aria-modal`, and a name. The skip link, disclosure, and page content become inert at lines 85, 91, and 140. Escape, the close button, and overlay return focus to Menu; the [component test](/workspace/predictiq/frontend/tests/app-shell.test.tsx:102) checks the modal state and Escape focus return. |
| Stale status and provenance notes | **PARTIALLY** | The obsolete download-script statement is corrected in [DATA_PROVENANCE.md](/workspace/predictiq/docs/DATA_PROVENANCE.md:72), and historical architecture notes are labelled in [STATUS.md](/workspace/predictiq/STATUS.md:5). But [STATUS.md](/workspace/predictiq/STATUS.md:11) still says to confirm CI, and line 13 says CI has never run; [TASKS.md](/workspace/predictiq/TASKS.md:44) still leaves CI green unchecked. Those statements conflict with the orchestrator’s reported successful runs. |
| Dependabot config absent | **RESOLVED** | [.github/dependabot.yml](/workspace/predictiq/.github/dependabot.yml:1) has the required version, directories, and weekly schedules for npm, uv, and GitHub Actions. GitHub [documents `uv` as a supported ecosystem](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories). Dependabot activity remains unverified; GitHub [requires the file on the default branch](https://docs.github.com/en/code-security/concepts/supply-chain-security/about-the-dependabot-yml-file). |

**New finding — Low:** Activating a mobile menu link calls `setOpen(false)` without moving focus ([app-shell.tsx](/workspace/predictiq/frontend/components/app-shell.tsx:79)). The focused link can then become hidden with the panel. The existing tests cover focus return for Escape and Close, but not link activation.

**Workflow permissions:** [ci.yml](/workspace/predictiq/.github/workflows/ci.yml:7) defaults to `contents: read`; only the security job adds `pull-requests: read` at lines 75–79 for gitleaks. All declared permissions are read only and scoped to the job that needs the extra permission.

**Commands and outcomes:** `git log --oneline a043428..HEAD`, the requested diff, and `git diff --check a043428 HEAD` completed; the diff check passed. `git status --short` was clean. Both `gh run view` commands failed because this box could not connect to `api.github.com`; the GitHub run pages were also unavailable through web access. Thus the reported success of runs `43551738720` and `43551731238` for frontend, e2e, python, and security on `554e106` is **reported, not independently verified**. No tests were rerun in this read-only review.

**Untested:** The Vercel trial deploy has **not** happened. Project creation was refused with 403 by the Vercel connector, and the Vercel CLI on the box is not logged in. Actual Vercel routing and deployment behavior remain unverified.