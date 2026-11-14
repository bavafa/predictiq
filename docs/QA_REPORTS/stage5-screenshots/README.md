# Stage 5 screenshots: Model Performance

Taken from the production web build against the real local model bundle (`piq-20261114-efc9c243`, simulated sample data) with:

```
npm --prefix frontend run build
node scripts/screenshots.mjs --real --stage5
```

Desktop is 1440 × 900, mobile is 390 × 844, both full page. The default cut-off is the main model's 51% (chosen on validation data). The "changed cut-off" shots use 30%.

| File | What it shows |
|---|---|
| `model-performance-desktop.png` | The page at the default cut-off: header facts (model version, model build date (with a note that the date the results were produced is not recorded), held-out test period, the 24-hour target in words), the shared cut-off control, the test period and cut-off line, the "Main model vs simple baseline" table with its "Better is" column, the four charts, "Why accuracy misleads when failures are rare" and the limitations. |
| `model-performance-mobile.png` | The same page on a phone: the table keeps three columns (measure, main model, simple baseline) and the "better is" rule sits in a line under it; charts stack in one column. |
| `model-performance-state-changed-cutoff-desktop.png` | The cut-off moved to 30%. Every cut-off row of the table changes for both models, the amber cut-off line moves on the two cut-off charts, and the accuracy table follows. The precision–recall area and the calibration gap (marked "covers all cut-offs") do not change. |
| `model-performance-state-changed-cutoff-mobile.png` | The same change on a phone. |
| `model-performance-state-loading-desktop.png` | While the saved results load (held back for five seconds): header, cut-off control and test period line are shown; the table and charts are grey blocks; the limitations stay readable. |
| `model-performance-state-error-desktop.png` | The saved evaluation could not be loaded (the service answered with an error): "Couldn't load the saved evaluation results." with Try again. No table, chart or number from the results is shown; the test description and limitations stay. |
| `model-performance-state-not-available-desktop.png` | The saved files hold no evaluation yet: "Results appear after the model is evaluated". No table, chart or number from the results is shown. |

The loading, error and not-available states are produced by delaying or replacing the browser's calls to `/api/v1/model/…`; everything else is real.
