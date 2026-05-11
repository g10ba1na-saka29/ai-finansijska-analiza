"""
ML Forecasting modul — prognoza prihoda, EBITDA i neto prihoda.

Koristi OLS linearnu regresiju (numpy.linalg.lstsq) na osnovu
historijskih KPI snapshotova kompanije.

Algoritam:
  1. Skupi historijske tačke (min 2 za predikciju)
  2. Fit OLS: y = a * t + b  gdje t = godina - base_year (centriran)
  3. Izračunaj rezidue → std_error → 95% CI (z = 1.96)
  4. Eksktrapoluй za horizon godina unaprijed

Vraća ForecastResult sa ForecastPoint za svaku prognoziranu godinu.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np

MIN_DATA_POINTS = 2
CONFIDENCE_Z = 1.96  # 95% CI


# ── Data klase ─────────────────────────────────────────────────────────────────

@dataclass
class HistoricalPoint:
    year: int
    revenue: Optional[float]
    ebitda: Optional[float]
    net_income: Optional[float]
    total_assets: Optional[float]


@dataclass
class ForecastPoint:
    year: int
    revenue: Optional[float]
    revenue_low: Optional[float]
    revenue_high: Optional[float]
    ebitda: Optional[float]
    ebitda_low: Optional[float]
    ebitda_high: Optional[float]
    net_income: Optional[float]
    net_income_low: Optional[float]
    net_income_high: Optional[float]
    ebitda_margin: Optional[float]   # ebitda / revenue
    net_margin: Optional[float]      # net_income / revenue


@dataclass
class ForecastResult:
    company_id: str
    base_year: int
    horizon: int
    method: str                       # "linear_regression" | "insufficient_data"
    data_points: int
    predictions: list[ForecastPoint]
    revenue_r_squared: Optional[float]
    revenue_cagr: Optional[float]     # compound annual growth rate (all historical)
    historical: list[HistoricalPoint] = field(default_factory=list)


# ── OLS helpers ────────────────────────────────────────────────────────────────

def _ols_fit(
    years: np.ndarray,
    values: np.ndarray,
) -> tuple[float, float, float]:
    """
    Fits y = a*t + b  via numpy lstsq.

    Vraća (slope, intercept, r_squared).
    y_bar = mean(values); SS_tot = sum((y - y_bar)^2)
    SS_res = sum((y - y_hat)^2)
    R² = 1 - SS_res / SS_tot
    """
    n = len(years)
    X = np.column_stack([years, np.ones(n)])
    result = np.linalg.lstsq(X, values, rcond=None)
    coeffs = result[0]
    slope, intercept = float(coeffs[0]), float(coeffs[1])

    y_hat = slope * years + intercept
    ss_res = float(np.sum((values - y_hat) ** 2))
    ss_tot = float(np.sum((values - np.mean(values)) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return slope, intercept, r2


def _std_error(
    years: np.ndarray,
    values: np.ndarray,
    slope: float,
    intercept: float,
) -> float:
    """Standardna greška reziduala (RMSE)."""
    y_hat = slope * years + intercept
    residuals = values - y_hat
    n = len(residuals)
    if n <= 2:
        return float(np.std(residuals)) if n > 1 else abs(residuals[0]) * 0.2
    return float(np.sqrt(np.sum(residuals ** 2) / (n - 2)))


def _forecast_metric(
    historical_years: list[int],
    historical_values: list[Optional[float]],
    future_years: list[int],
) -> tuple[list[Optional[float]], list[Optional[float]], list[Optional[float]], Optional[float]]:
    """
    Prognozira seriju metrike za future_years.

    Vraća (point_estimates, lows, highs, r_squared).
    Ako nema dovoljno validnih tačaka — vraća None za sve.
    """
    # Filtriraj None vrijednosti
    valid = [(y, v) for y, v in zip(historical_years, historical_values) if v is not None]
    if len(valid) < MIN_DATA_POINTS:
        nones = [None] * len(future_years)
        return nones, nones, nones, None

    ys = np.array([p[0] for p in valid], dtype=float)
    vs = np.array([p[1] for p in valid], dtype=float)

    # Centriraj godine oko zadnje historijske tačke
    base = ys[-1]
    ys_c = ys - base

    slope, intercept, r2 = _ols_fit(ys_c, vs)
    se = _std_error(ys_c, vs, slope, intercept)
    margin = CONFIDENCE_Z * se

    points, lows, highs = [], [], []
    for fy in future_years:
        t = float(fy) - base
        pred = slope * t + intercept
        points.append(round(pred, 2))
        lows.append(round(pred - margin, 2))
        highs.append(round(pred + margin, 2))

    return points, lows, highs, round(r2, 4)


def _cagr(start: Optional[float], end: Optional[float], n: int) -> Optional[float]:
    """CAGR = (end/start)^(1/n) - 1"""
    if start is None or end is None or start <= 0 or n <= 0:
        return None
    return round((end / start) ** (1.0 / n) - 1.0, 4)


# ── Javni API ──────────────────────────────────────────────────────────────────

def forecast(
    company_id: str,
    historical: list[HistoricalPoint],
    horizon: int = 3,
) -> ForecastResult:
    """
    Generira prognozu za kompaniju na osnovu historijskih financijskih tačaka.

    Args:
        company_id:  UUID kompanije (string)
        historical:  Lista HistoricalPoint sortirana po godini (ASC)
        horizon:     Broj godina za prognozu (1–3)

    Returns:
        ForecastResult sa prognoziranim vrijednostima i CI.
    """
    horizon = max(1, min(horizon, 3))
    historical = sorted(historical, key=lambda p: p.year)
    n = len(historical)

    if n < MIN_DATA_POINTS:
        base = historical[-1].year if historical else 2024
        return ForecastResult(
            company_id=company_id,
            base_year=base,
            horizon=horizon,
            method="insufficient_data",
            data_points=n,
            predictions=[],
            revenue_r_squared=None,
            revenue_cagr=None,
            historical=historical,
        )

    base_year = historical[-1].year
    future_years = list(range(base_year + 1, base_year + horizon + 1))
    hist_years = [p.year for p in historical]

    rev_pts, rev_lo, rev_hi, rev_r2 = _forecast_metric(
        hist_years, [p.revenue for p in historical], future_years
    )
    ebitda_pts, ebitda_lo, ebitda_hi, _ = _forecast_metric(
        hist_years, [p.ebitda for p in historical], future_years
    )
    ni_pts, ni_lo, ni_hi, _ = _forecast_metric(
        hist_years, [p.net_income for p in historical], future_years
    )

    predictions: list[ForecastPoint] = []
    for i, fy in enumerate(future_years):
        rev = rev_pts[i]
        ebitda = ebitda_pts[i]
        ni = ni_pts[i]

        ebitda_margin = round(ebitda / rev, 4) if rev and rev > 0 and ebitda is not None else None
        net_margin = round(ni / rev, 4) if rev and rev > 0 and ni is not None else None

        predictions.append(ForecastPoint(
            year=fy,
            revenue=rev,
            revenue_low=rev_lo[i],
            revenue_high=rev_hi[i],
            ebitda=ebitda,
            ebitda_low=ebitda_lo[i],
            ebitda_high=ebitda_hi[i],
            net_income=ni,
            net_income_low=ni_lo[i],
            net_income_high=ni_hi[i],
            ebitda_margin=ebitda_margin,
            net_margin=net_margin,
        ))

    # CAGR na osnovu historijskih prihoda
    rev_first = historical[0].revenue
    rev_last  = historical[-1].revenue
    cagr = _cagr(rev_first, rev_last, n - 1) if n >= 2 else None

    return ForecastResult(
        company_id=company_id,
        base_year=base_year,
        horizon=horizon,
        method="linear_regression",
        data_points=n,
        predictions=predictions,
        revenue_r_squared=rev_r2,
        revenue_cagr=cagr,
        historical=historical,
    )
