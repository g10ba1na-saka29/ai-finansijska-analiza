from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr


class MemberOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberListOut(BaseModel):
    items: list[MemberOut]
    total: int


class MemberCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "analyst"


class MemberUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class AuditLogOut(BaseModel):
    id: str
    user_id: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    details: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime


class AuditLogListOut(BaseModel):
    items: list[AuditLogOut]
    total: int
