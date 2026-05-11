from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# ── Anomaly Detection ─────────────────────────────────────────────────────────

class AnomalyFlagOut(BaseModel):
    metric: str
    label: str
    severity: str          # critical | high | medium | low
    anomaly_type: str
    description: str
    value: Optional[float] = None
    previous_value: Optional[float] = None
    industry_norm: Optional[float] = None


class AnomalyResultOut(BaseModel):
    company_id: UUID
    fiscal_year: int
    anomalies: list[AnomalyFlagOut]
    risk_score: int        # 0–100
    summary: str
    methods_used: list[str]


# ── Piotroski F-Score ─────────────────────────────────────────────────────────

class PiotroskiSignalOut(BaseModel):
    name: str              # F1 … F9
    description: str
    passed: bool
    value: Optional[float] = None


class PiotroskiResultOut(BaseModel):
    score: int             # 0–9 (broj prošlih signala)
    available: int         # broj evaluiranih signala
    category: str          # strong | neutral | weak
    signals: list[PiotroskiSignalOut]


# ── Bankruptcy Risk ───────────────────────────────────────────────────────────

class BankruptcyRiskOut(BaseModel):
    company_id: UUID
    fiscal_year: int
    piotroski: PiotroskiResultOut
    altman_z_score: Optional[float] = None
    altman_zone: Optional[str] = None     # safe | grey | distress
    distress_probability: float           # 0.0 – 1.0
    distress_label: str                   # very_low | low | moderate | high | very_high
    risk_factors: list[str]
    positive_factors: list[str]
