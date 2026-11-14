# Stage 5 testing report (sessions 1, 2 and fix session 2b)

Date: 14 Nov 2026. Branch `model-perf`. All data is simulated. The counts below are from the runs listed at the end.

## What each new test covers

| Test file | Tests | What it covers |
|---|---:|---|
| `frontend/tests/model-performance.test.tsx` (Vitest) | see total below | Model Performance page: header facts (now "Model built" with the note that the results' date is not recorded), every table row at the default cut-off for both models, cut-off changes, dashes for missing values, loading, error and not-available states. |
| `frontend/e2e/model-performance.spec.ts` | 8 | The page in a browser on the synthetic bundle: table, cut-off control, charts, table views, states. |
| `frontend/e2e/model-performance-real.spec.ts` | 1 | The page against the real bundle (opt-in `npm run e2e:real`). |
| `frontend/e2e/axe-all.spec.ts` | 44 | axe accessibility scan on every page at desktop and mobile, plus the open menu, error and empty states. |
| `frontend/e2e/keyboard.spec.ts` | 38 | Keyboard use: tab order, skip link, menu, cut-off and replay controls, chart tables reachable and scrollable, no keyboard traps. |
| `frontend/e2e/target-size.spec.ts` | 10 | Every control is at least 44 × 44 px on mobile (menu panel, ⓘ buttons, chart tables, state links, planner with assumptions on). |
| `frontend/e2e/notice.spec.ts` | 12 | The notice is on every page at desktop and mobile, shows the exact wording, is visible without scrolling, is not dismissible, appears once and before the page heading. |
| `frontend/e2e/no-model.spec.ts` | 18 (no-model run) | With no model data: notice present, axe clean, 44 px controls, no sideways scrolling. |
| `scripts/tests/test_design_tokens.py` | part of 84 | Every contrast pair in the design tokens, recomputed with the same formula as `docs/design/check-contrast.py`. |
| `scripts/tests/test_release_hygiene.py` | part of 84 | No secrets, no personal emails in files, no raw data or bundle committed, commit emails (see below). |
| `ml/tests/test_bundle.py` (new, fix 2b) | 6 cases | Synthetic evaluation counts for six bundle sizes (1×3 up to 120×1500): no negative counts, the four counts add up to all machine-hours, positives match, calibration groups fit inside their group. Default size still has 2,590 positive hours. |

(The two Python files together hold 84 tests: 83 pass, 1 expected failure, see hygiene.)

## Contrast table (`python3 -I docs/design/check-contrast.py`)

Result: **0 unexpected result(s)**. Pairs marked "Forbidden" are ones the design says must not be used for text or for meaning; the script checks they really fail.

```
| Foreground | Background | Ratio | Needs | Result |
| `sidebar.text` #E2E8F0 | `sidebar.bg` #0F1B2D | 14.02 | 4.5 | Pass |
| `sidebar.text-muted` #94A3B8 | `sidebar.bg` #0F1B2D | 6.74 | 4.5 | Pass |
| `sidebar.text-active` #FFFFFF | `sidebar.bg-active` #1E3A5F | 11.50 | 4.5 | Pass |
| `sidebar.text` #E2E8F0 | `sidebar.bg-active` #1E3A5F | 9.33 | 4.5 | Pass |
| `sidebar.text-muted` #94A3B8 | `sidebar.bg-active` #1E3A5F | 4.49 | 4.5 | Forbidden |
| `sidebar.focus-ring` #60A5FA | `sidebar.bg` #0F1B2D | 6.80 | 3.0 | Pass |
| `text.primary` #111827 | `surface.card` #FFFFFF | 17.74 | 4.5 | Pass |
| `text.primary` #111827 | `surface.background` #F6F7F9 | 16.55 | 4.5 | Pass |
| `text.primary` #111827 | `surface.subtle` #F1F5F9 | 16.19 | 4.5 | Pass |
| `text.secondary` #4B5563 | `surface.card` #FFFFFF | 7.56 | 4.5 | Pass |
| `text.secondary` #4B5563 | `surface.background` #F6F7F9 | 7.05 | 4.5 | Pass |
| `text.secondary` #4B5563 | `surface.subtle` #F1F5F9 | 6.90 | 4.5 | Pass |
| `text.muted` #6B7280 | `surface.card` #FFFFFF | 4.83 | 4.5 | Pass |
| `text.muted` #6B7280 | `surface.background` #F6F7F9 | 4.51 | 4.5 | Pass |
| `text.muted` #6B7280 | `surface.subtle` #F1F5F9 | 4.41 | 4.5 | Forbidden |
| `text.on-primary` #FFFFFF | `brand.primary` #0F766E | 5.47 | 4.5 | Pass |
| `text.on-primary` #FFFFFF | `brand.primary-hover` #115E59 | 7.58 | 4.5 | Pass |
| `brand.primary` #0F766E | `surface.card` #FFFFFF | 5.47 | 4.5 | Pass |
| `brand.primary` #0F766E | `surface.background` #F6F7F9 | 5.11 | 4.5 | Pass |
| `brand.link` #1D4ED8 | `surface.card` #FFFFFF | 6.70 | 4.5 | Pass |
| `brand.link` #1D4ED8 | `surface.background` #F6F7F9 | 6.25 | 4.5 | Pass |
| `brand.focus-ring` #2563EB | `surface.card` #FFFFFF | 5.17 | 3.0 | Pass |
| `brand.focus-ring` #2563EB | `surface.background` #F6F7F9 | 4.82 | 3.0 | Pass |
| `notice.disclosure-text` #1E293B | `notice.disclosure-bg` #E8EDF3 | 12.43 | 4.5 | Pass |
| `notice.replay-text` #115E59 | `notice.replay-bg` #E6F4F2 | 6.71 | 4.5 | Pass |
| `value-type.historical-text` #334155 | `value-type.historical-bg` #F1F5F9 | 9.45 | 4.5 | Pass |
| `value-type.predicted-text` #1E40AF | `value-type.predicted-bg` #DBEAFE | 7.15 | 4.5 | Pass |
| `value-type.illustrative-text` #5B21B6 | `value-type.illustrative-bg` #EDE9FE | 7.57 | 4.5 | Pass |
| `risk.below-text` #334155 | `risk.below-bg` #F1F5F9 | 9.45 | 4.5 | Pass |
| `risk.alert-text` #92400E | `risk.alert-bg` #FEF3C7 | 6.37 | 4.5 | Pass |
| `risk.alert-text` #92400E | `surface.card` #FFFFFF | 7.09 | 4.5 | Pass |
| `risk.alert-border` #B45309 | `surface.card` #FFFFFF | 5.02 | 3.0 | Pass |
| `risk.recorded-failure-text` #991B1B | `risk.recorded-failure-bg` #FEE2E2 | 6.80 | 4.5 | Pass |
| `text.on-primary` #FFFFFF | `risk.recorded-failure` #B91C1C | 6.47 | 4.5 | Pass |
| `feedback.problem-text` #92400E | `surface.card` #FFFFFF | 7.09 | 4.5 | Pass |
| `feedback.problem-border` #B45309 | `surface.card` #FFFFFF | 5.02 | 3.0 | Pass |
| `surface.input-border` #768295 | `surface.card` #FFFFFF | 3.89 | 3.0 | Pass |
| `surface.input-border` #768295 | `surface.background` #F6F7F9 | 3.63 | 3.0 | Pass |
| `surface.input-border` #768295 | `surface.subtle` #F1F5F9 | 3.55 | 3.0 | Pass |
| `surface.border` #D9DEE5 | `surface.card` #FFFFFF | 1.35 | 3.0 | Forbidden |
| `chart.sensor-line` #1D4ED8 | `chart.surface` #FFFFFF | 6.70 | 3.0 | Pass |
| `chart.risk-line` #0D9488 | `chart.surface` #FFFFFF | 3.74 | 3.0 | Pass |
| `chart.model-baseline` #7C3AED | `chart.surface` #FFFFFF | 5.70 | 3.0 | Pass |
| `chart.cutoff-line` #B45309 | `chart.surface` #FFFFFF | 5.02 | 3.0 | Pass |
| `chart.recorded-failure` #B91C1C | `chart.surface` #FFFFFF | 6.47 | 3.0 | Pass |
| `chart.maintenance-marker` #475569 | `chart.surface` #FFFFFF | 7.58 | 3.0 | Pass |
| `chart.error-marker` #6B7280 | `chart.surface` #FFFFFF | 4.83 | 3.0 | Pass |
| `chart.histogram-bar` #0F766E | `chart.surface` #FFFFFF | 5.47 | 3.0 | Pass |
| `chart.axis` #6B7280 | `chart.surface` #FFFFFF | 4.83 | 4.5 | Pass |
| `chart.grid` #E5E7EB | `chart.surface` #FFFFFF | 1.24 | 3.0 | Forbidden |
| `text.secondary` #4B5563 | `risk.alert-bg` #FEF3C7 | 6.79 | 4.5 | Pass |
| `text.muted` #6B7280 | `risk.alert-bg` #FEF3C7 | 4.34 | 4.5 | Forbidden |
| `text.muted` #6B7280 | `notice.disclosure-bg` #E8EDF3 | 4.11 | 4.5 | Forbidden |
| `brand.link` #1D4ED8 | `notice.disclosure-bg` #E8EDF3 | 5.69 | 4.5 | Pass |

0 unexpected result(s)
```

## App fixes made in session 2

- **Target sizes:** the skip link and the "About & Data" links in the empty and error states now have a 44 px minimum height and width; the new target-size tests pass for the other controls they check.
- **Focusable chart tables:** chart tables shown in a box that scrolls are now keyboard-focusable, named regions (`ScrollRegion` in `chart-card.tsx`), so the arrow keys scroll them. Used on the Model Performance chart tables; the Asset Details and Fleet chart components were also changed in the same commit (642f341) for the same reason.
- **Gridline colour:** the Model Performance chart gridline colour was `#d9dee5`; it is now `#e5e7eb`, the `chart.grid` design token (a decorative line, no meaning carried by it).

## Fixes made in fix session 2b

- Model Performance now says "Model built" instead of "Evaluation date", with a sentence that the date the saved results were produced is not recorded. The evaluation is a separate step after training, so the build date is not the evaluation date. The sentence "Every number on this page comes from the saved evaluation" now says the results come from the saved evaluation and the version and build date come from the model record (decision 68, corrected).
- The synthetic test bundle now scales its positive hours and false alerts with bundle size, so no count is negative (new test above). The real bundle is not changed.
- The top notice now reads "Portfolio demo — simulated historical sample data; estimated economics are illustrative." on every page (decision 70). The seven Stage 5 screenshots were retaken.

## Release hygiene scan

The scan finds no secrets and no personal email addresses in committed files. One historical commit does not pass the commit-email check: **commit 874a686 has an author email that is a personal address; its committer email is the noreply address.** No history rewrite was done. This is an owner decision. The test is marked as an expected failure (it passes in a shallow clone that lacks that commit).

## Results of the final runs

- Vitest: 160 passed. Lint, typecheck and build passed.
- `npm run e2e`: synthetic bundle 172 passed, 5 skipped (the five real-bundle tests); no-model-data run 18 passed.
- `npm run e2e:real`: 177 passed.
- ruff check, ruff format --check and mypy: clean.
- `pytest -q`: 328 passed, 1 expected failure (the hygiene finding above), 16 not selected. `pytest -q -m ""`: 344 passed, 1 expected failure.

## What is NOT covered

- No human screen-reader testing (NVDA, JAWS, VoiceOver, TalkBack). axe and the keyboard tests catch only what automation can detect.
- No real devices. Mobile checks use a 390 × 844 browser window in Chromium only; no Safari, Firefox or physical phones.
- Manual WCAG checks that automation cannot make: whether labels and alternative descriptions make sense, reading order meaning, zoom and text-spacing behaviour, colour-only meaning judged by a person, and cognitive load.
- The Stage 3 accessibility finding (contrast pairs and mobile target sizes) is covered by automated tests only to the extent described above.
