from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class LiquidityKPIs(BaseModel):
    current_ratio: float | None = None
    quick_ratio: float | None = None
    cash_ratio: float | None = None


class ProfitabilityKPIs(BaseModel):
    gross_margin: float | None = None
    ebitda_margin: float | None = None
    ebit_margin: float | None = None
    net_margin: float | None = None
    roe: float | None = None
    roa: float | None = None


class LeverageKPIs(BaseModel):
    debt_to_equity: float | None = None
    interest_coverage: float | None = None
    debt_ratio: float | None = None
    equity_ratio: float | None = None


class GrowthKPIs(BaseModel):
    revenue_growth: float | None = None
    ebitda_growth: float | None = None
    net_income_growth: float | None = None
    asset_growth: float | None = None


class CashFlowKPIs(BaseModel):
    free_cash_flow: float | None = None
    ocf_margin: float | None = None
    cash_to_debt: float | None = None
    ocf_to_current_liabilities: float | None = None


class EfficiencyKPIs(BaseModel):
    asset_turnover: float | None = None
    receivables_turnover: float | None = None
    days_sales_outstanding: float | None = None
    inventory_turnover: float | None = None
    days_inventory_outstanding: float | None = None


class KPIResponse(BaseModel):
    company_id: UUID
    fiscal_year: int
    liquidity: LiquidityKPIs
    profitability: ProfitabilityKPIs
    leverage: LeverageKPIs
    growth: GrowthKPIs
    cashflow: CashFlowKPIs
    efficiency: EfficiencyKPIs
    calculated_at: datetime | None = None

    model_config = {"from_attributes": True}


class KPITrendPoint(BaseModel):
    fiscal_year: int
    ebitda_margin: float | None = None
    net_margin: float | None = None
    current_ratio: float | None = None
    debt_to_equity: float | None = None
    revenue_growth: float | None = None
    total_score: float | None = None


class KPITrendResponse(BaseModel):
    company_id: UUID
    points: list[KPITrendPoint]
