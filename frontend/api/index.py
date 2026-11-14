"""Vercel adapter: exposes the FastAPI data service as an ordinary Vercel Python function.

Vercel looks for an ASGI object named `app` in `api/index.py`. The service code lives in
`backend/` (repository root); this file only makes it importable and re-exports `app`.
vercel.json rewrites /api/v1/* to this function. See docs/DEPLOY.md.
"""

import sys
from pathlib import Path

_here = Path(__file__).resolve().parent
# Candidates: a vendored copy next to this file (fallback layout), then the repo's backend/.
for candidate in (_here / "_backend", _here.parents[1] / "backend"):
    if (candidate / "app" / "main.py").is_file():
        sys.path.insert(0, str(candidate))
        break

from app.main import app  # noqa: E402

__all__ = ["app"]
