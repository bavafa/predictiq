# Working on PredictIQ (read before you start)

These rules apply to every Claude Code session in this repository.

## Start of every session
1. Read `STATUS.md`, `TASKS.md`, `DECISIONS.md` and `docs/LAUNCH_CHECKLIST.md`. They are the record of where the project is and what has been decided.
2. Work only on the current stage (BMAD stage gates). Do nothing that belongs to a later stage until Meysam (the owner) has approved the current gate in writing.
3. Before starting a task, write `ETA_MINUTES=N` to `.agent/ETA` (git-ignored).

## Models and review
- Normal coding: Claude Sonnet at medium effort.
- Opus at medium effort only for architecture or genuinely complex parts. Log the reason in `DECISIONS.md` before using it.
- Independent review is done by Codex: `codex exec -m gpt-6-sol -c model_reasoning_effort=medium -s read-only`. Fix every High and Medium finding, re-check it, and save the review in `docs/QA_REPORTS/`.

## Git and GitHub
- Branch from the updated `main`; use stacked pull requests. Only Meysam merges.
- **Never push to `main`. Never force-push.** Do not rewrite history.
- Commit as `bavafa <52782802+bavafa@users.noreply.github.com>`, with no co-author trailer.
- At the end of every session: update `STATUS.md` (and `TASKS.md`), commit, and push the branch.

## Secrets, hosting and launch
- No secrets, tokens or bypass values in the repository, logs, pull requests or chat. `scripts/tests/test_release_hygiene.py` checks the tracked files.
- The repository stays **private** and Vercel deployment protection stays **on** until Meysam gives the launch go-ahead (`docs/LAUNCH_CHECKLIST.md`). Do not add domains, promote to production, or spend money.
- Never use the `VERCEL_TOKEN` environment variable. Run every Vercel command as `env -u VERCEL_TOKEN vercel ...`.
- Do not touch any other Vercel project or repository on the same accounts (only PredictIQ).
- Never set `ANTHROPIC_API_KEY` and never accept credit top-ups.
- If something only Meysam can do comes up (sign-in, 2FA, payment, licence or scope decision), stop and ask him.

## Writing
- Write human-facing docs in plain English. Label every number as simulated, illustrative or an estimate. No evidence means not met. Never claim a test or run that did not happen. Give times in America/Toronto.

## Gate report format (copy exactly)
`GATE Mx: PASS or FAIL / Criteria: one line each, met or not met, with evidence / Open must-fix / Honesty issues / Next: first 3 tasks`

Also include: the pull request link, screenshot paths, risks, decisions for Meysam, and the key measured values.
