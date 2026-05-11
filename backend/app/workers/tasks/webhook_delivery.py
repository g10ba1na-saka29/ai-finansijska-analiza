"""
Celery task za isporuku webhook notifikacija.

Poziva se iz ostalih taskova (kpi_calculation, pdf_processing, report_generation)
na kraju uspješne obrade:

    from app.workers.tasks.webhook_delivery import dispatch_webhook_event
    dispatch_webhook_event.delay("kpi.calculated", org_id_str, payload_dict)

Task:
  1. Dohvati sve aktivne webhooks za org_id koji su pretplaćeni na event
  2. Za svaki webhook: isporuči payload, ažuriraj last_triggered_at / failure_count
  3. Retry 3× sa eksponencijalnim backoff-om pri HTTP greški
"""

import logging
from datetime import datetime, timezone

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_db():
    from app.database import SyncSessionLocal
    return SyncSessionLocal()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def dispatch_webhook_event(
    self,
    event: str,
    org_id: str,
    payload: dict,
) -> dict:
    """
    Isporučuje webhook event svim aktivnim pretplatnicima organizacije.

    Args:
        event:   Naziv eventa (npr. "kpi.calculated")
        org_id:  UUID organizacije (string)
        payload: Dict sa podacima eventa
    """
    from app.models.webhook import Webhook
    from app.modules.webhooks.dispatcher import deliver

    db = _get_db()
    try:
        # Dohvati aktivne webhooks koji su pretplaćeni na ovaj event
        all_hooks = (
            db.query(Webhook)
            .filter_by(org_id=org_id, is_active=True)
            .all()
        )
        subscribed = [h for h in all_hooks if event in (h.events or [])]

        if not subscribed:
            return {"status": "no_subscribers", "event": event, "org_id": org_id}

        results = []
        for hook in subscribed:
            success, status_code, error_msg = deliver(
                url=hook.url,
                secret=hook.secret,
                event=event,
                data=payload,
            )

            hook.last_triggered_at = datetime.now(timezone.utc)
            if success:
                hook.failure_count = 0
            else:
                hook.failure_count = (hook.failure_count or 0) + 1
                # Deaktiviraj webhook nakon 10 uzastopnih grešaka
                if hook.failure_count >= 10:
                    hook.is_active = False
                    logger.warning(
                        f"Webhook deaktiviran zbog previše grešaka: "
                        f"id={hook.id}, url={hook.url}"
                    )

            results.append({
                "webhook_id": str(hook.id),
                "url": hook.url,
                "success": success,
                "status_code": status_code,
                "error": error_msg,
            })

        db.commit()

        logger.info(
            f"Webhook dispatch završen: event={event}, org={org_id}, "
            f"hooks={len(subscribed)}, "
            f"ok={sum(1 for r in results if r['success'])}"
        )
        return {
            "status": "done",
            "event": event,
            "org_id": org_id,
            "results": results,
        }

    except Exception as exc:
        db.rollback()
        logger.error(f"Webhook dispatch failed: {exc}", exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()
