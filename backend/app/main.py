import logging

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.core.logging_config import setup_logging
from app.core.middleware import RequestLoggingMiddleware
from app.api.routes import auth, companies, reports, analytics, ai_reports, benchmarks, forecasting, webhooks, risk_analysis

# ── Logging ────────────────────────────────────────────────────────────────────
setup_logging(level=settings.LOG_LEVEL, json_output=settings.LOG_JSON)
logger = logging.getLogger("bilansia.startup")

# ── Sentry ─────────────────────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment="production" if not settings.DEBUG else "development",
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            CeleryIntegration(),
        ],
        traces_sample_rate=0.2,    # 20% tracing sample rate
        profiles_sample_rate=0.05, # 5% profiling
        send_default_pii=False,    # Ne šalji PII podatke
    )
    logger.info("Sentry inicijaliziran")

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
    storage_uri=settings.REDIS_URL,
)

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Attach limiter state (needed by slowapi)
app.state.limiter = limiter

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SlowAPIMiddleware)

# ── Exception handlers ─────────────────────────────────────────────────────────
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all za neočekivane greške — loguj i vrati 500."""
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Interna greška servera. Pokušajte ponovo."},
    )


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix=settings.API_V1_PREFIX)
app.include_router(companies.router,   prefix=settings.API_V1_PREFIX)
app.include_router(reports.router,     prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router,   prefix=settings.API_V1_PREFIX)
app.include_router(ai_reports.router,  prefix=settings.API_V1_PREFIX)
app.include_router(benchmarks.router,  prefix=settings.API_V1_PREFIX)
app.include_router(forecasting.router, prefix=settings.API_V1_PREFIX)
app.include_router(webhooks.router,      prefix=settings.API_V1_PREFIX)
app.include_router(risk_analysis.router, prefix=settings.API_V1_PREFIX)


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ── Startup log ────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    logger.info(
        f"Bilansia API pokrenut — "
        f"debug={settings.DEBUG}, "
        f"rate_limit={settings.RATE_LIMIT_PER_MINUTE}/min, "
        f"sentry={'on' if settings.SENTRY_DSN else 'off'}"
    )
