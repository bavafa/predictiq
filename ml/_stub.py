"""Shared skeleton stub: every ml entry point reports it is not built and exits non-zero."""

import sys


def not_implemented(name: str) -> int:
    print(f"{name}: not implemented in the skeleton story", file=sys.stderr)
    return 1


def run(name: str) -> None:
    sys.exit(not_implemented(name))
