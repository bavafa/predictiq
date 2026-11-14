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

## License and redistribution

- The `microsoft/sqlworkshops` repository's `LICENSE` file is the **MIT License** (Copyright Microsoft Corporation). GitHub reports it as MIT.
- The same repository's README says: "Microsoft and any contributors grant you a license to the Microsoft documentation and other content in this repository under the Creative Commons Attribution 4.0 International Public License … and grant you a license to any code in the repository under the MIT License."
- Neither statement names the CSV files specifically. Under either reading (MIT or CC BY 4.0) use, modification and redistribution are permitted **with attribution / notice retained**.

**Our approach (conservative):**
1. Raw CSVs are **not committed**. `scripts/download_data.sh` fetches them from the pinned commit and fails if any SHA-256 differs. `data/raw/` is gitignored.
2. Public builds will credit: "Data: Microsoft Predictive Maintenance Modelling Guide sample dataset (simulated), via github.com/microsoft/sqlworkshops, licensed CC BY 4.0 / MIT."
3. Derived artifacts (model outputs, aggregated replay predictions) may be published with that credit.

**Owner decision needed (low risk):** confirm you are comfortable publishing derived outputs under the attribution above, given the data files' license is stated only at repository level. Raw data stays out of the repo regardless.

## Do not

- Do not use Kaggle or other third-party mirrors unless their bytes match the SHA-256 values above.
- Do not describe the data as real, live, or from any mine or named company.
