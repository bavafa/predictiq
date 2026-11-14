# Component list

_Proposed, design stage, 13 Nov 2026._ Generic building blocks only. Which libraries build them is an architecture decision, made later. Colours and type: `tokens.md`. Layouts: `../wireframes/` (one HTML file per screen; PNGs rendered by `render.mjs`).

**Rules for every component**
- Real buttons, links and inputs. Nothing clickable is a plain box.
- Visible 2px focus outline with a 2px gap.
- Touch targets at least 44×44px on mobile.
- Every number has a value type: Historical, Predicted or Illustrative. Missing values show "—", never 0.
- No component ships without a real behaviour.

## 1. Required components (brief §5)

| # | Component | Purpose | States | Accessibility |
|---|---|---|---|---|
| 1 | **Navigation sidebar** (responsive) | Moves between the five pages. Footer shows model version and "Microsoft sample data (simulated)". | Expanded (≥1024px); collapsed to a Menu button with a slide-in panel (<1024px); current page highlighted. | Labelled navigation landmark; current page marked as current; "Skip to content" first. Menu button says if it is open. Focus stays in the open panel; Escape closes it and returns focus to the button. |
| 2 | **Persistent disclosure banner** | Shows "Portfolio demo — simulated historical sample data; estimated economics are illustrative." on every page. | One state. Never dismissible. Wraps on mobile. | A note landmark outside the main content. Contrast 12.43:1. |
| 3 | **Value-type label** | Marks a value or a group of values as Historical, Predicted or Illustrative. | Three variants. Each differs by word and edge style (solid, dashed, dotted) as well as colour. | The word is always visible text. Screen readers read it after the value, for example "12.4%, predicted". |
| 4 | **Metric card** | One headline number with label and value type. | Ready; loading (grey block); not available ("—"); filtered ("of filtered machines"). | Label, value and value type are read together. Number uses tabular figures. |
| 5 | **Machine table** (sortable, filterable) | Ranked list of machines on Fleet Overview; ranked list on the Planner. | Ready; loading (grey rows); empty ("No machines match…" + Clear filters); error (message + Try again); paged. On mobile it becomes a list of tappable rows with a Sort menu. | A real table with caption and column headers. Sortable headers are buttons and announce the sort direction. Each row opens through a link in the machine cell. The result count is announced after filtering. |
| 6 | **Filter bar** | Machine model, status and machine-number filters, plus Clear filters. | Default; filtered; filtered to nothing. | Visible labels. Changes announce the new count. |
| 7 | **Line chart** (with units and time axis) | Sensor history, predicted chance over time, machines in Alert over time, precision and recall, model comparison, calibration. | Ready; loading; no data in range ("Only n hours of history"); error in one panel only. Range toggle 24 h / 7 days where relevant. | Wrapped as a figure with a title and a one-line summary. Axis titles name units, or say "Units not stated by the source". Markers differ by shape. Every chart has "View as table". Keyboard users can step through points with arrow keys. |
| 8 | **Distribution chart** | How many machines fall at each level of predicted chance, with the cut-off marked. | Ready; loading; empty. | Same as line chart. The cut-off line is dashed and labelled. |
| 9 | **Risk tag** | Status of one machine against the cut-off. | "▲ Alert" (amber, chance at or above the cut-off); "○ Below cut-off" (neutral). A separate "◆ Recorded failure" tag (red) is used only for failures in the data. | Word and icon always shown. Spoken as "Alert, predicted". Red never marks a prediction. |
| 10 | **Asset detail page** | Everything about one machine at the replay time. A full page, so it can be linked and shared. | Ready; no machine selected; loading; short history; one panel failed; machine not found ("Machine n isn't in the sample data", machine selector, link to Fleet Overview). When one panel fails, only that panel shows the error and Try again; the rest of the page stays usable. | Page heading names the machine. Back link returns to the fleet table with the same scroll position and filters. |
| 11 | **Explanation list and tooltip** | Ranked inputs that pushed the estimate up or down, with direction and size. A tooltip gives the plain meaning and time window of each input. | Ready; loading; not available for this hour. | Direction is text (+ raises, − lowers) as well as bar style. Tooltip opens on hover **and** keyboard focus; Escape closes it. The fixed caveat "patterns, not causes; not repair advice" is always visible, not hidden in the tooltip. |
| 12 | **Replay controls** | Start, Step back, Play/Pause, Step forward, step size, timeline, replay time and the "Historical replay" badge. | Stopped; playing; at start (Start and Back disabled, message); at end (Play and Forward disabled, "End of the replay window", Jump to start); read-only on pages that do not change with time. | A labelled group. Play/Pause is one toggle button that announces its state. Buttons that cannot act are marked unavailable but stay focusable, and explain why in visible text. The timeline is a native range input with a visible label, first and last hour at either end, and the current time shown at the start of the bar; it speaks the full time. Arrow keys move 1 hour, Page Up/Down 10 hours, Home/End to the ends. 44px tall on mobile. While playing, time is announced every sixth step only. |
| 13 | **Assumptions panel** | Planner inputs: cost if a failure happens (optionally per machine model), planned maintenance cost, crew slots, the shared cut-off, "also list below cut-off", and the optional assumed risk reduction. Reset to defaults. "How this is calculated." | Defaults; edited; invalid input (field marked, range message, list keeps last valid result); effectiveness on (adds net-benefit column); per-model costs set (list gains a "Moved" column and an "Order changed" note); list loading (panel stays usable); list error (Try again, assumptions kept). Each input says under it what it changes, matching the Planner table in the experience spec. On mobile it sits above the list. | Every input has a visible label with units and "illustrative". Errors are tied to their field and read aloud. Sliders are native range inputs with visible label, minimum, maximum and current value. |
| 14 | **Loading, empty and error states** | Shared patterns used by every panel. Also "Data service waking up". | Loading: grey blocks the final size. Empty: a sentence and one action. Error: what failed, Try again, settings kept. Waking up: explains the wait, fills in by itself. | Loading regions are marked busy. New blocking errors are announced once; others are polite status messages. Never a blank box. |
| 15 | **Source and method disclosures** | "How it was tested" on Model Performance; "How this is calculated" on the Planner; data credit and limitations on About & Data. | Collapsed; expanded. | The toggle says whether it is open. External links say they open a new tab. |

