"""
Kompozitni score engine.
Kombinuje KPI metrike, pondere i Altman Z-Score u finalni 0–100 score.
"""

from dataclasses import dataclass
from typing import Any

from app.modules.scoring.thresholds import CATEGORY_THRESHOLDS, score_metric, risk_level
from app.modules.scoring.weights import CategoryWeights, get_weights
from app.modules.scoring import altman as altman_module
from app.modules.kpi.financials import FinancialStatement


@dataclass
class ScoreResult:
    total: float
    risk_level: str
    liquidity: float | None
    profitability: float | None
    leverage: float | None
    growth: float | None
    cashflow: float | None
    altman: dict
    breakdown: dict[str, dict]
    score_version: str = "1.0"

    def to_dict(self) -> dict:
        return {
            "total": self.total,
            "risk_level": self.risk_level,
            "categories": {
                "liquidity": self.liquidity,
                "profitability": self.profitability,
                "leverage": self.leverage,
                "growth": self.growth,
                "cashflow": self.cashflow,
            },
            "altman": self.altman,
            "breakdown": self.breakdown,
            "score_version": self.score_version,
        }


def _score_category(
    kpi_values: dict[str, float | None],
    category: str,
) -> tuple[float | None, dict[str, float | None]]:
    """
    Vraća (weighted_score, individual_scores) za jednu kategoriju.
    """
    thresholds = CATEGORY_THRESHOLDS.get(category, {})
    if not thresholds:
        return None, {}

    weighted_sum = 0.0
    total_weight = 0.0
    individual: dict[str, float | None] = {}

    for metric, threshold in thresholds.items():
        val = kpi_values.get(metric)
        s = score_metric(val, threshold)
        individual[metric] = s
        if s is not None:
            weighted_sum += s * threshold.weight
            total_weight += threshold.weight

    if total_weight == 0:
        return None, individual

    cat_score = round(weighted_sum / total_weight, 2)
    return cat_score, individual


def calculate(
    kpi_data: dict[str, Any],
    fs: FinancialStatement,
    industry: str | None = None,
) -> ScoreResult:
    """
    Izračunava kompozitni score iz KPI podataka i FinancialStatement.

    Args:
        kpi_data: Output calculate_all() iz kpi.calculator
        fs:       FinancialStatement tekuće godine (za Altman)
        industry: Industrijska grana (za pondere)
    """
    weights: CategoryWeights = get_weights(industry)

    all_kpis: dict[str, float | None] = {}
    for cat_data in kpi_data.values():
        if isinstance(cat_data, dict):
            all_kpis.update(cat_data)

    breakdown: dict[str, dict] = {}
    category_scores: dict[str, float | None] = {}

    for cat in ("liquidity", "profitability", "leverage", "growth", "cashflow"):
        cat_score, individual = _score_category(all_kpis, cat)
        category_scores[cat] = cat_score
        breakdown[cat] = individual

    # Altman Z-Score
    altman_result = altman_module.calculate(fs)

    # Kompozitni score (ponderisani prosjek dostupnih kategorija)
    weight_map = {
        "liquidity": weights.liquidity,
        "profitability": weights.profitability,
        "leverage": weights.leverage,
        "growth": weights.growth,
        "cashflow": weights.cashflow,
    }

    weighted_total = 0.0
    used_weight = 0.0
    for cat, w in weight_map.items():
        score = category_scores.get(cat)
        if score is not None:
            weighted_total += score * w
            used_weight += w

    if used_weight > 0:
        # Normalizuj ako neke kategorije nemaju podatke
        total = round(weighted_total / used_weight * 100 / 100, 2)
    else:
        total = 0.0

    # Altman blagi penalty: ako je u distress zoni, max score = 35
    if altman_result.zone == "distress":
        total = min(total, 35.0)
    elif altman_result.zone == "grey":
        total = min(total, 65.0)

    return ScoreResult(
        total=total,
        risk_level=risk_level(total),
        liquidity=category_scores.get("liquidity"),
        profitability=category_scores.get("profitability"),
        leverage=category_scores.get("leverage"),
        growth=category_scores.get("growth"),
        cashflow=category_scores.get("cashflow"),
        altman=altman_result.to_dict(),
        breakdown=breakdown,
    )
