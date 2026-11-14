# ruff: noqa: E501  (long regular expressions and quoted messages are easier to read on one line)
"""Release hygiene: nothing secret, personal or private is tracked by git.

Story "Public release and limitations": "No secrets, personal information or private notes remain."
This scans every git-tracked file (`git ls-files`), so it checks what a public clone would contain.
It runs in the normal pytest run (and so in CI). It never reads untracked files.

What it checks
  1. Files that must never be tracked: .agent/, .vercel/, data/raw/, .env files, serving bundles, zip files, key files,
     build output and dependency folders.
  2. Secret patterns in file contents: Vercel, GitHub, AWS, Anthropic, Slack and Google keys, private keys,
     `x-vercel-protection-bypass` values, bearer tokens, and secret-looking `KEY=value` lines.
  3. Email addresses: only the GitHub no-reply address form and documentation placeholders are allowed.
  4. Internal paths (/workspace/..., /home/..., /Users/..., predictiq-logs): see the allowlist below.
  5. The author and committer emails of the commits in this clone (history): a known finding, see the last test.

ALLOWLIST (one place, on purpose; every entry says why)
  * INTERNAL_PATH_ALLOWED_PREFIXES: internal paths may appear only under docs/QA_REPORTS/. Those files are the dated
    review and test records; they quote the builder's own paths as history (for example links in a review, or a log).
    A path in a README, a script, a workflow, the app or any other doc would tell a reader to depend on a machine they
    do not have, so it is not allowed there.
  * SELF_PATHS: this file and the helper docs that must name the patterns they search for.
  * EMAIL_ALLOWED: the GitHub no-reply form NNN+name@users.noreply.github.com, noreply@github.com, and
    example.com / example.org / example.net / .invalid addresses used in documentation.
Anything else is reported, not allowed. To allow something new, add it here with a reason, in a reviewed change.
"""

from __future__ import annotations

import fnmatch
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
GIT = shutil.which("git") or "git"

# --- the allowlist ---------------------------------------------------------------------------------------------------
INTERNAL_PATH_ALLOWED_PREFIXES = ("docs/QA_REPORTS/",)
SELF_PATHS = {"scripts/tests/test_release_hygiene.py"}
EMAIL_ALLOWED = [
    re.compile(r"^[0-9]+\+[A-Za-z0-9-]+@users\.noreply\.github\.com$"),
    re.compile(r"^noreply@github\.com$"),
    re.compile(r"@example\.(com|org|net)$"),
    re.compile(r"@[A-Za-z0-9.-]+\.invalid$"),
]

# --- 1. files that must never be tracked ---------------------------------------------------------------------------------
FORBIDDEN_PATHS = [
    ".agent/*",
    ".vercel/*",
    "*/.vercel/*",
    "data/raw/*",
    ".env",
    ".env.*",
    "*/.env",
    "*/.env.*",
    "artifacts/*/bundle/*",
    "artifacts/*/bundle.zip",
    "artifacts/*/test_scores.npz",
    "*.zip",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "id_rsa*",
    "id_ed25519*",
    "frontend/_backend/*",
    "frontend/.e2e/*",
    "frontend/.next/*",
    "frontend/test-results/*",
    "frontend/playwright-report/*",
    "*/node_modules/*",
    "node_modules/*",
    ".venv/*",
    "*/__pycache__/*",
]
FORBIDDEN_EXCEPTIONS = {".env.example"}

