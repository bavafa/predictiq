# Stage 3: independent review, round 1

Reviewer: Codex (gpt-6-sol, medium effort), read-only, 14 Nov 2026.
Scope: sessions 1–2. Lead response: both Medium findings fixed in the next round of changes, and focus tests added.

## Findings

- **Medium — replay and cut-off transitions can show mismatched numbers.** [fleet-screen.tsx](/workspace/predictiq/frontend/components/fleet-screen.tsx:131) keeps the previous fleet answer visible while a new one loads, but [line 180](/workspace/predictiq/frontend/components/fleet-screen.tsx:180) labels its scored hour using the newly selected replay time. The trend request also resolves separately from the cards, so a new card count can briefly appear beside an older trend. The content is dimmed and marked busy, but the displayed time and numbers can disagree. The cut-off notice at [line 162](/workspace/predictiq/frontend/components/fleet-screen.tsx:162) says everything “updated together” during that interval.

- **Medium — model-version retry does not update shared page metadata.** On a stale `mv`, [api.ts](/workspace/predictiq/frontend/lib/api.ts:147) refreshes metadata and retries with the new version. [data-provider.tsx](/workspace/predictiq/frontend/components/data-provider.tsx:110) retains the earlier metadata in its own state. After a deployment change, the page can therefore show new scores with the old displayed model version, default cut-off, or replay bounds. This weakens decision 51’s requirement against mixing versions.

- **Low — accessibility checks leave some specified behavior unverified.** The committed Playwright checks cover axe serious/critical findings, keyboard replay, mobile overflow, and chart tables ([fleet.spec.ts](/workspace/predictiq/frontend/e2e/fleet.spec.ts:210), [replay.spec.ts](/workspace/predictiq/frontend/e2e/replay.spec.ts:81)). They do not establish all specified focus restoration, contrast pairs, or mobile target sizes. This is a coverage limit, not an observed accessibility failure.

## Criteria

| Stage 3 story | Result | Evidence |
|---|---|---|
| Epic: saved scores; numbers match time and cut-off | **Not met** | The service reads saved scores and has independent score comparisons ([test_answers_match_scores.py](/workspace/predictiq/backend/tests/test_answers_match_scores.py:67)); the transition mismatch above remains. |
| Fleet Overview: filtered Alert count and cut-off | **Met for settled views** | The API counts Alert statuses from the same filtered rows it returns ([data.py](/workspace/predictiq/backend/app/api/data.py:126)); the e2e test traverses every table page across model and status filters ([fleet.spec.ts](/workspace/predictiq/frontend/e2e/fleet.spec.ts:62)). Sorting and pagination do not change the filtered total. The reviewed cut-off and empty screenshots agree with this behavior. |
| Historical replay: honest label and clean ends | **Met** | The UI says “Historical replay”; stepping clamps to the window ([replay.ts](/workspace/predictiq/frontend/lib/replay.ts:20)); playback stops at the end ([data-provider.tsx](/workspace/predictiq/frontend/components/data-provider.tsx:182)). Start and end screenshots and e2e checks support this. |
| Data service: errors and saved-score answers | **Met** | Strict date, cut-off, machine, and `mv` checks produce clear errors without echoing submitted values ([validation.py](/workspace/predictiq/backend/app/validation.py:22), [test_data_api_rules.py](/workspace/predictiq/backend/tests/test_data_api_rules.py:35)). Records use bounds strictly before `at` ([data.py](/workspace/predictiq/backend/app/api/data.py:201)); the score *at* that hour is permitted by the contract. Missing bundles return 503 and the UI shows no invented scores ([data.py](/workspace/predictiq/backend/app/api/data.py:57), [no-model.spec.ts](/workspace/predictiq/frontend/e2e/no-model.spec.ts:7)). |

The reviewed screenshots show simulated-data disclosure, Predicted/Historical labels, chart text and table alternatives, loading, error, empty, and replay-end states. CI is configured to run Playwright against a synthetic FastAPI and Next.js stack ([ci.yml](/workspace/predictiq/.github/workflows/ci.yml:33), [e2e.mjs](/workspace/predictiq/frontend/scripts/e2e.mjs:48)). Real-bundle checks are opt-in. I found no committed secret or input-echo issue in the scoped files.

## Verdict

**Two Medium must-fix findings; Stage 3 is not ready to pass QA.** This was a read-only review of `fea9580`; I did not run tests because the workspace is read-only and the working tree contains uncommitted Asset Details changes that would contaminate a run.
