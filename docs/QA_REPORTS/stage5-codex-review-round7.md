## Findings

- **Medium — A private project name is back in a tracked file.** [CLAUDE.md](/workspace/predictiq/CLAUDE.md:25) names the “insider” project. The [history-scan report](/workspace/predictiq/docs/QA_REPORTS/stage5-history-scan.md:19) says a different private project’s name had been removed from HEAD. Remove this instruction or make it generic before publication. I found no secret or internal filesystem path in `CLAUDE.md`; its other session rules are consistent with the launch checklist.
- **Low — The live-check report overstates what changed after its preview build.** [stage5-live-checks.md](/workspace/predictiq/docs/QA_REPORTS/stage5-live-checks.md:5) says later commits changed only documents and evidence. They also changed tests and `scripts/fresh_copy_check.sh`. The logged-out production-domain claim is now supported by the recorded 404 and `x-vercel-error` header, but the preview remains evidence for commit `f29e567`, not HEAD.
- **Low — Bundle-proof wording is stale in one checklist row.** [LAUNCH_CHECKLIST.md](/workspace/predictiq/docs/LAUNCH_CHECKLIST.md:113) still says the nine-case download script has “not yet run”; [step 4](/workspace/predictiq/docs/LAUNCH_CHECKLIST.md:53) correctly cites its passing log.

## Round 6 items

| Item | Status |
|---|---|
| Fresh-copy test evidence | **Fixed.** The [log](/workspace/predictiq/docs/QA_REPORTS/stage5-fresh-copy.log:940) records commit `758023d`, `exit=0`, 218 synthetic, 18 no-model and 223 real-bundle browser tests, plus 368 real-data pytest passes and one expected hygiene failure. [stage5-testing.md](/workspace/predictiq/docs/QA_REPORTS/stage5-testing.md:169) agrees. This is committed evidence; I did not rerun its network-dependent checks. |
| History-scan exit rule | **Fixed.** [Step 1](/workspace/predictiq/docs/LAUNCH_CHECKLIST.md:14) allows exit 1 for reviewed findings and requires comparison and recorded owner decisions. |
| First-launch rollback | **Fixed in the checklist.** [Step 9](/workspace/predictiq/docs/LAUNCH_CHECKLIST.md:93) specifies setting Vercel Authentication to All Deployments and checking the logged-out response. It remains untested against production. |
| Live-check 404 evidence; MODEL_CARD wording; bundle-proof step | **Fixed**, subject to the two Low wording findings above. |
| Personal author email and historical private material | **Owner decision.** The expected hygiene failure remains; no history rewrite or acceptance is recorded. |
| Real-data skip and download | **Fixed.** [test_bundle.py](/workspace/predictiq/ml/tests/test_bundle.py:135) skips when raw files are absent; [fresh_copy_check.sh](/workspace/predictiq/scripts/fresh_copy_check.sh:74) downloads and verifies them with `REQUIRE_REAL=1`. The logged full run exercised that path. |

## Stage 5 criteria

| Criterion | Status |
|---|---|
| Model results, explanations, notice, and documented automated accessibility checks | **Met** |
| All tests pass on a fresh copy, with the disclosed expected hygiene failure | **Met by committed run evidence** |
| Serious findings fixed or accepted; no private notes remain | **Not met** — owner decision remains, and `CLAUDE.md` names a private project |
| Public app without login, production smoke checks, portfolio link | **Open at launch gate** |

**Verdict: FAIL.** The fresh-copy gap is closed, but Stage 5’s public-release condition is still open and the private-project reference needs removal or an explicit owner decision. Review was read-only, with no network use.
