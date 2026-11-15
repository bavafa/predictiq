# Design tokens

_Palette changed to Hatch-inspired colours on 2026-11-15 (decision 76). Colour values below are current; for current contrast ratios run `docs/design/check-contrast.py` (the ratios in the tables were computed for the earlier palette)._

_Proposed, design stage, 13 Nov 2026. The values live in `tokens.json`. The contrast table below was computed by `check-contrast.py` from that file (WCAG 2.x formula)._

**Direction:** restrained industrial software. Dark navy sidebar. Light neutral data surfaces. Teal and blue for neutral analytics. Amber for warnings. Red only for verified risk status, which here means a **recorded failure** in the historical data. A model alert is a prediction, not a verified fact, so it uses amber. Light surfaces only in the first release.

The wireframes are greyscale on purpose. They show layout, not colour.

## 1. Colour roles

| Token | Hex | Use |
|---|---|---|
| `sidebar.bg` / `bg-active` | #2B3843 / #425563 | Sidebar; current page |
| `sidebar.text` / `text-muted` / `text-active` | #F2F4F5 / #B7C1C9 / #FFFFFF | Nav labels; footer captions; current page label |
| `sidebar.focus-ring` | #F5A092 | Focus outline inside the sidebar |
| `surface.background` / `card` / `subtle` | #F8F8F8 / #FFFFFF / #EEEEEE | Page; cards, tables, charts; table header and zebra rows |
| `surface.border` | #DBDBDB | Decorative dividers only |
| `surface.input-border` | #767676 | Edge of every input, select, slider track and checkbox |
| `text.primary` / `secondary` / `muted` | #363636 / #425563 / #6B7280 | Body; supporting text; captions on white only |
| `brand.primary` / `primary-hover` | #C8341F / #A82B1A | Primary buttons, active tabs, slider handle |
| `brand.link` / `focus-ring` | #425563 / #E84A37 | Links; 2px focus outline with 2px gap |
| `notice.disclosure-*` | #E8ECEF bg / #2B3843 text | The persistent "Portfolio demo" banner |
| `notice.replay-*` | #FDECEA bg / #A82B1A text | The "Historical replay" badge |
| `value-type.historical-*` | #EEEEEE / #334155 | "Historical" label (simulated sample data) |
| `value-type.predicted-*` | #DBEAFE / #1E40AF | "Predicted" label (model estimate) |
| `value-type.illustrative-*` | #EDE9FE / #5B21B6 | "Illustrative" label (user-set assumption) |
| `risk.below-*` | #EEEEEE / #334155 | "Below cut-off" tag |
| `risk.alert-*` | #FEF3C7 bg / #92400E text / #B45309 edge | "Alert" tag: predicted chance at or above the cut-off |
| `risk.recorded-failure*` | #B91C1C solid; #FEE2E2 / #991B1B tag | Recorded failure marker and tag (historical fact) |
| `feedback.problem-*` | #92400E text / #B45309 edge | Error and invalid-input messages, always with an icon |

Error messages use amber, not red, so red keeps one meaning: a failure that really happened in the data.

Each label also differs by shape, not just colour. Value-type labels carry their word and an edge style (solid, dashed, dotted). Risk tags carry a word and an icon (open circle, triangle). Recorded failures are a filled diamond.

## 2. Contrast (computed)

AA needs **4.5:1** for normal text and **3:1** for control edges, focus rings and chart marks. "Text" rows are checked at 4.5; "edge/mark" rows at 3.

