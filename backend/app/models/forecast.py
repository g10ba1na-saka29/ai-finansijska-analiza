import uuid
from datetime import datetime

from sqlalchemy import Integer, Numeric, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Forecast(Base):
    __tablename__ = "forecasts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Zadnja historijska godina korištena kao osnova za prognozu
    base_year: Mapped[int] = mapped_column(Integer, nullable=False)

    # Broj godina unaprijed (1–3)
    horizon: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Metoda: "linear_regression" | "insufficient_data"
    method: Mapped[str] = mapped_column(String(50), nullable=False, default="linear_regression")

    # Broj historijskih tačaka korištenih
    data_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Prognozirne tačke [{year, revenue, revenue_low, revenue_high, ebitda, ...}]
    predictions: Mapped[list | None] = mapped_column(JSONB)

    # Historijski podaci sažeto [{year, revenue, ebitda, net_income}]
    historical_summary: Mapped[list | None] = mapped_column(JSONB)

    # Statistike modela
    revenue_r_squared: Mapped[float | None] = mapped_column(Numeric(6, 4))
    revenue_cagr:      Mapped[float | None] = mapped_column(Numeric(8, 4))

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
