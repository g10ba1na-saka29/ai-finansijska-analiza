from uuid import UUID
from typing import Optional

from pydantic import BaseModel


class MetricBenchmarkOut(BaseModel):
    metric: str
    label: str
    company_value: Optional[float] = None
    industry_p25: Optional[float] = None
    industry_median: Optional[float] = None
    industry_p75: Optional[float] = None
    percentile: Optional[int] = None      # 0–100
    higher_is_better: bool
    assessment: str                        # strong | above_avg | avg | below_avg | weak | neutral
    assessment_label: str


class BenchmarkResponse(BaseModel):
    company_id: UUID
    fiscal_year: int
    industry: str
    metrics: list[MetricBenchmarkOut]
    overall_percentile: Optional[int] = None
    strengths: list[str]
    weaknesses: list[str]


class IndustriesResponse(BaseModel):
    industries: list[str]