| Foreground → background | Ratio | Needs | Result |
|---|---:|---:|---|
| sidebar.text #F2F4F5 → sidebar.bg #2B3843 | 14.02 | 4.5 | Pass |
| sidebar.text-muted #B7C1C9 → sidebar.bg | 6.74 | 4.5 | Pass |
| sidebar.text-active #FFFFFF → sidebar.bg-active #425563 | 11.50 | 4.5 | Pass |
| sidebar.text #F2F4F5 → sidebar.bg-active | 9.33 | 4.5 | Pass |
| sidebar.text-muted #B7C1C9 → sidebar.bg-active | **4.49** | 4.5 | **Forbidden** |
| sidebar.focus-ring #F5A092 → sidebar.bg (edge) | 6.80 | 3 | Pass |
| text.primary #363636 → card / background / subtle | 17.74 / 16.55 / 16.19 | 4.5 | Pass |
| text.secondary #425563 → card / background / subtle | 7.56 / 7.05 / 6.90 | 4.5 | Pass |
| text.muted #6B7280 → card #FFFFFF | 4.83 | 4.5 | Pass |
| text.muted #6B7280 → background #F8F8F8 | 4.51 | 4.5 | Pass (narrow; avoid for long text) |
| text.muted #6B7280 → subtle #EEEEEE | **4.41** | 4.5 | **Forbidden** |
| text.muted #6B7280 → risk.alert-bg #FEF3C7 | **4.34** | 4.5 | **Forbidden** |
| text.muted #6B7280 → notice.disclosure-bg #E8ECEF | **4.11** | 4.5 | **Forbidden** |
| text.secondary #425563 → risk.alert-bg | 6.79 | 4.5 | Pass |
| text.on-primary #FFFFFF → brand.primary #C8341F | 5.47 | 4.5 | Pass |
| text.on-primary #FFFFFF → brand.primary-hover #A82B1A | 7.58 | 4.5 | Pass |
| brand.primary #C8341F → card / background | 5.47 / 5.11 | 4.5 | Pass |
| brand.link #425563 → card / background / disclosure-bg | 6.70 / 6.25 / 5.69 | 4.5 | Pass |
| brand.focus-ring #E84A37 → card / background (edge) | 5.17 / 4.82 | 3 | Pass |
| notice.disclosure-text #2B3843 → disclosure-bg #E8ECEF | 12.43 | 4.5 | Pass |
| notice.replay-text #A82B1A → replay-bg #FDECEA | 6.71 | 4.5 | Pass |
| value-type.historical #334155 → #EEEEEE | 9.45 | 4.5 | Pass |
| value-type.predicted #1E40AF → #DBEAFE | 7.15 | 4.5 | Pass |
| value-type.illustrative #5B21B6 → #EDE9FE | 7.57 | 4.5 | Pass |
| risk.below-text #334155 → risk.below-bg #EEEEEE | 9.45 | 4.5 | Pass |
| risk.alert-text #92400E → risk.alert-bg #FEF3C7 | 6.37 | 4.5 | Pass |
| risk.alert-text #92400E → card | 7.09 | 4.5 | Pass |
| risk.alert-border #B45309 → card (edge) | 5.02 | 3 | Pass |
| risk.recorded-failure-text #991B1B → #FEE2E2 | 6.80 | 4.5 | Pass |
| #FFFFFF → risk.recorded-failure #B91C1C | 6.47 | 4.5 | Pass |
| feedback.problem-text #92400E → card | 7.09 | 4.5 | Pass |
| feedback.problem-border #B45309 → card (edge) | 5.02 | 3 | Pass |
| surface.input-border #767676 → card / background / subtle (edge) | 3.89 / 3.63 / 3.55 | 3 | Pass |
| surface.border #DBDBDB → card | **1.35** | 3 | **Forbidden as a control edge**; decorative dividers only |
| chart.grid #E5E7EB → chart surface | **1.24** | 3 | **Forbidden for data**; gridlines only, never meaning |
| chart.axis #6B7280 → white (tick text) | 4.83 | 4.5 | Pass |
| Chart marks on white: sensor line #425563, risk line #E84A37, baseline #7C3AED, cut-off #B45309, recorded failure #B91C1C, maintenance #475569, error #6B7280, histogram bar #C8341F | 6.70, 3.74, 5.70, 5.02, 6.47, 7.58, 4.83, 5.47 | 3 | Pass |

