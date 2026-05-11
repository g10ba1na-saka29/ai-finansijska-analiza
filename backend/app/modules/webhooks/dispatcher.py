"""
Webhook dispatcher — potpisuje i isporučuje event payloade.

Potpisivanje:
  Signature = HMAC-SHA256(secret, raw_body_bytes)
  Header: X-Bilansia-Signature: sha256=<hex_digest>
  Header: X-Bilansia-Event: <event_name>
  Header: X-Bilansia-Delivery: <uuid>

Primatelji mogu verificirati autentičnost ovako (Python):
    import hmac, hashlib
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert hmac.compare_digest(expected, received_signature.removeprefix("sha256="))
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Timeout za HTTP isporuku
DELIVERY_TIMEOUT = 10.0  # sekundi


def sign_payload(secret: str, body_bytes: bytes) -> str:
    """
    Vraća HMAC-SHA256 potpis u formatu 'sha256=<hex_digest>'.
    """
    digest = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def build_payload(event: str, data: dict[str, Any]) -> dict[str, Any]:
    """
    Gradi standardni payload koji se šalje primatelju.
    """
    return {
        "event": event,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


def deliver(
    url: str,
    secret: str,
    event: str,
    data: dict[str, Any],
) -> tuple[bool, int | None, str]:
    """
    Šalje webhook HTTP POST sinhrono (za Celery task kontekst).

    Vraća (success: bool, http_status: int | None, error_message: str).
    """
    delivery_id = str(uuid.uuid4())
    payload = build_payload(event, data)
    body_bytes = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    signature = sign_payload(secret, body_bytes)

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "X-Bilansia-Signature": signature,
        "X-Bilansia-Event": event,
        "X-Bilansia-Delivery": delivery_id,
        "User-Agent": "Bilansia-Webhook/1.0",
    }

    try:
        with httpx.Client(timeout=DELIVERY_TIMEOUT) as client:
            resp = client.post(url, content=body_bytes, headers=headers)
        success = 200 <= resp.status_code < 300
        if not success:
            logger.warning(
                f"Webhook isporuka neuspješna: url={url}, event={event}, "
                f"status={resp.status_code}, delivery={delivery_id}"
            )
        else:
            logger.info(
                f"Webhook isporučen: url={url}, event={event}, "
                f"status={resp.status_code}, delivery={delivery_id}"
            )
        return success, resp.status_code, "" if success else f"HTTP {resp.status_code}"
    except httpx.TimeoutException:
        msg = f"Timeout ({DELIVERY_TIMEOUT}s)"
        logger.warning(f"Webhook timeout: url={url}, event={event}")
        return False, None, msg
    except Exception as e:
        msg = str(e)
        logger.warning(f"Webhook greška: url={url}, event={event}, err={msg}")
        return False, None, msg