# --- 2. secrets -----------------------------------------------------------------------------------------------------------
SECRET_PATTERNS = {
    "GitHub token": re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b"),
    "AWS access key id": re.compile(r"\b(AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16}\b"),
    "AWS secret key": re.compile(r"(?i)aws_secret_access_key['\"]?\s*[:=]\s*['\"]?[A-Za-z0-9/+=]{40}"),
    "private key block": re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY"),
    "Vercel token": re.compile(r"\b(vc[a-z]_[A-Za-z0-9]{20,}|vercel_blob_rw_[A-Za-z0-9_]{10,})\b"),
    "Vercel token assignment": re.compile(
        r"(?i)\bVERCEL_(?:TOKEN|ORG_ID|PROJECT_ID)\b['\"]?\s*[:=]\s*['\"]?[A-Za-z0-9_]{16,}"
    ),
    "Vercel protection bypass value": re.compile(
        r"(?i)x-vercel-(?:protection-bypass|set-bypass-cookie)['\"]?\s*[:=]\s*['\"]?[A-Za-z0-9]{16,}"
        r"|[?&]x-vercel-protection-bypass=[A-Za-z0-9]{8,}"
    ),
    "Anthropic key": re.compile(r"\bsk-ant-[A-Za-z0-9_-]{16,}"),
    "OpenAI-style key": re.compile(r"\bsk-[A-Za-z0-9]{32,}\b"),
    "Slack token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "bearer token": re.compile(r"(?i)\bbearer\s+(?!token\b|<|\$|\{|xxx|your)[A-Za-z0-9._~+/-]{24,}=*"),
    "secret-looking assignment": re.compile(
        r"(?im)^\s*(?:export\s+)?[A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|ACCESS_TOKEN|AUTH_TOKEN)[A-Z0-9_]*\s*=\s*['\"]?"
        # a real secret value mixes letters and digits; plain words such as "secret-value" (a test marker) do not match
        r"(?![<$\{]|your|changeme|example|xxx|\.\.\.)(?=[A-Za-z0-9/+_=.-]*[0-9])(?=[A-Za-z0-9/+_=.-]*[A-Za-z])[A-Za-z0-9/+_=.-]{16,}"
    ),
}

# --- 3 and 4 --------------------------------------------------------------------------------------------------------------
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
INTERNAL_PATHS = re.compile(
    r"/workspace/|/home/[A-Za-z0-9_.-]+|/Users/[A-Za-z0-9_.-]+|[A-Za-z]:\\Users\\|predictiq-logs"
)
BINARY_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".webp",
    ".woff",
    ".woff2",
    ".ttf",
    ".pdf",
    ".gz",
    ".parquet",
    ".npz",
}


