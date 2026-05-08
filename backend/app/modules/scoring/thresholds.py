"""
Granične vrijednosti za KPI scoring.
Svaka metrika se normalizuje na 0–100 linearnom interpolacijom
između worst_val (→ 0) i best_val (→ 100).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class MetricThreshold:
    worst_val: float    # → score 0
    best_val: float     # → score 100
    higher_is_better: bool = True
    weight: float = 1.0  # Unutar kategorije


def score_metric(value: float | None, t: MetricThreshold) -> float | None:
    """Linearno mapira vrijednost na 0–100."""
    if value is None:
        return None
    lo, hi = (t.worst_val, t.best_val) if t.higher_is_better else (t.best_val, t.worst_val)
    if hi == lo:
        return 50.0
    normalized = (value - lo) / (hi - lo)
    return round(max(0.0, min(100.0, normalized * 100)), 2)


# ── Thresholds po kategorijama ─────────────────────────────────────────────────

LIQUIDITY_THRESHOLDS: dict[str, MetricThreshold] = {
    "current_ratio":   MetricThreshold(worst_val=0.5,  best_val=3.0,  weight=0.45),
    "quick_ratio":     MetricThreshold(worst_val=0.3,  best_val=2.0,  weight=0.35),
    "cash_ratio":      MetricThreshold(worst_val=0.0,  best_val=1.0,  weight=0.20),
}

PROFITABILITY_THRESHOLDS: dict[str, MetricThreshold] = {
    "ebitda_margin":   MetricThreshold(worst_val=-0.05, best_val=0.30, weight=0.30),
    "net_margin":      MetricThreshold(worst_val=-0.05, best_val=0.20, weight=0.25),
    "roe":             MetricThreshold(worst_val=-0.10, best_val=0.25, weight=0.25),
    "roa":             MetricThreshold(worst_val=-0.05, best_val=0.15, weight=0.20),
}

LEVERAGE_THRESHOLDS: dict[str, MetricThreshold] = {
    "debt_to_equity":    MetricThreshold(worst_val=5.0,  best_val=0.0,  higher_is_better=False, weight=0.40),
    "interest_coverage": MetricThreshold(worst_val=0.5,  best_val=8.0,  weight=0.35),
    "debt_ratio":        MetricThreshold(worst_val=0.9,  best_val=0.2,  higher_is_better=False, weight=0.25),
}

GROWTH_THRESHOLDS: dict[str, MetricThreshold] = {
    "revenue_growth":    MetricThreshold(worst_val=-0.20, best_val=0.30, weight=0.50),
    "ebitda_growth":     MetricThreshold(worst_val=-0.20, best_val=0.30, weight=0.30),
    "net_income_growth": MetricThreshold(worst_val=-0.30, best_val=0.40, weight=0.20),
}

CASHFLOW_THRESHOLDS: dict[str, MetricThreshold] = {
    "ocf_margin":                    MetricThreshold(worst_val=-0.05, best_val=0.20, weight=0.50),
    "ocf_to_current_liabilities":    MetricThreshold(worst_val=-0.10, best_val=0.50, weight=0.30),
    "cash_to_debt":                  MetricThreshold(worst_val=0.0,   best_val=0.50, weight=0.20),
}

CATEGORY_THRESHOLDS = {
    "liquidity": LIQUIDITY_THRESHOLDS,
    "profitability": PROFITABILITY_THRESHOLDS,
    "leverage": LEVERAGE_THRESHOLDS,
    "growth": GROWTH_THRESHOLDS,
    "cashflow": CASHFLOW_THRESHOLDS,
}


def risk_level(score: float) -> str:
    if score >= 80:
        return "excellent"
    if score >= 60:
        return "good"
    if score >= 40:
        return "warning"
    if score >= 20:
        return "high_risk"
    return "critical"
