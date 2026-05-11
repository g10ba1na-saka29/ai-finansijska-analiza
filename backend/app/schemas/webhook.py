from datetime import datetime
from uuid import UUID
from typing import Optional

from pydantic import BaseModel, HttpUrl, field_validator


SUPPORTED_EVENTS = frozenset({
    "kpi.calculated",
    "report.processed",
    "ai_report.generated",
})


class WebhookCreate(BaseModel):
    url: str
    events: list[str]
    description: Optional[str] = None

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str]) -> list[str]:
        invalid = [e for e in v if e not in SUPPORTED_EVENTS]
        if invalid:
            raise ValueError(
                f"Nepodržani eventi: {invalid}. "
                f"Podržano: {sorted(SUPPORTED_EVENTS)}"
            )
        if not v:
            raise ValueError("Mora biti odabran bar jedan event")
        return list(set(v))  # deduplicate


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    events: Optional[list[str]] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        invalid = [e for e in v if e not in SUPPORTED_EVENTS]
        if invalid:
            raise ValueError(f"Nepodržani eventi: {invalid}")
        return list(set(v))


class WebhookResponse(BaseModel):
    id: UUID
    org_id: UUID
    url: str
    events: list[str]
    is_active: bool
    description: Optional[str] = None
    last_triggered_at: Optional[datetime] = None
    failure_count: int
    created_at: datetime
    # Secret se NE vraća u response-u (sigurnosni razlog)
    # Prikazan samo jednom pri kreiranju via WebhookCreatedResponse

    model_config = {"from_attributes": True}


class WebhookCreatedResponse(WebhookResponse):
    """Prošireni response koji uključuje secret — samo pri kreiranju."""
    secret: str


class WebhookListResponse(BaseModel):
    items: list[WebhookResponse]
    total: int


class SupportedEventsResponse(BaseModel):
    events: list[str]
