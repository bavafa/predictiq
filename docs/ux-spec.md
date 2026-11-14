# PredictIQ: Experience spec

How the screens work, in plain words. Everything shown is *simulated* sample data published by Microsoft: 100 made-up machines over one year. Money figures are *illustrative*. Status: proposed, for review and owner approval.

## Who it's for
- **Maintenance or reliability manager.** Wants the riskiest machines first, the evidence behind each estimate, and a short repair list that fits the crew.
- **Operations lead.** Wants a quick sense of how many machines need attention now and how that changes over time.
- **Hiring manager or visitor.** Has about 90 seconds and no login. Wants to see that it works, that the model was tested honestly, and that nothing is overclaimed.

## The 90-second visitor path
1. The site opens on **Fleet Overview**. The disclosure banner and the "Historical replay" badge are the first things on screen. A short three-step guide sits at the top. It can be hidden.
2. The visitor presses **Play**. The replay time moves forward one hour per second. Cards, chart and table update together.
3. They open the top machine in the table. **Asset Details** shows its sensor history, recent errors and repairs, its predicted chance of failure, and what pushed that estimate up or down.
4. They open **Maintenance Planner** and change the cost of a failure or the crew size. The ranked list and shortlist change at once.
5. They open **Model Performance** to see results on held-out data next to a simple baseline, and why plain accuracy misleads.
6. **About & Data** says what the data is, where it comes from, and what the demo does not do.

## Screens and key interactions

**Shared frame.** A dark sidebar holds the five pages. Below 1024px wide it becomes a **Menu** button that opens a panel; Escape or **Close menu** shuts it and returns focus to the button. A top bar shows the page title and the "Historical replay" badge. A replay bar holds the replay time and controls. It applies to every page that changes with time. Model Performance and About & Data show the time read-only, because nothing on them changes with it. The replay time, alert cut-off and selected machine carry across pages and sit in the web address, so a view can be shared.

**Fleet Overview.** Purpose: which machines have the highest predicted chance of a recorded failure in the next 24 hours, at the replay time. Shows four cards (machines shown, machines in Alert, highest predicted chance, scored hour), a chart of how many machines fall at each level of predicted chance with the cut-off marked, a chart of machines in Alert over the past 24 hours or 7 days, and a ranked table. The Alert count always equals the number of Alert rows in the filtered table.

**Asset Details.** Purpose: the evidence for one machine. Shows machine model and age, the predicted chance with its status tag, a ranked list of inputs that pushed the estimate up or down, four sensor charts (one sensor each) with markers for recorded failures, repairs and errors, a chart of past estimates beside recorded failures, and lists of recent errors and repairs. Every list and chart stops at the replay time. Records logged in the scored hour itself are not used by the model and are not listed. On mobile the four sensors become tabs, one chart at a time.

**Maintenance Planner.** Purpose: turn risk into a short list that fits the crew. An assumptions panel on the left; a ranked list on the right. Ranking is **expected exposure = predicted chance of failure in 24 hours × cost if a failure happens**. Ties go to the higher chance, then the lower machine number. The top N machines, where N is the crew slots, are marked "Slot 1…N"; the rest say "Over capacity". A summary gives the shortlist size, total expected exposure and planned spend. "How this is calculated" opens the formula in plain words. With one cost for every machine, the order matches the risk order; setting a cost per machine model changes it, and the page says so.

**Model Performance.** Purpose: let a reviewer judge the model rather than trust it. Shows the model version, evaluation date, test period and the 24-hour target in words; four headline results with the baseline beside the main model; a cut-off explorer (precision and recall by cut-off, a right/wrong table, alerts per day); precision–recall curves for both models; a calibration chart (do predicted chances match what happened?); why accuracy misleads; and limitations. Every number comes from the saved evaluation.

**About & Data.** Purpose: what this is and is not. The portfolio statement, how to read the three value labels, the approved data credit line, basic facts about the data, the replay window, known limitations and what is out of scope. No controls besides links.

### Every control and what it changes

| Control | Where | What it changes |
|---|---|---|
| Play / Pause | Replay bar | Steps the replay time forward once per second by the step size. Stops at the end of the window. |
| Step back / Step forward | Replay bar | Moves the replay time by one step. Disabled at the start / end, with a message. |
| Start | Replay bar | Jumps to the first hour of the replay window. |
| Step size (1 h, 6 h, 24 h) | Replay bar | How far Play and the step buttons move. |
| Replay timeline | Replay bar | Drag or use arrow keys to pick any hour in the window. |
| Alert cut-off + Reset to default | Fleet, Planner, Model Performance | One shared value. Changes every status tag, the Alert count, the cut-off line on charts, the planner list, and the right/wrong table. Reset returns to the default chosen on validation data. |
| Machine model, Status, Machine number filters | Fleet | Narrow the table and all cards together. |
| Clear filters | Fleet | Removes all filters. |
| Column headers | Fleet table | Sort by that column; again to reverse. Mobile has a Sort menu instead. |
| Previous / Next page | Fleet table | 25 rows per page. |
| Range 24 h / 7 days | Fleet trend chart, Asset charts | Time span of the charts, ending at the replay time. |
| View as table | Every chart | Shows the same values as a table. |
| Machine row / link | Fleet, Planner | Opens Asset Details for that machine at the same time and cut-off. |
| Machine selector | Asset Details | Switches machine. |
| Sensor tabs | Asset Details, mobile | Which sensor chart shows. |
| ⓘ explanation buttons | Asset Details, Model Performance | Opens a plain definition of the input or measure. |
| Cost if a failure happens; cost per machine model | Planner | Changes expected exposure and the ranking. |
| Planned maintenance cost | Planner | Changes planned spend and, if turned on, net benefit. |
| Crew slots (− / + / typed) | Planner | How many machines are shortlisted. |
| Also list machines below the cut-off | Planner | Adds them to the ranked list. |
| Assume maintenance lowers the chance of failure by …% | Planner | Off by default. When on, adds an "Expected net benefit (estimate)" column and its formula. |
| Reset to defaults | Planner | Restores the documented illustrative defaults. |
| Hide guide | Fleet | Hides the three-step guide for this visit. |
| Menu / Close menu | Mobile | Opens and closes navigation. |

