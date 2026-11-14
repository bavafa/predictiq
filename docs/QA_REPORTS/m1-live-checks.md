# Data and model stage: size checks re-measured on a protected preview

Measured on 14 Nov 2026 between 9:15 and 9:17 AM (Toronto time). Protection stayed on. Raw output, including the function-size record, and the script that produced it are in `m1-live-evidence/`.

## What was deployed
- **Source:** the branch at its latest fixed commit, with the real serving bundle for model version piq-20261114-efc9c243 (simulated data).
- **Getting the bundle:** downloaded from the project's GitHub pre-release with the fetch script. Its hash matched the committed record, and its contents were identical to the locally built bundle.
- **Deploying:** built locally with Vercel's build tool and uploaded as a protected preview. It was not promoted to production.
- **Branch previews:** previews built automatically from the branch have no bundle, because the bundle is not in git. They answer the data questions with a clear "model data unavailable" (503) and report no model in the health check. We checked this on the branch preview, n=1 for each.

## Check 2: data service size under 500 MB: met
- **Deployed function:** Vercel reports 29,996,205 bytes (about 30 MB, n=1). Vercel does not say whether that figure is compressed.
- **Local build:** the same function is 75,473,468 bytes uncompressed, in 1,175 files. The numerical library makes up most of that. The serving bundle is 10,127,369 bytes uncompressed.

## Check 4: largest allowed response under 256 KB: met
Each data question was asked once, with its largest allowed request (n=1 each). Sizes are uncompressed bytes.

| Question | Bytes |
|---|---|
| Cut-off table for both models | 144,715 |
| One machine's 7-day sensor history | 16,919 |
| Fleet at the first replay hour | 9,807 |
| Fleet trend, 7 days | 9,380 |
| Fleet, 100 machines, last hour | 9,152 |
| One machine's details (largest of all 100, measured live) | 8,455 |
| Model results | 8,065 |
| Metadata | 7,167 |
| One score's explanation | 820 |

The largest response is 57% of the 256 KB limit.

## Other behaviour seen in the same run
- **Caching headers:** data answers carried the long cache header, and a repeat of the cut-off table was a cache HIT.
- **Refused requests:** an old model version got 404, machine 101 got 404, and cut-off 101 was refused with 422. None of these was cached.
- **Health:** health is never cached.
- **Not measured yet:** the planner question (POST) arrives in Stage 4, so its size has not been measured.
