from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

VALID_REPORT_TYPES = {"balance_sheet", "income", "cash_flow", "tax", "audit"}


class ReportCreate(BaseModel):
    fiscal_year: int
    report_type: str


class ReportOut(BaseModel):
    id: UUID
    company_id: UUID
    fiscal_year: int
    report_type: str
    status: str
    error_message: str | None
    raw_data: dict[str, Any] | None
    uploaded_at: datetime
    processed_at: datetime | None

    model_config = {"from_attributes": True}


class ReportListOut(BaseModel):
    items: list[ReportOut]
    total: int