No control is decorative. If a control would do nothing on a page, it is not shown there.

## States
- **Loading:** grey blocks the size of the final content, so nothing jumps. Controls stay usable; a new request replaces the old one.
- **Data service waking up:** "Waking up the data service… This can take up to a minute. The page fills in by itself." Offers a link to About & Data meanwhile.
- **Error:** a message saying what failed, with **Try again**. Settings are kept. One failed panel does not blank the whole page.
- **Empty / filtered to nothing:** "No machines match these filters at [time]." with **Clear filters**. Cards read 0, never blank.
- **Planner with no machines over the cut-off:** says so and offers to list machines below it.
- **Invalid planner input:** the field is marked, a message gives the allowed range, and the list keeps the last valid result with a note saying so.
- **No machine selected:** "Choose a machine to see its history and risk", with a selector and a link to Fleet Overview.
- **Threshold changed:** shows "(custom)" next to the value; Reset becomes active; tags, cards, chart line and table update together; screen readers hear "Cut-off [value]. [n] machines in Alert."
- **Replay at the start:** Start and Step back are disabled; "Start of the replay window."
- **Replay at the end:** playback stops; Play and Step forward are disabled; "End of the replay window. There is no later data." with **Jump to start**. It never wraps around.
- **Short history:** at the start of the data, "Only [n] hours of history before this point."
- **Model results not yet available:** Model Performance says "Results appear after the model is evaluated" and shows no numbers.
- **Version info missing:** About & Data shows "—" for the model version and the rest stays readable.

## Accessibility
- **Keyboard:** everything works by keyboard in a sensible order. A "Skip to content" link comes first. Arrow keys move sliders and the replay timeline. Space or Enter presses buttons. Escape closes menus and tooltips.
- **Focus:** a visible 2px outline on every control. Focus returns to where it came from after a menu or tooltip closes.
- **Contrast:** all allowed text pairs meet 4.5:1; control edges and chart lines meet 3:1. Pairs that fail are forbidden in the tokens.
- **Labels:** every input has a visible label with units. Icon-only buttons have a spoken name. Tables have headers and a caption.
- **Charts:** each has a title, a one-line text summary, labelled axes with units (or "units not stated by the source"), and a "View as table" option.
- **Colour is never the only signal:** status tags carry a word and an icon; value labels carry a word and a different edge style; chart markers differ by shape; the baseline is dashed.
- **Announcements:** replay time is read aloud every sixth step while playing, not every step. End of data, cut-off changes and plan updates are announced once.
- **Reduced motion:** charts do not animate. Replay still steps, because that is a data change.
- **Mobile:** single column, no sideways scrolling, touch targets at least 44×44px. Wide tables become lists.

## Labeling rules
- **Three value types, everywhere.** Each number carries, or sits under a heading that carries, one label:
  - **Historical**: simulated sample data as recorded (sensor readings, errors, repairs, failures, machine model and age).
  - **Predicted**: a model estimate (chance of failure, status, what pushed the estimate).
  - **Illustrative**: a user-set assumption or anything computed from one (costs, crew slots, exposure, net benefit).
  A value computed from both a prediction and an assumption is Illustrative.
- **Persistent disclosure** at the top of every page, never dismissible: "Portfolio demo — historical sample data; estimated economics are illustrative."
- **"Historical replay", never "Live".** No "real-time", "now" or "current" for replayed data. Times say "replay time". "Live" appears only in denials such as "Nothing on this site is live."
- **Expected exposure, never "savings".** No "saved", "savings", "return on investment" or "avoided cost", except in denials such as "It is not a saving." Net benefit appears only after the user sets an assumed risk reduction, and is labelled an estimate.
- **Associations, not causes.** Explanations are "what pushed this estimate up or down", with the line "These are patterns the model found in the data, not causes. They are not repair advice."
- **Red means a recorded failure.** Model alerts are amber. Red is only for failures that really appear in the data.
- **No unexplained short forms.** Measures are named in words with a one-line meaning.
- **No invented numbers.** Before real results exist, values show "—". Model Performance shows no numbers until the saved evaluation exists.

## Open questions
1. **Starting replay time.** Proposed: the first hour of the replay window. An alternative is a documented hour with at least one machine in Alert, which makes the first visit more useful but could look hand-picked.
2. **Illustrative cost defaults.** The values need choosing and stating on the page. Proposed for the planning stage.
3. **Model choice on Fleet and Asset Details.** Proposed: those screens show the main model only; the baseline appears only on Model Performance. The brief mentions filtering by model; we read "model" there as the machine model.
4. **Replay window.** It covers the held-out test period only, so its dates are set in the data and model stage.
5. **Two status levels.** Proposed: Alert and Below cut-off only. A middle "watch" level would need a second, arbitrary cut-off.
