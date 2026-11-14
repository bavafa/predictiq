# Stage 5 testing report (sessions 1, 2 and fix sessions 2b and 2c)

Date: 14 Nov 2026. Branch `model-perf`. All data is simulated. The counts below are from the runs listed at the end.

## What each new test covers

| Test file | Tests | What it covers |
|---|---:|---|
| `frontend/tests/model-performance.test.tsx` (Vitest) | see total below | Model Performance page: header facts (now "Model built" with the note that the results' date is not recorded), every table row at the default cut-off for both models, cut-off changes, dashes for missing values, loading, error and not-available states. |
| `frontend/e2e/model-performance.spec.ts` | 8 | The page in a browser on the synthetic bundle: table, cut-off control, charts, table views, states. |
| `frontend/e2e/model-performance-real.spec.ts` | 1 | The page against the real bundle (opt-in `npm run e2e:real`). |
| `frontend/e2e/axe-all.spec.ts` | 54 | axe scan (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa; no disabled rules, no excluded regions) on every page at desktop and mobile, plus the open menu, error and empty states. 10 of the 54 are new in 2c: they prove the `color-contrast` rule is enabled and ran (in axe's passes with more than 5 text nodes, not "inapplicable") and that any node axe could not decide is one of the kinds listed under "Contrast checks" below. |
| `frontend/e2e/contrast.spec.ts` (new, 2c) | 36 | Rendered contrast on all five pages, desktop and mobile: control boundaries at 3:1 (10), focus outline exact rule and 3:1 for every control (10), chart marks at 3:1 (6), all visible text at 4.5:1, or 3:1 for large text (10). |
| `frontend/e2e/keyboard.spec.ts` | 38 | Keyboard use: tab order, skip link, menu, cut-off and replay controls, chart tables reachable and scrollable, no keyboard traps. Since 2c every Tab stop must show the exact focus rule (below), not just any outline. |
| `frontend/e2e/target-size.spec.ts` | 10 | Every control is at least 44 × 44 px on mobile (menu panel, ⓘ buttons, chart tables, state links, planner with assumptions on). |
| `frontend/e2e/notice.spec.ts` | 12 | The notice is on every page at desktop and mobile, shows the exact wording, is visible without scrolling, is not dismissible, appears once and before the page heading. |
| `frontend/e2e/no-model.spec.ts` | 18 (no-model run) | With no model data: notice present, axe clean, 44 px controls, no sideways scrolling. |
| `scripts/tests/test_design_tokens.py` | 91 | Every contrast pair in the design tokens, recomputed with the same formula as `docs/design/check-contrast.py`; CSS variables and chart constants equal their tokens; the source colour scan (widened in 2c) and 15 tests of the scan itself. |
| `scripts/tests/test_release_hygiene.py` | 8 (7 pass, 1 expected failure) | No secrets, no personal emails in files, no raw data or bundle committed, commit emails (see below). |
| `ml/tests/test_bundle.py` (new, fix 2b) | 6 cases | Synthetic evaluation counts for six bundle sizes (1×3 up to 120×1500): no negative counts, the four counts add up to all machine-hours, positives match, calibration groups fit inside their group. Default size still has 2,590 positive hours. |

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

## Contrast checks, as built in fix session 2c

**Text (WCAG 1.4.3).** axe's `color-contrast` rule is part of `wcag2aa` and is enabled: `axe-all.spec.ts` uses the tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` with no `disableRules`, `exclude` or `include`. It runs on all five pages at both sizes, and in the table, definition, loading, error, empty and menu states, with zero violations of any impact. It does **not** decide every visible text node: it leaves some "incomplete" (cannot decide). Here those are SVG chart text (`<tspan>`), chart legend text, text it believes is "partially obscured" (planner table cells, the replay line) and one decorative icon. The new axe test fails if axe leaves any other kind undecided. The undecided text is measured by `contrast.spec.ts` "rendered text contrast", which computes the colour, the effective background (walk up to the first opaque background, compositing translucent backgrounds and opacity) and the ratio for every visible text element, HTML and SVG, on all five pages at both sizes. Large text (24 px, or 18.66 px bold) needs 3:1, other text 4.5:1. Disabled and `aria-disabled` controls are skipped (inactive components are exempt).

**Non-text (WCAG 1.4.11, 3:1), rendered, five pages × desktop and mobile** (`contrast.spec.ts`):
1. Control boundaries. For every visible interactive control: its border colour, or with no border its own background, against the effective background behind it. Controls with no drawn boundary are identified by their text (the text check covers them); native range, checkbox and radio inputs are no longer exempt (see "Native controls" below); disabled and `aria-disabled` controls are exempt. Each test fails if it finds fewer than three controls, so an empty walk cannot pass.
2. Focus indicator. Every control is focused (after a key press, so `:focus-visible` applies) and must show exactly the ux-spec rule below, with at least 3:1 between the outline colour and the background next to the control.
3. Chart marks. Every stroke and fill of chart lines, bars, markers, reference lines and legend keys on Fleet Overview, Asset Details and Model Performance, against the chart background, at 3:1. Gridlines and axis lines are left out (decorative; the grid token is a "forbidden" pair in `tokens.json`).

**Exact focus rule.** `docs/ux-spec.md` (Accessibility: "a visible 2px outline on every control") and `docs/design/components.md` ("Visible 2px focus outline with a 2px gap"), with colours from `tokens.md` and `globals.css`: `outline: 2px solid`, `outline-offset: 2px`, colour `#2563eb` (`brand.focus-ring`) or, on the dark sidebar (`.on-dark`), `#60a5fa` (`sidebar.focus-ring`); at least 3:1 against the background behind the control. `keyboard.spec.ts` now checks this on every Tab stop (it used to accept any non-zero outline or box shadow) and `contrast.spec.ts` checks it on every control.

**Source scan** in `test_design_tokens.py`. It fails on any colour in `frontend/app`, `components` and `lib` that is not a `tokens.json` value: 3, 4, 6 and 8 digit hex (3-digit values are expanded; 4 and 8 digit ones carry alpha and always fail), `rgb()`, `rgba()`, `hsl()`, `hsla()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`, `color-mix()`, CSS colour names in colour properties, named Tailwind utilities (`text-gray-500`, `bg-slate-100`, `border-black`, any palette, with prefixes such as `hover:`), opacity modifiers on colour utilities (`bg-ink/50`) and arbitrary values (`text-[#...]`, `bg-[rgb(...)]`). `white` is allowed because `#FFFFFF` is a token. One exception, with its reason in the test and a check that it is not stale: `bg-black/45`, the dimming scrim behind the open mobile menu (no text, no information). 15 tests check that the scan reports each kind and ignores tokens and plain text.

### Real failures found by these checks, and the minimal fixes

1. **Model Performance chart legend text was 3.74:1.** Recharts coloured the legend labels with the series colour. The teal main-model colour (`#0d9488`) is enough for a line (3:1) but not for text (4.5:1). axe reported these nodes as undecided, so it did not catch them; the rendered text check did. The legend labels now use `text.secondary` (`#4b5563`, 7.56:1); the coloured key beside each label is unchanged (`model-charts.tsx`).
2. **The skip link had no visible boundary.** When focused it is a white box (`bg-card`) on the `#f6f7f9` page: 1.07:1. It now has a 1 px `surface.input-border` border, 3.6:1 (`app-shell.tsx`).
3. **The "Historical replay" badge ring used `ring-brand/40`**, a translucent colour that is not a token. It is now `ring-brand`, the `brand.primary` token (`app-shell.tsx`).

Everything else passed unchanged: the boundaries and focus outlines of all controls, all chart marks and all other text. (Three disabled "Reset" and paging buttons flagged on a first run are inactive components, which WCAG 1.4.11 exempts, so the test now skips them and counts them.)

### What the contrast checks do and do not cover

They cover: every pair listed in `tokens.json` (54, recomputed); every colour literal and class in the app source; and, in Chromium at 1280 × 800 and 390 × 844, the rendered text, control boundaries, focus outlines and chart marks of the five pages in their main state, plus axe on the other states.

They do **not** cover:
- Pairs missing from `tokens.json` are not found by the pair test; the rendered tests and the source scan are what catch them, and only for what is rendered or written in the source.
- States the rendered contrast tests do not open. `contrast.spec.ts` runs on each page's main state. axe covers the table, definition, loading, error, empty and menu states, and the keyboard spec checks focus inside the open menu, but the boundary and chart-mark checks are not repeated there.
- Hover, pressed and active states.
- Background images and gradients (none are used, but the background walk does not sample them) and text over an image.
- Painted pixels of the range track and thumb. Chromium returns no computed style for slider pseudo-elements (always transparent), so these two parts are measured from the declared stylesheet rule, resolved through the token variables, not from rendered pixels. Everything else about native controls is measured (see "Native controls" below). A radio input has no instance in the app, so the radio rule is styled but never rendered or measured.
- Chart gridlines and axis lines (decorative by design) and chart marks for data that is not in the test bundles.
- Forced-colours (Windows High Contrast) mode, dark mode, and browsers other than Chromium.
- Whether a boundary is *needed* to identify a control. The test applies 3:1 to every drawn boundary, which is stricter than WCAG where a control is identified by its text.
- A person judging colour-only meaning.

## Round 4 review fixes (fix session 3c)

**Native controls (review round 4, Medium).** The blanket exemption for range, checkbox and radio inputs is gone. `globals.css` now styles them from tokens: `accent-color` is `brand.primary` for all three; a checkbox or radio is `appearance: none` with a 2 px `surface.input-border` border (and a `brand.primary` fill with a white mark when on), so it is a normal bordered control; a range has a 6 px `surface.input-border` track and a 20 px `brand.primary` thumb with a white ring. `contrast.spec.ts` checks, against the effective background and at 3:1: the computed `accent-color` of every native input; the border of every checkbox and radio (the ordinary boundary check); the fill of a checked checkbox; and the range track and thumb colours. A part with no measurable colour is a failure, not a skip. The test annotation counts native controls separately.
- **What cannot be measured, exactly:** the range track and thumb. Chromium gives no computed style for `::-webkit-slider-runnable-track` and `::-webkit-slider-thumb` (they read as transparent), so the test reads the declared `background` of those rules from the loaded stylesheet and resolves the token variable. That proves what the CSS says, not what is painted. The Firefox rules (`::-moz-range-*`) are declared with the same tokens but are not run, since only Chromium is used. The white mark inside a checked checkbox and the white ring around the thumb are decorative and are not measured. There is no radio input in the app, so the radio styling has no rendered instance.

**Source scan, JS/TSX style objects (Low).** `test_design_tokens.py` now also flags a string value on `color`, `backgroundColor`, `background`, `borderColor`, `border{Top,Right,Bottom,Left}Color`, `outlineColor`, `fill`, `stroke`, `stopColor`, `floodColor`, `caretColor`, `accentColor`, `textDecorationColor` and `lightingColor`, written as `prop: "..."`, `prop="..."` or `style.prop = "..."`, unless it is a hex value (judged by the hex rule), `var(--color-*)`, `none`, `transparent`, `currentColor`, `inherit`, `initial`, `unset`, `white` or empty. Seven new pattern tests cover `backgroundColor: "red"`, single quotes, `borderTopColor`, a non-token `var()`, `el.style.backgroundColor = ...`, a template literal and a JSX attribute; the "ignores tokens" test gained a token-variable case. The current source has no hit.

**axe "incomplete" acceptance (Low).** `axe-all.spec.ts` now has a list, `ACCEPTED_INCOMPLETE`, of six documented cases, each matched by rule id (`color-contrast`) plus a selector pattern plus an exact reason: (1) chart `<tspan>` text: reasons "contains an image node", "overlapped by another element" or "too short to determine"; (2) chart legend text span: "contains an image node"; (3) the replay-bar helper text (`.gap-x-2 > .text-ink-2.text-xs:nth-child(4)`): "partially obscured"; (4) planner plan-table `slot` and `moved` cells: "partially obscured"; (5) aria-hidden icon spans: "only non-text characters"; (6) the crew stepper buttons "Fewer/More crew slots": "only non-text characters". The old test accepted any chart selector or any message containing "partially obscured". The list was made from a dump of every undecided node on all five pages at both sizes. Text cases are covered by "rendered text contrast"; the icon cases hold no text.

**Results of the runs in fix session 3c:** Vitest 179 passed; lint, typecheck and build clean; `npm run e2e` synthetic 218 passed, 5 skipped, no-model-data run 18 passed; `npm run e2e:real` 223 passed; ruff check, ruff format --check and `mypy` (project command, `uv run --group ml mypy`) clean; `uv run --group ml pytest -q` 352 passed, 1 expected failure, 16 not selected. Two transient/real findings on the way: one synthetic run had a page-ready timeout on Asset Details (mobile) while pytest ran at the same time, and passed on a clean rerun; the real bundle showed the planner "partially obscured" cells under a different selector shape than the synthetic one, so the accepted-case selector was corrected and both runs repeated. `scripts/verify_bundle_download.sh` was not touched or run here.

## Release hygiene scan

The scan finds no secrets and no personal email addresses in committed files. One historical commit does not pass the commit-email check: **commit 874a686 has an author email that is a personal address; its committer email is the noreply address.** No history rewrite was done. This is an owner decision before going public (to be recorded in `docs/LAUNCH_CHECKLIST.md`, written in a later session). The test is marked as an expected failure with that reason (it passes in a shallow clone that lacks that commit). No code change was made for it in 2c.

## Results of the final runs (fix session 2c)

- Vitest: 160 passed. Lint, typecheck and build passed.
- `npm run e2e`: synthetic bundle 218 passed, 5 skipped (the five real-bundle tests); no-model-data run 18 passed.
- `npm run e2e:real`: 223 passed.
- ruff check, ruff format --check and mypy: clean.
- `pytest -q`: 343 passed, 1 expected failure (the hygiene finding above), 16 not selected.
- The fresh-copy script was changed and syntax-checked in 2c but not run: it needs the network for `npm ci` and `uv sync`.

## Other 2c changes

- `scripts/fresh_copy_check.sh`: when the real-bundle part is skipped, the last line is now `FRESH COPY CHECK PASSED (real-bundle checks skipped: <reason>)`, never plain "PASSED". With `REQUIRE_REAL=1` a skip prints a failure line and exits 1.

## What is NOT covered

- No human screen-reader testing (NVDA, JAWS, VoiceOver, TalkBack). axe and the keyboard tests catch only what automation can detect.
- No real devices. Mobile checks use a 390 × 844 browser window in Chromium only; no Safari, Firefox or physical phones.
- Manual WCAG checks that automation cannot make: whether labels and alternative descriptions make sense, reading order meaning, zoom and text-spacing behaviour, colour-only meaning judged by a person, and cognitive load.
- The Stage 3 accessibility finding (contrast pairs and mobile target sizes) is covered by automated tests only to the extent described above.

## Fresh-copy run (14 Nov 2026, about 6:20 PM Toronto time)
`REQUIRE_REAL=1 bash scripts/fresh_copy_check.sh` cloned commit `758023d` into an empty folder and ran everything from scratch. The run took 406 s and ended `FRESH COPY CHECK PASSED`. It included the real-bundle and real-data checks. Results:
- Synthetic Playwright: 218 passed. No-model run: 18 passed. Real-bundle Playwright: 223 passed.
- pytest: 351 passed, 1 skipped, 1 expected failure. With the real data and the real bundle: 368 passed, 1 expected failure.

The expected failure is the personal author email in commit `874a686`, which needs an owner decision. Log: `stage5-fresh-copy.log`. An earlier run on `0dafddc` failed in one place: a real-data test errored instead of skipping when the raw data was missing. Commit `758023d` fixed it.
