# PredictIQ: Product requirements

A one-page plan. Everything here uses *simulated* sample data published by Microsoft: 100 made-up machines over one year, not real plant, fleet or mine telemetry. PredictIQ is a portfolio demonstration, not a production safety or control system.

## Problem statement
Maintenance managers lack a simple way to link machine health signals, near-term failure risk and the cost of acting early.

Public examples often show a model score with no decision attached, or claim accuracy and savings they cannot back up. Hiring managers and technical reviewers lack a small, honest example that goes from sensor history to a maintenance decision. For the owner, it is a portfolio project showing industrial analytics, model checking and product design from start to finish.

## Proposed solution
A web application with no login. It replays the simulated machine history hour by hour, clearly labeled "historical replay", never "live". For each machine it estimates the chance that a recorded component failure happens in the next 24 hours (our chosen window). It shows which machines look riskiest, the sensor history and past events behind each estimate, and the factors that most pushed the score up or down. These are patterns in the data, not proof of what physically causes a failure. A planning screen ranks machines by expected cost of failure, using cost and capacity figures the user sets and that are always labeled illustrative. A model page shows how well the model did on data it never saw, next to a simple baseline.

## Goals and non-goals
Goals:
- Four screens: fleet overview, machine details, maintenance planner, model performance; plus a short page on where the data comes from.
- A risk model checked honestly: trained on earlier months, tested once on later months, with no future information leaking into any estimate.
- Every number on screen says whether it is historical, predicted or illustrative.
- A visitor understands the app quickly without help.

Non-goals:
- Real sensor feeds, real machines, mines or companies, or control of any equipment.
- Real maintenance costs, or claims of savings, best repair actions or physical causes.
- User accounts, chatbots, retraining from the screen, work-order systems, mobile apps.

## Success metrics
All are checks we can pass or fail; no model results exist yet, and we set no accuracy targets in advance.
- The model beats a simple baseline on held-out later data, whatever the numbers are, and both are shown side by side (*simulated*).
- The main score is the precision–recall area under the curve: one number summing up how well the model catches failures without raising too many false alarms. Precision, recall, missed failures and false alarms are shown with it.
- An automated check proves no estimate uses information from after its own timestamp.
- Every control on screen changes what is shown; none is decorative.
- Planner rankings change the same way every time the user changes costs, capacity or the alert cut-off; all money figures are labeled illustrative.
- A fresh copy rebuilds the model and its results from the documented download, with matching file checks.

## Main risks
- **Simulated data is too clean, so results look too good:** say so on every screen that shows results, and always show the baseline.
- **Future information leaks into training** (for example, repair records logged at failure time): strict past-only joins, a gap between training and test periods, and an automated check.
- **Money figures read as real savings:** show expected exposure only, label every amount illustrative, and claim no realized benefit.
- **Data license is stated only for the whole source repository, not the files:** keep raw data out of the project, credit the source, and ask the owner to confirm.
- **Free hosting is slow to wake up:** test early and show a clear loading state.

## Milestones
Each stage starts only after the owner approves the one before it. An independent reviewer checks each milestone before it closes.
- **M0 Foundation:** data check, product brief and requirements sign-off, user-experience design, architecture, then a project skeleton that starts.
- **M1 Data and model:** data checks, past-only features, baseline and main model, repeatable evaluation and replay estimates.
- **M2 Core screens and data service:** fleet overview and machine details running on real model output through a data service, with replay controls.
- **M3 Maintenance planning:** the planner, with user-set illustrative costs, capacity and alert cut-off.
- **M4 Launch:** model performance page, full testing, accessibility review, public release and a written limitations section.
