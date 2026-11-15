# Component planner step 1: review (15 Nov 2026)

**Reviewer:** a Claude subagent (Opus), read-only. This is **not** the independent Codex review that CLAUDE.md requires: the `codex` command is not installed on this Mac, so that review has not happened. All data is simulated.

**Scope:** `ml/component_labels.py` and `ml/tests/test_component_labels.py` (PR #11, merged into `component-planner-spec`).

**Result:** no High findings. Labels, censoring, leakage rules, the purge, unseen machines and row alignment were correct on reading and on a brute-force check of 3,000 random real day-14 rows (0 mismatches in label, past failures, days since replacement).

| # | Level | Finding | Status |
|---|---|---|---|
| 1 | Medium | Purge boundary untested (`>=` vs `>` would pass) | Fixed: exact-boundary test for all three levels |
| 2 | Medium | The 48-hour frame was never built in a test | Fixed: frame test runs for day7, day14 and hour48 |
| 3 | Medium | Unseen-machine test could pass with no unseen rows | Fixed: asserts unseen rows exist in test and machine 2 is absent from train and validation |
| 4 | Medium | Real-data test checked no counts; NaN assertion misleading | Fixed: pins positives and rows per level and split; NaN only forbidden for model, age, past failures |
| 5 | Low | 18 failures stamped 2015-01-02 03:00 have no replacement record, so days since replacement keeps counting from an older replacement | **Open: owner decision** (count a failure as a replacement, or document the input as replacement-only) |
| 6 | Low | Duplicate or empty machine lists | Fixed: duplicates removed, empty list returns an empty frame |
| 7 | Low | Docstring overstated row-order guarantee | Fixed: says to join by key |

**Checks after the fixes (local):** ruff, ruff format, mypy clean; pytest 368 passed, 1 skipped, 19 opt-in deselected; opt-in real-data tests 3 passed. I did not re-run the subagent review on the fixes.
