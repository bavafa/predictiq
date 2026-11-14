# Data provenance

_Verified by the orchestrator on 13 Nov 2026 (America/Toronto). Every fact below was checked against the live source on that date._

## What the data is

The Microsoft "Predictive Maintenance Modelling Guide" sample dataset (2015): hourly telemetry, error logs, maintenance records, failure records and machine metadata for 100 machines.

**It is simulated data.** Microsoft's own announcement describes the model as one that "learns from **simulated historical data** that includes telemetry, error logs, maintenance records, machine properties and failure records" (Fidan Boylu Uz, Microsoft, archived blog: https://learn.microsoft.com/en-us/archive/blogs/machinelearning/predictive-maintenance-modelling-guide-in-the-cortana-intelligence-gallery). PredictIQ must describe it as *simulated sample data published by Microsoft*, never as real plant, fleet, or mine telemetry.

## Where we get it (source of record)

| Item | Value |
|---|---|
| Repository | https://github.com/microsoft/sqlworkshops (Microsoft-owned, not archived) |
| Path | `SQLServerAndAzureMachineLearning/ML Services for SQL Server/data/` |
| Pinned commit | `e836f4e866028db7fd7d1a66b88f79664a1f4eac` (master on retrieval date; data files last changed in commit `ebdc49e7…`, 1 May 2019) |
| Download base URL | `https://raw.githubusercontent.com/microsoft/sqlworkshops/e836f4e866028db7fd7d1a66b88f79664a1f4eac/SQLServerAndAzureMachineLearning/ML%20Services%20for%20SQL%20Server/data/` |
| Retrieval date | 2026-11-13 |

### Why not the link in the brief

The brief points to https://github.com/Azure/AI-PredictiveMaintenance (archived, CC BY 4.0). That repository **does not contain the `PdM_*.csv` files**: it ships a data *generator* notebook, not this dataset (checked via the full git tree on 13 Nov 2026). The original Azure AI Gallery collection page (gallery.azure.ai) and the old `azuremlsamples.azureml.net/templatedata/` URLs both failed to connect from our machine on 13 Nov 2026 (curl connection errors), so they cannot serve as a reproducible source. Microsoft's own Azure sample `Azure/MachineLearningSamples-PredictiveMaintenance` downloads the same files from `Microsoft/SQL-Server-R-Services-Samples`, but that path no longer exists in that repository. The `microsoft/sqlworkshops` copy is the surviving Microsoft-owned copy, and it is what Microsoft's own course notebook uses.

## Files and hashes

Git blob SHAs below match the GitHub API listing of the pinned commit, so the files are byte-identical to Microsoft's copy.

| File | Bytes | Data rows | SHA-256 | Git blob SHA |
|---|---:|---:|---|---|
| PdM_telemetry.csv | 80,142,329 | 876,100 | `d957f3c45bb83416b716600da8cffd72f4b6961db89867d9696ad19f7cb1bd4e` | `c525d7a5f4654e473120c3b3129dc050a2427659` |
| PdM_errors.csv | 129,077 | 3,919 | `9c2a2a010ad77227e2bb0c94e7971bca78810790ddd1f28a8bee4f12c2f62370` | `ac4b08e3ce9447b2d955b23562409e929115609d` |
| PdM_maint.csv | 104,903 | 3,286 | `481ed4e155f609e6ca6130754d2c035453093902a507cce5b3f3e235995f1db6` | `93cd3e44979883553b0b457d2ed889fe025298af` |
| PdM_failures.csv | 24,336 | 761 | `0c6c31a4fd52ef2df95ad7c44e8b0c8c32917bcef29ba5a1ba3ba45531ded3b7` | `7b16d3e2647729956168b52bb2823980bf4a5d66` |
| PdM_machines.csv | 1,582 | 100 | `5e8e1571c4999bf88abb7cae3925964c218d946fe851a9a100bb3d19330652bc` | `ef05e70ced073a7bd4ec5181d02ac701021decdf` |

## Schema (as observed)

