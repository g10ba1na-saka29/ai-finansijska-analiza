"""
Strukturirani JSON logging za Bilansia backend.

Svaki log red je valid JSON objekt koji sadrži:
  timestamp, level, logger, message, + kontekstualna polja

Koristi se standardni Python logging modul, ali sa JSON formatterom.
Ovo je kompatibilno sa svim log agregatorima (Datadog, CloudWatch, Loki, itd.)
"""

import json
import logging
import sys
import traceback
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Formatira log zapise kao JSON strings."""

    def format(self, record: logging.LogRecord) -> str:
        log_object: dict = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level":     record.levelname,
            "logger":    record.name,
            "message":   record.getMessage(),
        }

        # Dodaj modul/liniju za DEBUG i ERROR
        if record.levelno in (logging.DEBUG, logging.ERROR, logging.CRITICAL):
            log_object["module"]   = record.module
            log_object["funcName"] = record.funcName
            log_object["lineno"]   = record.lineno

        # Dodaj exception info ako postoji
        if record.exc_info:
            log_object["exception"] = "".join(traceback.format_exception(*record.exc_info))

        # Dodaj extra fields
        for key in ("request_id", "user_id", "company_id", "task_id"):
            val = getattr(record, key, None)
            if val is not None:
                log_object[key] = val

        try:
            return json.dumps(log_object, ensure_ascii=False)
        except Exception:
            return json.dumps({"message": str(record.getMessage()), "level": record.levelname})


def setup_logging(level: str = "INFO", json_output: bool = True) -> None:
    """
    Konfiguriše root logger i ključne aplikacijske loggere.

    Args:
        level:       Log nivo (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_output: Ako True, koristi JSON formatter; inače human-readable
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Ukloni postojeće handlere
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if json_output:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s — %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        ))

    root.addHandler(handler)

    # Priguši previše bučne loggere
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("celery").setLevel(logging.INFO)
