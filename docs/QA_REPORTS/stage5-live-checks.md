# Stage 5: live checks on a protected preview

Run on 14 Nov 2026 at about 5:54 PM, Toronto time. Raw output is in `stage5-live-evidence/`.

The preview `dpl_7zzg8naq7yXKrrYFNXRyD2AZfM6M` was built on the build machine from commit `f29e567`. It used the real bundle `piq-20261114-efc9c243`, hash-checked by `scripts.fetch_bundle`. Protection was on (Vercel Authentication), and nothing was promoted to production.

## Results
- **Data service:** function size 30,292,792 bytes (limit 500 MB).
- **Endpoints:**
  - health 200, `no-store`.
  - metadata 200.
  - model metrics 200, 8,065 bytes.
  - threshold analysis 200, 144,715 bytes (under the 256 KB limit).
  - fleet 200, 13,828 bytes.
  - Wrong model version: 404. Unknown path: 404. Both `no-store`.
- **Pages:** all five return 200 through the protection bypass: Fleet Overview, Asset Details, Maintenance Planner, Model Performance, and About & Data.
- **Protection:** without the bypass, the page and the API both answer 302, a redirect to Vercel sign-in.
- **Production domain** `predictiq-eight.vercel.app`, logged out: 404 `DEPLOYMENT_NOT_FOUND`, because nothing is deployed to production. It does not redirect to sign-in.
- **Planner:**
  - The largest allowed request returned 25,466 bytes, three times, with identical bodies.
  - Error responses are unchanged: 404 for a wrong model version, 422 for 101 crew slots, 422 for an unknown field, 413 for an oversized body.
  - Every planner response is `no-store`.
- **Firewall:** the "API rate limit" rule is active at 300 requests per 60 s per IP.
- **Caching:** for cacheable data answers, the browser saw `public, max-age=3600`. Vercel strips the `s-maxage` part from what browsers see.

## Screenshots
`stage5-live-screenshots/`: all five pages, on desktop and mobile, taken from this preview.
