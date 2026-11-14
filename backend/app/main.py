"""PredictIQ data service (FastAPI). Read-only; serves precomputed scores from the bundle, if present."""

import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import config
from app.api.routes import router
from app.problems import ProblemError
from app.schemas import Problem

logger = logging.getLogger("predictiq")

PROBLEM_JSON = "application/problem+json"


def _problem(status: int, title: str, detail: str | None = None) -> JSONResponse:
    body = Problem(title=title, status=status, detail=detail).model_dump(exclude_none=True)
    return JSONResponse(
        body,
        status_code=status,
        media_type=PROBLEM_JSON,
        headers={"Cache-Control": config.CACHE_NO_STORE},
    )


async def _problem_error(_: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, ProblemError):
        return _problem(exc.status, exc.title, exc.detail)
    return _problem(500, "Internal error")


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    status = exc.status_code if isinstance(exc, StarletteHTTPException) else 500
    return _problem(status, "Not found" if status == 404 else "Request failed")


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    # Report where the problem is, never the submitted value.
    errors = exc.errors() if isinstance(exc, RequestValidationError) else []
    locs = ", ".join(".".join(str(p) for p in e["loc"]) for e in errors)
    return _problem(422, "Invalid request", f"Invalid input: {locs}")


async def _unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled error", exc_info=exc)
    return _problem(500, "Internal error")


def create_app() -> FastAPI:
    app = FastAPI(
        title=config.APP_NAME,
        version=config.APP_VERSION,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.include_router(router, prefix=config.API_PREFIX)
    app.add_exception_handler(ProblemError, _problem_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(Exception, _unexpected_error)

    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Anything that did not set its own caching rule must not be cached.
        response.headers.setdefault("Cache-Control", config.CACHE_NO_STORE)
        return response

    return app


app = create_app()