| File | Columns | Notes |
|---|---|---|
| telemetry | `datetime`, `machineID` (int), `volt`, `rotate`, `pressure`, `vibration` (float) | Hourly, 2015-01-01 06:00 to 2016-01-01 06:00; 100 machines; no nulls; no duplicate machine-hour rows. Observed ranges: volt 97.3–255.1, rotate 138.4–695.0, pressure 51.2–186.0, vibration 14.9–76.8. Units are not stated by the source. |
| errors | `datetime`, `machineID`, `errorID` (error1–error5) | 2015-01-01 06:00 to 2016-01-01 05:00; 100 machines. |
| maint | `datetime`, `machineID`, `comp` (comp1–comp4) | 2014-06-01 to 2016-01-01; starts **before** telemetry. Includes replacements made at failure time. |
| failures | `datetime`, `machineID`, `failure` (comp1–comp4) | 761 rows across 98 machines; one row per failed component, so several rows can share a machine and timestamp (event de-duplication needed in M1). Counts: comp2 259, comp1 192, comp4 179, comp3 131. |
| machines | `machineID`, `model` (model1–4), `age` (years) | 100 rows. |

Timestamps carry no time zone in the source; we treat them as naive hourly timestamps.

## Validation checks

_Run 13 Nov 2026 by the orchestrator on the downloaded files; the event, duplicate-key and maintenance counts were independently reproduced by the reviewer._

| Check | Result |
|---|---|
| Telemetry completeness | 100 machines × 8,761 hourly rows each; every consecutive gap is exactly 1 hour; no blank fields; no duplicate machine-hours. |
| Blank fields / identical rows | Zero in all five files. |
| Repeated machine-hour keys | Errors: 577 rows sit in machine-hours that hold more than one error row (303 rows beyond the first per machine-hour); maintenance: 1,514 rows in shared machine-hours (758 beyond the first). These are legitimate multiple records (different error types / components), not identical rows. |
| Machine IDs | Every machine ID in errors, maintenance and failures exists in the machine table. Machine ages 0–20 years. |
| Failure events | 761 component-failure rows collapse to **719 machine-time events** (42 events have two components failing in the same hour; none more). Every event joins to a telemetry row at the same machine-hour. |
| Maintenance at failure time | **702 of 719** failure events have a maintenance record at the same machine-hour (1,022 maintenance rows sit on failure timestamps; 743 failure rows match a same-hour replacement of the same component). These are repairs logged at failure time and are a **leakage hazard**: the data-and-model stage must treat records at the prediction timestamp as unavailable unless strictly earlier, and document the rule. |

## License and redistribution

What the source actually says (checked at the pinned commit):
- The repository root has a single `LICENSE` file, and it is the **MIT License** ("Copyright (c) Microsoft Corporation"). There is no `LICENSE-CODE` file at the root.
- The repository README's License section says: "Microsoft and any contributors grant you a license to the Microsoft documentation and other content in this repository under the Creative Commons Attribution 4.0 International Public License, see the LICENSE file, and grant you a license to any code in the repository under the MIT License, see the LICENSE-CODE file." Both of those links point to a **different** Microsoft repository (`MicrosoftDocs/mslearn-tailspin-spacegame-web`), not to this one.
- Nothing names the CSV files specifically.

**Reading:** the README's wording suggests the CSV files ("other content") fall under **CC BY 4.0**, while the only license file actually present is **MIT**. The two statements conflict, and the README's links point elsewhere, so the license of the data files is **unresolved on the face of the source**. Both candidate licenses permit use, modification and redistribution with attribution, so the practical risk is low, but this is a legal judgment for the owner, not something we decide.

**Our approach until the owner decides (conservative):**
1. Raw CSVs are **not committed**. A download script (planned for the project-skeleton stage; **not built yet**) will fetch them from the pinned commit and fail if any SHA-256 differs. The raw-data folder will be gitignored.
2. Nothing is published yet. Draft credit for any future public build, **for owner review**: "Data: Microsoft Predictive Maintenance Modelling Guide sample dataset (simulated), from github.com/microsoft/sqlworkshops (pinned commit e836f4e). Microsoft states content in that repository is licensed under CC BY 4.0; the repository's license file is MIT." We do **not** claim this credit alone satisfies both licenses: MIT also requires keeping its copyright and permission notice with copies or substantial portions, and CC BY 4.0 has its own attribution conditions. Exact publication terms are part of the owner decision below.

**Owner decision needed:** confirm you are comfortable using the data and publishing derived outputs (model scores, charts) with the credit above, given the license conflict described. Alternative: ask Microsoft (the README lists sqlserversamples@microsoft.com) before public release.

## Do not

- Do not use Kaggle or other third-party mirrors unless their bytes match the SHA-256 values above.
- Do not describe the data as real, live, or from any mine or named company.