## 2. Supporting components

| Component | Purpose | Notes |
|---|---|---|
| **Cut-off control** | Native range input 0%–100%, with visible label, "0%" and "100%" at the ends, current value with "(default)" or "(custom)", and Reset to default. | One shared value on Fleet, Planner and Model Performance. Arrow keys move 1 point, Page Up/Down 10, Home/End to the ends. 44px tall on mobile. |
| **Machine selector** | Pick a machine by number. | Type-ahead; lists 1–100 with machine model. |
| **Range toggle** | 24 hours or 7 days. | Behaves as a pair of radio buttons. |
| **Sensor tabs** | One sensor chart at a time on mobile. | Proper tabs; arrow keys move between them. |
| **Model comparison table** | Main model and simple baseline side by side on Model Performance: precision, recall, precision–recall area, the four right/wrong counts, false alerts per 100 machine-days, share of failure events caught, calibration gap. | A line above it states the held-out test period and the cut-off in use. Real table with caption and headers; rows that do not depend on the cut-off say so. "Better is" column on desktop, a note under it on mobile. Values "—" until the saved evaluation exists. |
| **Event list** | Recent errors and repairs up to the replay time. | Times in the archived format. Specific empty text, e.g. "No errors in the 7 days up to this time." |
| **Chart/table toggle** | Switch any chart to its table. | Table uses the same number formats as tooltips. |
| **Visitor guide** | Three steps for a first visit, on Fleet Overview. | Hide guide removes it for the visit. It is not the disclosure, which never hides. |
| **Notice** | In-page messages: Planner money notice, end of replay, cut-off changed. | Text plus icon. Amber edge for problems; neutral for information. |

## 3. Not included, on purpose
- No export, share or download buttons in the first release.
- No model switcher on Fleet or Asset Details (proposed; see open questions in the experience spec).
- No Sensor Sandbox. It is a stretch item and needs separate scope approval.
- No chatbot, login or notifications.
