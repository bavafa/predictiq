# PredictIQ: Product requirements

A one-page plan. It all uses *simulated* sample data published by Microsoft: 100 made-up machines over one year, not real plant, fleet or mine telemetry. PredictIQ is a portfolio demonstration, not a production safety or control system.

## Problem statement
Maintenance managers lack a simple way to link machine health signals, near-term failure risk and the cost of acting early. Public examples often show a model score with no decision, or claim accuracy and savings they cannot back up. Reviewers lack a small, honest example that goes from sensor history to a maintenance decision.
## Proposed solution
A web application with no login. It replays the simulated machine history hour by hour, labeled "historical replay", never "live". For each machine it estimates the chance that a recorded component failure happens in the next 24 hours (our chosen window). It shows the riskiest machines, the sensor history and past events behind each estimate, and the factors that most pushed the score up or down: patterns in the data, not proof of physical cause. A planning screen ranks machines by expected cost of failure, using cost and capacity figures the user sets, labeled illustrative. A model page shows results on unseen data next to a simple baseline.

## Goals and non-goals
Goals:
- Four screens: fleet overview, machine details, maintenance planner, model performance; plus a short page on where the data comes from.
- A risk model checked honestly, with no future information leaking into any estimate.
- Every number on screen says whether it is historical, predicted or illustrative.

Non-goals:
- Real sensor feeds, machines, mines or companies, or control of any equipment.
- Real maintenance costs, or claims of savings, best repair actions or physical causes.
- User accounts, chatbots, retraining from the screen, work-order systems, mobile apps.

## Success metrics
All are checks we can pass or fail; no model results exist yet, and we set no accuracy targets in advance.
- A reproducible comparison of the model against a simple baseline on held-out later data, published whatever the result (*simulated*). Any improvement is an observation, not a goal.
- The 24-hour label is written down exactly: a failure strictly after the scoring hour and at or before 24 hours later. Edge cases are tested; several parts failing in one hour count as one event; a written rule covers the hours right after a failure.
- Every record type has an "as of" rule. Records logged at the scoring hour itself count as not yet known (simulated data: most failures have a same-hour repair).
- Training, tuning and test periods have a stated gap between them. The alert cut-off and calibration are chosen without touching the test period, which is used once.
- The main score is the precision–recall area under the curve: one number for how well the model catches failures without too many false alarms. Precision, recall, missed failures and false alarms are shown with it.
- Event-level measures are shown too: share of failure events caught and false alerts per 100 machine-days (*simulated*), with each run of consecutive alert hours counted as one alert.
- No claim is made about machines the model never saw unless a separate held-out-machines test is run.
- An automated check proves no estimate uses information from after its own timestamp.
- Planner results change the same way every time: different failure costs per machine model reorder the list; crew slots change which machines are shortlisted; the alert cut-off changes which machines are listed. All money figures are labeled illustrative.
- A fresh copy rebuilds the model and results from the documented download, with matching checks.

## Main risks
- **Simulated data is too clean, so results look too good:** say so on every results screen; show the baseline.
- **Future information leaks into training** (for example, repairs logged at failure time): past-only joins, split gaps, an automated check.
- **Money figures read as real savings:** show expected exposure only, labeled illustrative.
- **Data license is stated only for the whole source repository, not the files:** keep raw data out of the project, credit the source, ask the owner to confirm.
- **Free hosting is slow to wake up:** test early; show a loading state.

## Stages
Each starts after the owner approves the one before; an independent reviewer checks each.
- **Stage 1, Foundation:** data check, sign-offs, design, architecture, project skeleton.
- **Stage 2, Data and model:** data checks, past-only features, baseline and main model, repeatable evaluation.
- **Stage 3, Core screens and data service:** fleet overview and machine details on real model output, with replay.
- **Stage 4, Maintenance planning:** the planner, with illustrative costs, capacity and alert cut-off.
- **Stage 5, Launch:** model page, full testing, accessibility review, public release, limitations section.
