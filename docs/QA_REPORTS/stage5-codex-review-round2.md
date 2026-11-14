## Findings

- **Medium — Contrast coverage remains incomplete.** [test_design_tokens.py](/workspace/predictiq/scripts/tests/test_design_tokens.py:93) checks the 54 pairs already listed in `tokens.json`; it does not establish that the list contains every foreground and background combination rendered by the app. Its source scan also catches only six digit hex literals, so Tailwind colors, opacity variants, and other CSS color forms are outside that check ([line 129](/workspace/predictiq/scripts/tests/test_design_tokens.py:129)). All 54 listed pairs gave the expected result in an independent calculation, but this does not close the Stage 3 Low finding.

- **Medium — A personal email remains in commit history.** [test_release_hygiene.py](/workspace/predictiq/scripts/tests/test_release_hygiene.py:250) explicitly marks the history check `xfail(strict=False)`. `git log` confirms commit `874a686` has a personal author email. The exception is honestly documented, but the history check cannot provide a passing release-hygiene result.

- **Low — The focus test is weaker than the specified focus rule.** [keyboard.spec.ts](/workspace/predictiq/frontend/e2e/keyboard.spec.ts:36) accepts any nonzero computed outline or box shadow. It does not check the required visible **2px** outline or its contrast. The Tab walkthrough and menu trap checks are substantive.

The mobile size test measures inline links, native sliders and selects, ⓘ buttons, the focused skip link, and checkbox labels. Its filtering skips inert, hidden, and unrendered elements; I found no filter that conceals a rendered small control. Axe uses WCAG tags without disabled rules or excluded regions. The `ScrollRegion` change gives scrolling tables a name, keyboard focus, and the shared focus style. The grid color matches its token; that grid pair is explicitly marked forbidden as a contrast-bearing UI pair.

| Criterion | Result | Evidence |
|---|---|---|
| All tests pass on a fresh copy | **Not met as evidence** | [fresh_copy_check.sh](/workspace/predictiq/scripts/fresh_copy_check.sh:46) clones local `HEAD` and runs the main suites with `npm ci` and `uv sync --frozen`, but no fresh-copy run was possible under read-only, no-network constraints. It also permits the real-bundle portion to be skipped and still prints “PASSED” ([line 71](/workspace/predictiq/scripts/fresh_copy_check.sh:71)). CI wires in frontend, E2E, Python, and security jobs. |
| Keyboard use passes review | **Not met as evidence** | Broad keyboard tests exist, including Tab order and menu focus trapping, but they were not run here; the focus assertion does not verify the specified 2px outline. |
| Color contrast passes review; Stage 3 Low closed | **Not met** | Listed token pairs pass calculation, but rendered pair coverage is not exhaustive. Mobile target-size coverage substantially addresses the other half of the Stage 3 Low. |

**Ran:** read-only `git show` review of `642f341` and `9e5af16`, committed-history inspection, and an in-memory calculation of all 54 listed contrast pairs. **Did not run:** installs, build, pytest, or Playwright; the workspace is read-only and network access is unavailable.

**Verdict: FAIL** — the fresh-copy and runtime accessibility acceptance criteria are unverified, and the contrast coverage gap remains.
