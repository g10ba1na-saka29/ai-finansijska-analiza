"""
Redis cache layer za Bilansia backend.

Async klijent (za FastAPI rute):
    from app.core.cache import cache
    data = await cache.get_json("key")
    await cache.set_json("key", data, ttl=3600)
    await cache.delete("key")

Sync helper (za Celery taskove):
    from app.core.cache import invalidate_company_sync
    invalidate_company_sync(company_id, fiscal_year)

Cache ključevi:
    kpi:{company_id}:{fiscal_year}          — KPI snapshot
    score:{company_id}:{fiscal_year}        — CompanyScore
    score_history:{company_id}              — score historija
    kpi_trend:{company_id}                  — KPI trend
    benchmark:{company_id}:{fiscal_year}    — benchmark poređenje
    forecast:{company_id}                   — ML prognoza

TTL: 1 sat (3600s) za sve KPI/score keš unose.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis
import redis as syncredis

from app.config import settings

logger = logging.getLogger(__name__)

# ── TTL konstante ─────────────────────────────────────────────────────────────

KPI_TTL      = 3_600   # 1 sat
SCORE_TTL    = 3_600
BENCHMARK_TTL = 3_600
FORECAST_TTL  = 7_200  # 2 sata (rjeđe se mijenja)


# ── Cache ključevi ─────────────────────────────────────────────────────────────

def kpi_key(company_id: str, fiscal_year: int) -> str:
    return f"kpi:{company_id}:{fiscal_year}"


def score_key(company_id: str, fiscal_year: int) -> str:
    return f"score:{company_id}:{fiscal_year}"


def score_history_key(company_id: str) -> str:
    return f"score_history:{company_id}"


def kpi_trend_key(company_id: str) -> str:
    return f"kpi_trend:{company_id}"


def benchmark_key(company_id: str, fiscal_year: int) -> str:
    return f"benchmark:{company_id}:{fiscal_year}"


def forecast_key(company_id: str) -> str:
    return f"forecast:{company_id}"


def anomaly_key(company_id: str, fiscal_year: int) -> str:
    return f"anomaly:{company_id}:{fiscal_year}"


def risk_key(company_id: str, fiscal_year: int) -> str:
    return f"risk:{company_id}:{fiscal_year}"


RISK_TTL = 3_600


# ── Async cache klijent ────────────────────────────────────────────────────────

class AsyncCacheClient:
    """
    Thin wrapper oko redis.asyncio.Redis sa JSON serijalizacijom.
    Lazy inicijalizacija — ne otvara konekciju dok se ne koristi.
    """

    def __init__(self, url: str) -> None:
        self._url = url
        self._client: Optional[aioredis.Redis] = None

    def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(
                self._url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        return self._client

    async def get_json(self, key: str) -> Optional[Any]:
        """Vraća deserijalizovani objekt ili None ako ključ ne postoji / greška."""
        try:
            raw = await self._get_client().get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as e:
            logger.warning(f"Cache GET failed ({key}): {e}")
            return None

    async def set_json(self, key: str, value: Any, ttl: int = KPI_TTL) -> None:
        """Serijalizuje vrijednost kao JSON i upiše u Redis sa TTL."""
        try:
            await self._get_client().set(key, json.dumps(value, default=str), ex=ttl)
        except Exception as e:
            logger.warning(f"Cache SET failed ({key}): {e}")

    async def delete(self, *keys: str) -> None:
        """Briše jedan ili više ključeva."""
        if not keys:
            return
        try:
            await self._get_client().delete(*keys)
        except Exception as e:
            logger.warning(f"Cache DELETE failed {keys}: {e}")

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# ── Globalna instanca ─────────────────────────────────────────────────────────

cache = AsyncCacheClient(settings.REDIS_URL)


# ── Sync invalidacija za Celery taskove ───────────────────────────────────────

def invalidate_company_sync(company_id: str, fiscal_year: int) -> None:
    """
    Briše sve cache unose vezane za kompaniju i fiskalnu godinu.
    Poziva se iz Celery taska (sync context) nakon završene kalkulacije.
    """
    keys = [
        kpi_key(company_id, fiscal_year),
        score_key(company_id, fiscal_year),
        score_history_key(company_id),
        kpi_trend_key(company_id),
        benchmark_key(company_id, fiscal_year),
        forecast_key(company_id),
    ]
    try:
        client = syncredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        if keys:
            client.delete(*keys)
        client.close()
        logger.info(f"Cache invalidiran: company={company_id}, year={fiscal_year}")
    except Exception as e:
        logger.warning(f"Cache invalidacija failed: {e}")
