# Stage 4: planner checked live on a protected preview

Measured on 14 Nov 2026, just after 2 PM (Toronto time). Protection stayed on. The preview was built on the build machine from this branch, with the real serving bundle downloaded from the release and hash-checked. It was not promoted to production. Raw output and the script are in `stage4-live-evidence/`.

## Check 4: planner answer under 256 KB: met
The largest allowed planner request lists all 100 machines, with every cost and the crew slots at their maximum and the risk reduction at 90%. Its answer was 25,466 bytes, about 10% of the limit (n=3). All three answers were byte-for-byte identical, which also shows the same inputs give the same list. The smallest request's answer was 1,809 bytes.

## Check 2: data service size: still met
Vercel reports the data-service function at 30,005,883 bytes (n=1). Vercel does not say whether that figure is compressed. The limit is 500 MB.

## Refusals
- An old model version got 404.
- 101 crew slots got 422, with the allowed range in the message.
- An unknown field got 422.
- A body over 4,096 bytes got 413.

Every planner answer, including the refusals, was marked not cacheable (no-store).

## Live screenshots
`stage4-live-screenshots/` has four images: the planner and the fleet overview, each on desktop and mobile. All four pages returned 200 (see the screenshot log).

## What was deployed
- Preview deployment `dpl_AVMm8gUWXHmBEX3Bmdozy2ZkvsZY`, built from branch commit `09c86e2` (protection: Vercel Authentication).
- Serving bundle `piq-20261114-efc9c243`: `bundle.zip` 8,122,585 bytes, sha256 starting `0ad2916e` and ending `2d57d2`, checked by `scripts.fetch_bundle` before the build.

## Re-check on the final branch (2:27 PM Toronto time)
After review fixes changed the screen (decision 65), a second protected preview was built from commit `f96a208`: deployment `dpl_6PKxDe7VKTXYUPbXK676ouTqbBmj`, preview target, protection on, same bundle (hash re-checked by `scripts.fetch_bundle`). The planner calculation code did not change between the two builds.
- Largest allowed planner answer: 25,466 bytes again (n=3, identical). Smallest 1,809 bytes. Refusals 404 / 422 / 422 / 413; all no-store. Raw output: `stage4-live-evidence/s4-plan-final.log`.
- The four images in `stage4-live-screenshots/` were retaken from this preview and show the final screen. All four pages returned 200 (`s4-live-shots.log`).