**Forbidden pairs, in plain words:**
- Muted grey text goes on white cards only. Never on table headers, zebra rows, the amber alert tag or the disclosure banner. Use secondary grey there.
- Muted sidebar text never sits on the highlighted (current page) item.
- The light border colour never forms the only edge of a button, input or tag.
- Gridlines never carry meaning.
- The teal risk line (3.74) passes for a line, not for text. Never use it for text.

Note: an earlier draft used #8792A2 for input edges. It measured 2.94 on the page background, so it was darkened to #767676.

## 3. Typography

One sans-serif family with a system fallback. Every number in a table, card or tooltip uses tabular figures so columns line up.

| Step | Size / line height (px) | Weight | Use |
|---|---|---|---|
| xs | 12 / 16 | 500 | Labels, tags, axis ticks, captions |
| sm | 14 / 20 | 400 | Table cells, controls, supporting text |
| base | 16 / 24 | 400 | Body text |
| lg | 18 / 28 | 600 | Card and section titles |
| xl | 22 / 28 | 600 | Page titles |
| 2xl | 30 / 36 | 600 | Metric card values |

Minimum size is 12px. 12px text uses secondary grey or darker.

**Number formats**
- Predicted chance: percent with one decimal, for example "12.4%", with the Predicted label nearby.
- Money: "$12,500" with the Illustrative label, or a column header "Cost, USD (illustrative)".
- Sensor readings: one decimal. Captions say "Units not stated by the source". Units are never invented.
- Time: "2015-11-14 06:00" (24-hour clock, no time zone, as in the source). The replay bar adds "Historical replay".
- Missing values show "—" with a screen-reader text "not available". Never 0.

## 4. Spacing, radii, layout, motion

- **Spacing:** 4px grid: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Card padding 20 on desktop, 16 on mobile.
- **Radii:** sm 4 (tags, inputs), md 6 (buttons), lg 8 (cards, popovers), xl 12 (drawers, dialogs), full (pills).
- **Layout:** sidebar 240px. Below 1024px wide the sidebar becomes a menu button that opens a panel. Top bar 56px. Content max width 1440px. Breakpoints 640 / 768 / 1024 / 1280. Touch targets at least 44×44px.
- **Depth:** one subtle card shadow and one popover shadow. No gradients, glow or 3D.
- **Motion:** 120–200ms transitions. Replay steps once per second. With reduced motion turned on, charts do not animate; replay still steps, because that is a data change, not decoration.

## 5. Chart palette

All marks sit on white. Lines are 2px. Markers are at least 8px.

| Token | Hex | Use | Second signal besides colour |
|---|---|---|---|
| chart.sensor-line | #425563 | Each sensor chart (one sensor per chart) | Chart title names the sensor |
| chart.risk-line | #E84A37 | Predicted chance over time | Legend "Predicted chance" |
| chart.model-main | #E84A37 | Main model on comparison charts | Solid line + direct label |
| chart.model-baseline | #7C3AED | Baseline model on comparison charts | Dashed line + direct label |
| chart.cutoff-line | #B45309 | Alert cut-off | Dashed, labelled "Cut-off" |
| chart.recorded-failure | #B91C1C | Recorded failure | Filled diamond |
| chart.maintenance-marker | #475569 | Maintenance record | Square |
| chart.error-marker | #6B7280 | Error record | Triangle |
| chart.histogram-bar | #C8341F | Risk distribution bars | Cut-off line + table view |
| chart.axis / grid | #6B7280 / #E5E7EB | Ticks, axis lines / gridlines | — |

Rules:
- **Sensor charts are small multiples:** one sensor per chart, one colour for all four. No chart ever needs four hues told apart.
- **One y-axis per chart.** Never two scales on one chart.
- **Only one categorical pair exists:** main model (teal) and baseline (violet). Checked with the dataviz palette validator on 13 Nov 2026: all checks pass (colour-blind separation ΔE 21.0, normal vision ΔE 30.2). An earlier slate-grey baseline failed that check and was dropped.
- Every chart has a "View as table" toggle.
- Amber and red are status colours. They never become "series 3".
