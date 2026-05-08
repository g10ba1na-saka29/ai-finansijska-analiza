from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AltmanData(BaseModel):
    z_score: float | None = None
    zone: str
    components: dict[str, float | None]
    interpretation: str


class ScoreBreakdown(BaseModel):
    liquidity: dict[str, float | None] = {}
    profitability: dict[str, float | None] = {}
    leverage: dict[str, float | None] = {}
    growth: dict[str, float | None] = {}
    cashflow: dict[str, float | None] = {}


class ScoreResponse(BaseModel):
    company_id: UUID
    fiscal_year: int
    total_score: float
    risk_level: str
    liquidity_score: float | None = None
    profitability_score: float | None = None
    leverage_score: float | None = None
    growth_score: float | None = None
    cashflow_score: float | None = None
    altman: AltmanData | None = None
    breakdown: ScoreBreakdown | None = None
    score_version: str = "1.0"
    calculated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScoreHistoryPoint(BaseModel):
    fiscal_year: int
    total_score: float
    risk_level: str
    liquidity_score: float | None = None
    profitability_score: float | None = None
    leverage_score: float | None = None
    growth_score: float | None = None
    cashflow_score: float | None = None


class ScoreHistoryResponse(BaseModel):
    company_id: UUID
    history: list[ScoreHistoryPoint]
