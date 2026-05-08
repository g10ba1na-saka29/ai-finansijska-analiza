import uuid
from datetime import datetime

from sqlalchemy import Integer, Numeric, String, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompanyScore(Base):
    __tablename__ = "company_scores"
    __table_args__ = (UniqueConstraint("company_id", "fiscal_year", name="uq_score_company_year"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)

    total_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    liquidity_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    profitability_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    leverage_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    growth_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    cashflow_score: Mapped[float | None] = mapped_column(Numeric(5, 2))

    # excellent | good | warning | high_risk | critical
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)

    # Altman Z-Score rezultat (JSON)
    altman_data: Mapped[dict | None] = mapped_column(JSONB)

    # Detaljni breakdown po metrikama
    breakdown: Mapped[dict | None] = mapped_column(JSONB)

    score_version: Mapped[str] = mapped_column(String(10), default="1.0")
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
