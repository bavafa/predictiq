"""Vercel adapter: exposes the FastAPI data service as an ordinary Vercel Python function.

Vercel looks for an ASGI object named `app` in `api/index.py`. The service code lives in
`backend/` (repository root, the single source of truth). vercel.json `includeFiles` copies
`backend/app/**` into the function bundle as `backend/app/...` next to the `api/` folder, and
`excludeFiles` keeps the Next.js `app/` folder out so the name `app` is unambiguous.
vercel.json rewrites /api/v1/* to this function. See docs/DEPLOY.md.
"""

import sys
from pathlib import Path

# Bundle layout first. In a git checkout (marked by pyproject.toml at the repo root, which is
# never in the bundle) use the real backend/. Never trust a `backend` elsewhere on disk.
_frontend = Path(__file__).resolve().parent.parent
_backend = _frontend / "_backend"
if not (_backend / "app" / "main.py").is_file() and (_frontend.parent / "pyproject.toml").is_file():
    _backend = _frontend.parent / "backend"
if not (_backend / "app" / "main.py").is_file():
    raise ImportError("_backend/app missing: check the prebuild copy and includeFiles in vercel.json")
sys.path.insert(0, str(_backend))

from app.main import app  # noqa: E402

__all__ = ["app"]
