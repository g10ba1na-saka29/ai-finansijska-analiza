import uuid
from datetime import datetime

from sqlalchemy import Integer, Numeric, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class KPISnapshot(Base):
    __tablename__ = "kpi_snapshots"
    __table_args__ = (UniqueConstraint("company_id", "fiscal_year", name="uq_kpi_company_year"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)

    # Likvidnost
    current_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))
    quick_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))
    cash_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Profitabilnost
    gross_margin: Mapped[float | None] = mapped_column(Numeric(10, 4))
    ebitda_margin: Mapped[float | None] = mapped_column(Numeric(10, 4))
    net_margin: Mapped[float | None] = mapped_column(Numeric(10, 4))
    roe: Mapped[float | None] = mapped_column(Numeric(10, 4))
    roa: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Zaduženost
    debt_to_equity: Mapped[float | None] = mapped_column(Numeric(10, 4))
    interest_coverage: Mapped[float | None] = mapped_column(Numeric(10, 4))
    debt_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Rast (YoY)
    revenue_growth: Mapped[float | None] = mapped_column(Numeric(10, 4))
    ebitda_growth: Mapped[float | None] = mapped_column(Numeric(10, 4))
    net_income_growth: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Cash Flow
    free_cash_flow: Mapped[float | None] = mapped_column(Numeric(20, 2))
    ocf_margin: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Efikasnost
    asset_turnover: Mapped[float | None] = mapped_column(Numeric(10, 4))
    days_sales_outstanding: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # Raw finansijski podaci (za custom kalkulacije)
    raw_financials: Mapped[dict | None] = mapped_column(JSONB)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
