"""
FastAPI middleware za request logging i timing.
"""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("bilansia.http")

# Endpointi koje ne logujemo (health checks, metrike)
_SKIP_PATHS = frozenset({"/health", "/docs", "/redoc", "/openapi.json"})


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Loguje svaki HTTP request sa:
    - request_id (UUID, vraćen u X-Request-ID headeru)
    - metoda, path, status, trajanje
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()

        # Dodaj request_id u scope da ga rute mogu koristiti
        request.state.request_id = request_id

        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(
                "Unhandled exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                },
                exc_info=exc,
            )
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        status = response.status_code
        level = logging.WARNING if status >= 400 else logging.INFO

        logger.log(
            level,
            f"{request.method} {request.url.path} → {status} ({duration_ms:.1f}ms)",
            extra={"request_id": request_id},
        )

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
        return response