def tracked() -> list[str]:
    out = subprocess.run([GIT, "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True).stdout  # noqa: S603
    return [p for p in out.decode().split("\0") if p and (ROOT / p).is_file()]


def text_of(path: str) -> str | None:
    if Path(path).suffix.lower() in BINARY_SUFFIXES:
        return None
    data = (ROOT / path).read_bytes()
    if b"\0" in data:
        return None
    return data.decode("utf-8", errors="replace")


FILES = tracked()


def test_there_are_tracked_files_to_scan() -> None:
    assert len(FILES) > 50, "git ls-files returned almost nothing: run this from a git checkout"


def test_files_that_must_never_be_tracked() -> None:
    bad = [
        p
        for p in FILES
        if p not in FORBIDDEN_EXCEPTIONS
        and any(fnmatch.fnmatchcase(p, pattern) for pattern in FORBIDDEN_PATHS)
    ]
    assert bad == [], "tracked files that must never be in the repository:\n" + "\n".join(bad)


def test_no_secrets_in_tracked_files() -> None:
    found: list[str] = []
    for path in FILES:
        if path in SELF_PATHS:
            continue
        text = text_of(path)
        if text is None:
            continue
        for label, pattern in SECRET_PATTERNS.items():
            for m in pattern.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                found.append(f"{path}:{line}: {label}")  # the matched text is deliberately not printed
    assert found == [], "possible secrets (matched text hidden):\n" + "\n".join(found)


def test_no_personal_email_addresses_in_tracked_files() -> None:
    found: list[str] = []
    for path in FILES:
        text = text_of(path)
        if text is None:
            continue
        for m in EMAIL.finditer(text):
            address = m.group(0)
            if path in SELF_PATHS or any(rule.search(address) for rule in EMAIL_ALLOWED):
                continue
            # npm and Python lock files name packages like "name@1.2.3": those are versions, not addresses
            if re.search(r"@[0-9]+(\.[0-9]+)*$", address):
                continue
            line = text.count("\n", 0, m.start()) + 1
            found.append(f"{path}:{line}: {address}")
    assert found == [], "email addresses that are not the GitHub no-reply form:\n" + "\n".join(found)


def test_internal_paths_only_in_historical_qa_reports() -> None:
    found: list[str] = []
    for path in FILES:
        if path in SELF_PATHS or path.startswith(INTERNAL_PATH_ALLOWED_PREFIXES):
            continue
        text = text_of(path)
        if text is None:
            continue
        for m in INTERNAL_PATHS.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            found.append(f"{path}:{line}: {m.group(0)}")
    assert found == [], "internal paths outside docs/QA_REPORTS (a reader cannot use them):\n" + "\n".join(
        found
    )


def test_qa_reports_never_tell_the_reader_to_use_the_log_folder() -> None:
    """Inside docs/QA_REPORTS an internal path is history. It must not be written as something to run or install."""
    found: list[str] = []
    instruction = re.compile(
        r"(?i)(?:run|cd|source|export|set|copy|cp|mv|cat|install|put it in|save (?:it )?to)\b[^\n]{0,40}predictiq-logs"
    )
    for path in FILES:
        if not path.startswith("docs/QA_REPORTS/"):
            continue
        text = text_of(path)
        if text is None:
            continue
        for m in instruction.finditer(text):
            found.append(f"{path}:{text.count(chr(10), 0, m.start()) + 1}: {m.group(0)[:80]}")
    assert found == [], "QA reports present the private log folder as required:\n" + "\n".join(found)


def test_the_scanner_catches_what_it_should() -> None:
    """The patterns above are only worth something if they match. Fake values built here, never stored whole."""
    fakes = {
        "GitHub token": "gh" + "p_" + "a" * 36,
        "AWS access key id": "AK" + "IA" + "A" * 16,
        "private key block": "-----BEGIN " + "RSA PRIVATE KEY-----",
        "Vercel token": "vc" + "p_" + "b" * 24,
        "Vercel protection bypass value": "x-vercel-protection-" + "bypass: " + "c" * 32,
        "Anthropic key": "sk-" + "ant-" + "d" * 20,
        "bearer token": "Authorization: Bearer " + "e" * 40,
        "secret-looking assignment": "MY_API_KEY=" + "f3" * 10,
    }
    for label, fake in fakes.items():
        assert SECRET_PATTERNS[label].search(fake), f"pattern for {label} does not match a fake example"
    assert not SECRET_PATTERNS["Vercel protection bypass value"].search(
        "the x-vercel-protection-bypass header"
    )
    assert not SECRET_PATTERNS["secret-looking assignment"].search("API_KEY=<your key>")
    assert any(fnmatch.fnmatchcase(".agent/ETA", p) for p in FORBIDDEN_PATHS)
    assert any(fnmatch.fnmatchcase("artifacts/piq-1/bundle/meta.json", p) for p in FORBIDDEN_PATHS)


# --- 5. history -------------------------------------------------------------------------------------------------------------
@pytest.mark.xfail(
    strict=False,
    reason=(
        "owner decision before going public (see docs/LAUNCH_CHECKLIST.md): one early commit in the history has a personal "
        "address as its AUTHOR (the committer is the no-reply address). Files are clean. Removing it needs a history "
        "rewrite, which this test suite does not do. The test passes (XPASS) in a shallow clone that does not contain it."
    ),
)
def test_commit_author_and_committer_emails_are_noreply() -> None:
    log = subprocess.run(  # noqa: S603
        [GIT, "log", "--format=%H %ae %ce"], cwd=ROOT, check=True, capture_output=True, text=True
    )
    out = log.stdout.splitlines()
    bad = []
    for row in out:
        sha, *emails = row.split()
        for e in emails:
            if not any(rule.search(e) for rule in EMAIL_ALLOWED):
                bad.append(f"{sha[:10]} {e}")
    assert bad == [], "commits with a non-no-reply email:\n" + "\n".join(bad)
