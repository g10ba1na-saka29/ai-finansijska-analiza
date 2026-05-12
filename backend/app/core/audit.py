"""
Audit logging helper.

Usage:
    await audit(db, org_id=current_user.org_id, user_id=current_user.id,
                action="company.created", resource_type="company",
                resource_id=str(company.id), details={"name": company.name})
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

logger = logging.getLogger("bilansia.audit")


async def audit(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """
    Add an audit log entry within the current DB transaction.
    Errors are swallowed and logged — audit must never break the main flow.
    """
    try:
        ip: str | None = None
        if request is not None:
            forwarded = request.headers.get("X-Forwarded-For")
            ip = (
                forwarded.split(",")[0].strip()
                if forwarded
                else (request.client.host if request.client else None)
            )

        entry = AuditLog(
            org_id=org_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip,
        )
        db.add(entry)
        await db.flush()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Audit log failed (action=%s): %s", action, exc)
