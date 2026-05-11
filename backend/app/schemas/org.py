from datetime import datetime

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
