import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.webhook import Webhook
from app.api.deps import get_current_user
from app.schemas.webhook import (
    WebhookCreate,
    WebhookUpdate,
    WebhookResponse,
    WebhookCreatedResponse,
    WebhookListResponse,
    SupportedEventsResponse,
    SUPPORTED_EVENTS,
)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ── Helper ─────────────────────────────────────────────────────────────────────

def _to_response(hook: Webhook) -> WebhookResponse:
    return WebhookResponse(
        id=hook.id,
        org_id=hook.org_id,
        url=hook.url,
        events=hook.events or [],
        is_active=hook.is_active,
        description=hook.description,
        last_triggered_at=hook.last_triggered_at,
        failure_count=hook.failure_count,
        created_at=hook.created_at,
    )


# ── Endpointi ──────────────────────────────────────────────────────────────────

@router.get("/events", response_model=SupportedEventsResponse)
async def list_supported_events(
    current_user: User = Depends(get_current_user),
):
    """Vraća listu podržanih webhook eventa."""
    return SupportedEventsResponse(events=sorted(SUPPORTED_EVENTS))


@router.get("", response_model=WebhookListResponse)
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Vraća sve webhook registracije za korisnikovu organizaciju."""
    q = await db.execute(
        select(Webhook)
        .where(Webhook.org_id == current_user.org_id)
        .order_by(Webhook.created_at.desc())
    )
    hooks = q.scalars().all()
    return WebhookListResponse(items=[_to_response(h) for h in hooks], total=len(hooks))


@router.post("", response_model=WebhookCreatedResponse, status_code=201)
async def create_webhook(
    body: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kreira novi webhook endpoint za organizaciju.
    Secret se vraća SAMO jednom u ovom responsu — sačuvajte ga.
    """
    # Ograniči na 20 webhook-a po org
    q = await db.execute(
        select(Webhook).where(Webhook.org_id == current_user.org_id)
    )
    existing = q.scalars().all()
    if len(existing) >= 20:
        raise HTTPException(status_code=400, detail="Maksimalan broj webhook-a (20) dostignut")

    secret = secrets.token_hex(32)  # 64-char hex string
    hook = Webhook(
        org_id=current_user.org_id,
        url=body.url,
        secret=secret,
        events=body.events,
        description=body.description,
    )
    db.add(hook)
    await db.commit()
    await db.refresh(hook)

    return WebhookCreatedResponse(
        id=hook.id,
        org_id=hook.org_id,
        url=hook.url,
        events=hook.events or [],
        is_active=hook.is_active,
        description=hook.description,
        last_triggered_at=hook.last_triggered_at,
        failure_count=hook.failure_count,
        created_at=hook.created_at,
        secret=secret,
    )


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    hook = await _get_hook_or_403(webhook_id, current_user, db)
    return _to_response(hook)


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    body: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ažurira URL, events, is_active ili opis webhook-a."""
    hook = await _get_hook_or_403(webhook_id, current_user, db)

    if body.url is not None:
        hook.url = body.url
    if body.events is not None:
        hook.events = body.events
    if body.is_active is not None:
        hook.is_active = body.is_active
        if body.is_active:
            hook.failure_count = 0  # resetuj brojač grešaka pri reaktivaciji
    if body.description is not None:
        hook.description = body.description

    await db.commit()
    await db.refresh(hook)
    return _to_response(hook)


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Briše webhook registraciju."""
    hook = await _get_hook_or_403(webhook_id, current_user, db)
    await db.delete(hook)
    await db.commit()


@router.post("/{webhook_id}/test", response_model=dict)
async def test_webhook(
    webhook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Šalje test payload na registrovani URL.
    Koristi se za provjeru da li je endpoint ispravno konfigurisan.
    """
    hook = await _get_hook_or_403(webhook_id, current_user, db)

    from app.modules.webhooks.dispatcher import deliver
    import asyncio

    test_data = {
        "webhook_id": str(hook.id),
        "test": True,
        "message": "Ovo je test notifikacija od Bilansia webhook sistema.",
    }

    # Pokrenemo sync deliver u thread pool da ne blokiramo event loop
    loop = asyncio.get_event_loop()
    success, status_code, error_msg = await loop.run_in_executor(
        None,
        lambda: deliver(
            url=hook.url,
            secret=hook.secret,
            event="webhook.test",
            data=test_data,
        )
    )

    return {
        "success": success,
        "status_code": status_code,
        "error": error_msg or None,
        "url": hook.url,
    }


async def _get_hook_or_403(webhook_id: UUID, user: User, db: AsyncSession) -> Webhook:
    q = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    hook = q.scalar_one_or_none()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if hook.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return hook
