"""Scan the WHOLE git history (every commit on every ref) for secrets and private material.

    uv run python -m scripts.history_scan [--out docs/QA_REPORTS/stage5-history-scan.md]

It reuses the patterns of the release-hygiene test (scripts/tests/test_release_hygiene.py: secret
patterns, forbidden paths, email rule, internal paths), so "what a public clone would contain" is
judged the same way for HEAD and for every older commit. It reads `git log -p --all` (added AND
removed lines of every commit, all branches, tags and remotes) and the author and committer emails
of every commit.

The report never prints a matched value: only the category, the file path, the number of commits,
and the first short commit id. Exit code 0 = nothing found; 1 = findings (the owner decides; this
script never rewrites history).
"""

from __future__ import annotations

import argparse
import fnmatch
import importlib.util
import re
import subprocess  # noqa: S404
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HYGIENE = ROOT / "scripts" / "tests" / "test_release_hygiene.py"


def load_rules() -> Any:
    """Import the hygiene test module for its pattern tables (it only runs `git ls-files` at import time)."""
    spec = importlib.util.spec_from_file_location("release_hygiene_rules", HYGIENE)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {HYGIENE}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["release_hygiene_rules"] = module
    spec.loader.exec_module(module)
    return module


def git(*args: str) -> str:
    return subprocess.run(  # noqa: S603
        ["git", *args],  # noqa: S607
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    ).stdout


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, help="write the Markdown summary here as well")
    args = ap.parse_args()
    rules = load_rules()

    commits = git("rev-list", "--all").split()
    refs = git("for-each-ref", "--format=%(refname)").split()
    print(f"commits on all refs: {len(commits)}; refs: {len(refs)}")

    # category -> (path or label) -> [short sha, ...]
    found: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))

    # 1. forbidden paths: any file name ever added in any commit
    names = git("log", "--all", "--no-renames", "--name-only", "--format=commit:%H").splitlines()
    sha = ""
    for line in names:
        if line.startswith("commit:"):
            sha = line[7:17]
        elif (
            line
            and line not in rules.FORBIDDEN_EXCEPTIONS
            and any(fnmatch.fnmatchcase(line, p) for p in rules.FORBIDDEN_PATHS)
        ):
            found["file that must never be tracked"][line].append(sha)

    # 2-4. added and removed lines of every commit
    patch = git("log", "-p", "--all", "--no-color", "--no-renames", "-U0", "--format=commit:%H")
    sha, path = "", ""
    for line in patch.splitlines():
        if line.startswith("commit:"):
            sha = line[7:17]
            continue
        if line.startswith("diff --git "):
            path = line.rsplit(" b/", 1)[-1]
            continue
        if not line or line[0] not in "+-" or line.startswith(("+++", "---")):
            continue
        if path in rules.SELF_PATHS or Path(path).suffix.lower() in rules.BINARY_SUFFIXES:
            continue
        text = line[1:]
        for label, pattern in rules.SECRET_PATTERNS.items():
            if pattern.search(text):
                found[f"secret pattern: {label}"][path].append(sha)
        for m in rules.EMAIL.finditer(text):
            address = m.group(0)
            if any(rule.search(address) for rule in rules.EMAIL_ALLOWED) or re.search(
                r"@[0-9]+(\.[0-9]+)*$", address
            ):
                continue
            found["email address in file content (not the no-reply form)"][path].append(sha)
        if rules.INTERNAL_PATHS.search(text) and not path.startswith(rules.INTERNAL_PATH_ALLOWED_PREFIXES):
            found["internal path outside docs/QA_REPORTS"][path].append(sha)

    # 5. author and committer emails
    for row in git("log", "--all", "--format=%H %ae %ce").splitlines():
        full, *emails = row.split()
        for kind, e in zip(("author", "committer"), emails, strict=True):
            if not any(rule.search(e) for rule in rules.EMAIL_ALLOWED):
                found[f"commit {kind} email is not the no-reply form"][f"(commit metadata, {kind})"].append(
                    full[:10]
                )

    # report (no values)
    lines = ["| Category | Where | Commits | First commit |", "|---|---|---:|---|"]
    total = 0
    for cat in sorted(found):
        for where in sorted(found[cat]):
            shas = sorted(set(found[cat][where]))
            total += 1
            lines.append(f"| {cat} | `{where}` | {len(shas)} | `{shas[0]}` |")
    table = "\n".join(lines) if total else "_Nothing found._"
    print(table)
    print(f"\nlines in the table: {total}")
    if args.out:
        args.out.write_text(
            f"<!-- history_scan: commits={len(commits)} refs={len(refs)} rows={total} -->\n{table}\n",
            encoding="utf-8",
        )
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
