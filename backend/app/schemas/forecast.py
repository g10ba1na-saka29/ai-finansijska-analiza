from datetime import datetime
from uuid import UUID
from typing import Optional

from pydantic import BaseModel


class ForecastPointOut(BaseModel):
    year: int
    revenue: Optional[float] = None
    revenue_low: Optional[float] = None
    revenue_high: Optional[float] = None
    ebitda: Optional[float] = None
    ebitda_low: Optional[float] = None
    ebitda_high: Optional[float] = None
    net_income: Optional[float] = None
    net_income_low: Optional[float] = None
    net_income_high: Optional[float] = None
    ebitda_margin: Optional[float] = None
    net_margin: Optional[float] = None


class HistoricalPointOut(BaseModel):
    year: int
    revenue: Optional[float] = None
    ebitda: Optional[float] = None
    net_income: Optional[float] = None
    total_assets: Optional[float] = None


class ForecastResponse(BaseModel):
    company_id: UUID
    base_year: int
    horizon: int
    method: str
    data_points: int
    predictions: list[ForecastPointOut]
    historical: list[HistoricalPointOut]
    revenue_r_squared: Optional[float] = None
    revenue_cagr: Optional[float] = None
    generated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ForecastGenerateRequest(BaseModel):
    horizon: int = 3  # 1–3 years
