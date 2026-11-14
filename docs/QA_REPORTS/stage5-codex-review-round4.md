## Findings

- **Medium — Contrast coverage still has gaps.** [contrast.spec.ts](/workspace/predictiq/frontend/e2e/contrast.spec.ts:45) exempts browser-drawn range, checkbox and radio controls from boundary checks. The report discloses this, along with untested interaction states and browsers ([stage5-testing.md](/workspace/predictiq/docs/QA_REPORTS/stage5-testing.md:123)). The disabled-control exemption is justified; the native-control gap means the Stage 3 contrast finding is covered only to the report’s stated extent.
- **Low — The source scan’s “any colour” claim is too broad.** [test_design_tokens.py](/workspace/predictiq/scripts/tests/test_design_tokens.py:120) matches CSS `background-color` but misses a JavaScript style such as `backgroundColor: "red"`. Its pattern tests do not include that case. Rendered checks reduce the risk on tested pages.
- **Low — The axe incomplete check can accept more than the named cases.** [axe-all.spec.ts](/workspace/predictiq/frontend/e2e/axe-all.spec.ts:144) accepts any node whose message contains “partially obscured” or whose target matches a chart selector. The separate rendered text test is substantive, but the assertion does not prove each accepted node is one of the specific cases described in the report.

The three app fixes are appropriate: legend text uses a text-contrast token, the focused skip link has a contrasting border, and the badge ring uses a token. The `bg-black/45` exception is limited to a noninformational menu scrim and has a stale-exception check. The new rendered tests have nonempty guards and meaningful assertions. I reviewed commit `3a0bb3b` read-only; I did not rerun Playwright, pytest, or the fresh-copy script, so the run totals in [stage5-testing.md](/workspace/predictiq/docs/QA_REPORTS/stage5-testing.md:138) remain reported results rather than independently verified results.

## Round 2 items

- **Medium contrast coverage: Partly fixed.** Axe `color-contrast` is verified as running, and rendered text, control, focus and chart checks substantially expand coverage. The disclosed gaps above remain.
- **Medium personal email in history: Not fixed, by owner decision.** Commit `874a686` still has a personal author email and a no-reply committer email. The [xfail](/workspace/predictiq/scripts/tests/test_release_hygiene.py:251) states this honestly; `strict=False` also permits an XPASS in a shallow clone.
- **Low focus rule: Fixed.** The [shared assertion](/workspace/predictiq/frontend/e2e/colour-support.ts:50) checks 2px solid, 2px offset, the expected token colour and 3:1 contrast.
- **Fresh-copy skip wording: Fixed.** [fresh_copy_check.sh](/workspace/predictiq/scripts/fresh_copy_check.sh:79) names a real-bundle skip in its success line and fails that skip when `REQUIRE_REAL=1`. The report correctly says the script was not run in session 2c.

**Verdict: PASS WITH KNOWN ISSUES**
