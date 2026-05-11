import uuid
from datetime import datetime

from sqlalchemy import Boolean, Integer, String, DateTime, ForeignKey, func, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Webhook(Base):
    """
    Webhook registracija po organizaciji.

    Podržani eventi:
      kpi.calculated      — nova KPI + score kalkulacija završena
      report.processed    — PDF izvještaj uspješno parsiran
      ai_report.generated — AI izvještaj generisan
    """
    __tablename__ = "webhooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    url: Mapped[str] = mapped_column(String(2048), nullable=False)

    # HMAC-SHA256 potpisni ključ (random 32 byte hex, generisan pri registraciji)
    secret: Mapped[str] = mapped_column(String(255), nullable=False)

    # Lista eventa: ["kpi.calculated", "report.processed", ...]
    events: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    description: Mapped[str | None] = mapped_column(String(500))

    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
