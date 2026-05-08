from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CompanyCreate(BaseModel):
    name: str
    tax_id: str | None = None
    industry: str | None = None
    country: str = "BA"


class CompanyUpdate(BaseModel):
    name: str | None = None
    tax_id: str | None = None
    industry: str | None = None
    country: str | None = None


class CompanyOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    tax_id: str | None
    industry: str | None
    country: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyListOut(BaseModel):
    items: list[CompanyOut]
    total: int
