from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AIReportOut(BaseModel):
    id: UUID
    company_id: UUID
    fiscal_year: int
    status: str
    summary: str | None = None
    score_explanation: str | None = None
    risk_assessment: str | None = None
    outlook: str | None = None
    strengths: list[str] | None = None
    weaknesses: list[str] | None = None
    key_risks: list[str] | None = None
    recommendations: list[str] | None = None
    red_flags: list[str] | None = None
    model_used: str | None = None
    generated_at: datetime | None = None

    model_config = {"from_attributes": True}


class QARequest(BaseModel):
    question: str
    history: list[dict[str, str]] | None = None  # [{role, content}, ...]


class QAResponse(BaseModel):
    answer: str
    company_id: UUID
    fiscal_year: int
