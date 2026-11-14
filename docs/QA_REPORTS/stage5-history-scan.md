# Stage 5: pre-launch scan of the whole git history

Run 14 Nov 2026 with `uv run python -m scripts.history_scan` on branch `model-perf` (HEAD `ea877a1`, before the launch-preparation commit). **No secret values are printed here**: only the category, the file, the commit counts and a short commit id.

## What was scanned
- **135 commits on 27 refs** (`git rev-list --all`: all branches, tags and remotes), not only HEAD.
- Every added **and removed** line of every commit (`git log -p --all`), and every file name ever added.
- The author and committer email of every commit.
- With the **same rules as the release-hygiene test** (`scripts/tests/test_release_hygiene.py`, which the script imports): secret patterns (private keys, cloud, GitHub, Vercel, Anthropic, OpenAI and Slack-style tokens, `.env`-style assignments), files that must never be tracked (keys, `.env`, raw data, bundles, logs), email addresses other than the GitHub no-reply form, and internal machine paths outside `docs/QA_REPORTS/`.

## Result: no secrets. Six items for the owner to look at.

| # | Category | Where | Commits | First commit | What it is | Needs action? |
|---|---|---|---:|---|---|---|
| 1 | Secret pattern | none | 0 | — | No private key, access token, API key or credential-style assignment was found in any commit, added or removed. No `.env`, key, raw-data, bundle or log file was ever tracked. | No |
| 2 | Commit author email is not the no-reply form | commit metadata | 6 | `31622f6003` | Five are Dependabot's own no-reply address (`…[bot]@users.noreply.github.com`, public and not personal). **One, `874a686`, has the owner's personal Gmail address as author** (committer is the no-reply address). Already noted in STATUS since Stage 5 session 1. | **Owner decision** |
| 3 | Email address in file content | `docs/DATA_PROVENANCE.md` | 2 | `c8f2836871` | Two Microsoft contact addresses copied from the source repository's licence/conduct text, in earlier versions of the file. Public, not personal. | Owner may accept |
| 4 | Internal path outside `docs/QA_REPORTS` | `scripts/screenshots.mjs` | 3 | `1b3c10d363` | The builder's home folder path, in earlier versions of the script. Removed since. | Owner may accept |
| 5 | Internal path outside `docs/QA_REPORTS` | `docs/DEPLOY.md`, `docs/wireframes/render.mjs`, `STATUS.md` | 3, 2, 2 | `642f341302`, `642f341302`, `3a0bb3b1e5` | The builder's home folder, a log folder name (`predictiq-logs`) and the **name of a different, private project that lives in a sibling folder** (appears twice across these files' history). Removed from HEAD by the "no internal paths" commits; still readable in older commits. | Owner may accept |

HEAD itself is clean on all of these: the release-hygiene test (`scripts/tests/test_release_hygiene.py`) passes on the working tree.

## What this means for going public
Making the repository public publishes **all** history, including removed lines. Items 3 to 5 are low-risk (public Microsoft addresses; a generic home path; the name of another project, with no content). Item 2 is the only one that exposes a personal address, and it is the owner's own address in a commit that is already pushed to a private repository.

## Not done, on purpose
**History was not rewritten and nothing was changed.** Options for the owner, if wanted before launch:
- Accept all six and go public as is (nothing here is a credential).
- For item 2 (and optionally 4 and 5): a history rewrite (for example `git filter-repo` with a mailmap) changes every later commit id and would need a force-push, closing and re-opening open pull requests, and a fresh clone everywhere. That is the owner's call and is not part of this preparation.
- Keep the repository private (decision 57 needs it public for the release download; an alternative would be a different way of delivering the bundle).

Re-run before the go-public step in `docs/LAUNCH_CHECKLIST.md` (step 1); the scan takes under a minute.
