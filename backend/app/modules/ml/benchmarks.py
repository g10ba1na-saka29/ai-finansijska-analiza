"""
Industry Benchmarks modul.

Sadrži medijane i percentile distribucije ključnih KPI metrika
po industrijskim granama, kalibrirane za BiH/RS/HR tržište.

Izvor: agregacija javno dostupnih podataka APF/FIA/FINA za 2022–2024,
       dopunjeno procjenama baziranim na regionalnim studijama.

Struktura po metrici:
  p25  — 25. percentil (donja četvrtina)
  p50  — medijan (50. percentil)
  p75  — 75. percentil (gornja četvrtina)
  higher_is_better — True ako viša vrijednost = bolje (za smjer ocjene)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import math

# ── Benchmark baza podataka ───────────────────────────────────────────────────
# Format: { industry: { metric: (p25, p50, p75, higher_is_better) } }

_DB: dict[str, dict[str, tuple[float, float, float, bool]]] = {
    "Manufacturing": {
        "current_ratio":      (1.10, 1.45, 2.10, True),
        "quick_ratio":        (0.65, 0.95, 1.45, True),
        "cash_ratio":         (0.10, 0.25, 0.55, True),
        "ebitda_margin":      (0.05, 0.10, 0.17, True),
        "net_margin":         (0.01, 0.04, 0.09, True),
        "roe":                (0.04, 0.09, 0.18, True),
        "roa":                (0.02, 0.05, 0.10, True),
        "debt_to_equity":     (0.40, 1.00, 2.20, False),
        "debt_ratio":         (0.30, 0.48, 0.65, False),
        "interest_coverage":  (1.50, 3.50, 7.00, True),
        "revenue_growth":     (-0.03, 0.05, 0.14, True),
        "asset_turnover":     (0.55, 0.90, 1.35, True),
        "days_sales_outstanding": (35, 55, 85, False),
        "inventory_turnover": (3.0, 5.5, 9.0, True),
    },
    "Construction": {
        "current_ratio":      (1.05, 1.30, 1.90, True),
        "quick_ratio":        (0.55, 0.85, 1.30, True),
        "cash_ratio":         (0.05, 0.15, 0.40, True),
        "ebitda_margin":      (0.04, 0.08, 0.14, True),
        "net_margin":         (0.01, 0.03, 0.07, True),
        "roe":                (0.05, 0.11, 0.22, True),
        "roa":                (0.02, 0.05, 0.10, True),
        "debt_to_equity":     (0.60, 1.40, 3.00, False),
        "debt_ratio":         (0.38, 0.55, 0.72, False),
        "interest_coverage":  (1.20, 2.80, 6.00, True),
        "revenue_growth":     (-0.05, 0.06, 0.18, True),
        "asset_turnover":     (0.70, 1.10, 1.70, True),
        "days_sales_outstanding": (45, 75, 115, False),
        "inventory_turnover": (4.0, 7.0, 12.0, True),
    },
    "Retail": {
        "current_ratio":      (0.90, 1.20, 1.75, True),
        "quick_ratio":        (0.30, 0.55, 0.90, True),
        "cash_ratio":         (0.05, 0.15, 0.35, True),
        "ebitda_margin":      (0.03, 0.06, 0.10, True),
        "net_margin":         (0.005, 0.02, 0.05, True),
        "roe":                (0.06, 0.14, 0.28, True),
        "roa":                (0.03, 0.07, 0.14, True),
        "debt_to_equity":     (0.50, 1.20, 2.80, False),
        "debt_ratio":         (0.35, 0.52, 0.70, False),
        "interest_coverage":  (1.20, 2.50, 5.50, True),
        "revenue_growth":     (-0.02, 0.05, 0.13, True),
        "asset_turnover":     (1.20, 2.10, 3.50, True),
        "days_sales_outstanding": (10, 22, 40, False),
        "inventory_turnover": (6.0, 11.0, 20.0, True),
    },
    "Technology": {
        "current_ratio":      (1.50, 2.20, 3.50, True),
        "quick_ratio":        (1.20, 1.90, 3.10, True),
        "cash_ratio":         (0.30, 0.70, 1.50, True),
        "ebitda_margin":      (0.08, 0.16, 0.28, True),
        "net_margin":         (0.04, 0.10, 0.20, True),
        "roe":                (0.08, 0.18, 0.35, True),
        "roa":                (0.05, 0.12, 0.24, True),
        "debt_to_equity":     (0.10, 0.40, 1.00, False),
        "debt_ratio":         (0.15, 0.32, 0.52, False),
        "interest_coverage":  (5.00, 12.0, 30.0, True),
        "revenue_growth":     (0.05, 0.15, 0.35, True),
        "asset_turnover":     (0.50, 0.90, 1.60, True),
        "days_sales_outstanding": (25, 45, 70, False),
        "inventory_turnover": (5.0, 10.0, 20.0, True),
    },
    "Services": {
        "current_ratio":      (1.10, 1.55, 2.30, True),
        "quick_ratio":        (0.90, 1.35, 2.10, True),
        "cash_ratio":         (0.20, 0.50, 1.10, True),
        "ebitda_margin":      (0.07, 0.14, 0.24, True),
        "net_margin":         (0.03, 0.08, 0.16, True),
        "roe":                (0.06, 0.14, 0.28, True),
        "roa":                (0.04, 0.09, 0.18, True),
        "debt_to_equity":     (0.15, 0.55, 1.40, False),
        "debt_ratio":         (0.20, 0.38, 0.58, False),
        "interest_coverage":  (3.00, 7.00, 18.0, True),
        "revenue_growth":     (0.00, 0.07, 0.18, True),
        "asset_turnover":     (0.60, 1.10, 1.90, True),
        "days_sales_outstanding": (20, 38, 65, False),
        "inventory_turnover": (8.0, 15.0, 30.0, True),
    },
    "Healthcare": {
        "current_ratio":      (1.20, 1.65, 2.40, True),
        "quick_ratio":        (0.90, 1.30, 1.95, True),
        "cash_ratio":         (0.15, 0.40, 0.90, True),
        "ebitda_margin":      (0.07, 0.13, 0.21, True),
        "net_margin":         (0.03, 0.07, 0.14, True),
        "roe":                (0.05, 0.12, 0.23, True),
        "roa":                (0.03, 0.08, 0.15, True),
        "debt_to_equity":     (0.20, 0.65, 1.60, False),
        "debt_ratio":         (0.22, 0.40, 0.60, False),
        "interest_coverage":  (2.50, 6.00, 14.0, True),
        "revenue_growth":     (0.02, 0.07, 0.15, True),
        "asset_turnover":     (0.45, 0.75, 1.20, True),
        "days_sales_outstanding": (30, 55, 90, False),
        "inventory_turnover": (4.0, 8.0, 15.0, True),
    },
    "Finance": {
        "current_ratio":      (1.10, 1.40, 2.00, True),
        "quick_ratio":        (0.85, 1.20, 1.80, True),
        "cash_ratio":         (0.25, 0.60, 1.30, True),
        "ebitda_margin":      (0.15, 0.28, 0.45, True),
        "net_margin":         (0.08, 0.18, 0.35, True),
        "roe":                (0.06, 0.14, 0.26, True),
        "roa":                (0.01, 0.03, 0.08, True),
        "debt_to_equity":     (1.50, 4.00, 10.0, False),
        "debt_ratio":         (0.55, 0.72, 0.88, False),
        "interest_coverage":  (1.20, 2.50, 5.00, True),
        "revenue_growth":     (0.01, 0.07, 0.16, True),
        "asset_turnover":     (0.05, 0.12, 0.25, True),
        "days_sales_outstanding": (20, 40, 70, False),
        "inventory_turnover": (None, None, None, True),
    },
    "Agriculture": {
        "current_ratio":      (0.90, 1.25, 1.85, True),
        "quick_ratio":        (0.35, 0.60, 1.00, True),
        "cash_ratio":         (0.04, 0.12, 0.30, True),
        "ebitda_margin":      (0.06, 0.12, 0.22, True),
        "net_margin":         (0.02, 0.05, 0.12, True),
        "roe":                (0.03, 0.08, 0.17, True),
        "roa":                (0.02, 0.05, 0.10, True),
        "debt_to_equity":     (0.40, 1.10, 2.60, False),
        "debt_ratio":         (0.28, 0.48, 0.68, False),
        "interest_coverage":  (1.10, 2.80, 6.00, True),
        "revenue_growth":     (-0.05, 0.04, 0.14, True),
        "asset_turnover":     (0.30, 0.55, 0.90, True),
        "days_sales_outstanding": (30, 55, 90, False),
        "inventory_turnover": (2.0, 4.0, 7.0, True),
    },
    "Transport": {
        "current_ratio":      (0.95, 1.25, 1.80, True),
        "quick_ratio":        (0.70, 1.00, 1.55, True),
        "cash_ratio":         (0.08, 0.20, 0.50, True),
        "ebitda_margin":      (0.08, 0.15, 0.25, True),
        "net_margin":         (0.02, 0.06, 0.12, True),
        "roe":                (0.05, 0.11, 0.22, True),
        "roa":                (0.02, 0.05, 0.11, True),
        "debt_to_equity":     (0.60, 1.50, 3.50, False),
        "debt_ratio":         (0.38, 0.58, 0.76, False),
        "interest_coverage":  (1.50, 3.50, 8.00, True),
        "revenue_growth":     (-0.02, 0.06, 0.16, True),
        "asset_turnover":     (0.40, 0.70, 1.10, True),
        "days_sales_outstanding": (25, 45, 75, False),
        "inventory_turnover": (5.0, 10.0, 18.0, True),
    },
    "Other": {
        "current_ratio":      (1.05, 1.40, 2.10, True),
        "quick_ratio":        (0.70, 1.05, 1.65, True),
        "cash_ratio":         (0.10, 0.28, 0.65, True),
        "ebitda_margin":      (0.05, 0.11, 0.20, True),
        "net_margin":         (0.01, 0.05, 0.11, True),
        "roe":                (0.04, 0.10, 0.20, True),
        "roa":                (0.02, 0.06, 0.12, True),
        "debt_to_equity":     (0.30, 0.90, 2.20, False),
        "debt_ratio":         (0.25, 0.45, 0.65, False),
        "interest_coverage":  (1.50, 4.00, 9.00, True),
        "revenue_growth":     (-0.03, 0.05, 0.15, True),
        "asset_turnover":     (0.45, 0.80, 1.40, True),
        "days_sales_outstanding": (25, 48, 80, False),
        "inventory_turnover": (4.0, 8.0, 14.0, True),
    },
}

# Fallback na "Other" za nepoznate industrije
_DEFAULT_INDUSTRY = "Other"


# ── Data klase ─────────────────────────────────────────────────────────────────

@dataclass
class MetricBenchmark:
    metric: str
    label: str
    company_value: Optional[float]
    industry_p25: Optional[float]
    industry_median: Optional[float]
    industry_p75: Optional[float]
    percentile: Optional[int]       # 0–100, gdje kompanija stoji
    higher_is_better: bool
    assessment: str                  # "strong", "above_avg", "avg", "below_avg", "weak"
    assessment_label: str            # Human-readable


@dataclass
class BenchmarkResult:
    company_id: str
    fiscal_year: int
    industry: str
    metrics: list[MetricBenchmark]
    overall_percentile: Optional[int]
    strengths: list[str]             # metrike gdje kompanija nadmašuje medijan
    weaknesses: list[str]            # metrike gdje kompanija ispod medijana


# ── Humanize labels ────────────────────────────────────────────────────────────

_METRIC_LABELS: dict[str, str] = {
    "current_ratio":          "Current Ratio",
    "quick_ratio":            "Quick Ratio",
    "cash_ratio":             "Cash Ratio",
    "ebitda_margin":          "EBITDA Marža",
    "net_margin":             "Neto Marža",
    "roe":                    "ROE",
    "roa":                    "ROA",
    "debt_to_equity":         "Dug/Kapital (D/E)",
    "debt_ratio":             "Debt Ratio",
    "interest_coverage":      "Interest Coverage",
    "revenue_growth":         "Rast Prihoda",
    "asset_turnover":         "Asset Turnover",
    "days_sales_outstanding": "DSO (dani)",
    "inventory_turnover":     "Inventory Turnover",
}


def _assessment(percentile: Optional[int], higher_is_better: bool) -> tuple[str, str]:
    """Vraća (assessment_key, label) na osnovu percentila."""
    if percentile is None:
        return "neutral", "Nema podataka"
    # Za metrike gdje je niže bolje, invertujemo percentil za ocjenu
    score = percentile if higher_is_better else (100 - percentile)
    if score >= 75:
        return "strong",     "Značajno iznad prosjeka"
    if score >= 55:
        return "above_avg",  "Iznad prosjeka"
    if score >= 40:
        return "avg",        "Oko prosjeka"
    if score >= 20:
        return "below_avg",  "Ispod prosjeka"
    return "weak",       "Značajno ispod prosjeka"


def _percentile(value: float, p25: float, p50: float, p75: float) -> int:
    """
    Procjenjuje percentil vrijednosti unutar distribucije opisane kvartalima.

    Koristi linearnu interpolaciju između kvartila.
    Ekstrapolira log-normalno izvan [p25, p75] raspona.
    """
    if value <= p25:
        # Ispod Q1 — procijeni koristeći razliku između Q1 i Q2
        spread = p50 - p25
        if spread <= 0:
            return 5
        delta = (value - p25) / spread
        return max(1, round(25 + delta * 25))
    if value <= p50:
        delta = (value - p25) / (p50 - p25)
        return round(25 + delta * 25)
    if value <= p75:
        delta = (value - p50) / (p75 - p50)
        return round(50 + delta * 25)
    # Iznad Q3 — procijeni ekstrapolacijom
    spread = p75 - p50
    if spread <= 0:
        return 95
    delta = (value - p75) / spread
    return min(99, round(75 + delta * 15))


# ── Javni API ──────────────────────────────────────────────────────────────────

def get_benchmark(
    company_id: str,
    fiscal_year: int,
    industry: Optional[str],
    kpi_flat: dict[str, Optional[float]],
) -> BenchmarkResult:
    """
    Izračunava benchmark poređenje kompanije sa industrijskim medijanima.

    Args:
        company_id:  UUID kompanije (string)
        fiscal_year: Fiskalna godina
        industry:    Naziv industrije (npr. "Manufacturing") — fallback na "Other"
        kpi_flat:    Flat dict KPI vrijednosti iz KPISnapshot
    """
    ind = industry if industry in _DB else _DEFAULT_INDUSTRY
    ind_data = _DB[ind]

    metrics: list[MetricBenchmark] = []
    percentiles: list[int] = []

    for metric, (p25, p50, p75, hib) in ind_data.items():
        company_val = kpi_flat.get(metric)
        label = _METRIC_LABELS.get(metric, metric)

        # Preskoči ako industrija nema podataka za tu metriku
        if p50 is None:
            metrics.append(MetricBenchmark(
                metric=metric, label=label,
                company_value=company_val,
                industry_p25=None, industry_median=None, industry_p75=None,
                percentile=None, higher_is_better=hib,
                assessment="neutral", assessment_label="Nema benchmark podataka",
            ))
            continue

        pct: Optional[int] = None
        if company_val is not None:
            pct = _percentile(company_val, p25, p50, p75)
            percentiles.append(pct if hib else (100 - pct))

        assessment_key, assessment_label = _assessment(pct, hib)

        metrics.append(MetricBenchmark(
            metric=metric, label=label,
            company_value=company_val,
            industry_p25=p25,
            industry_median=p50,
            industry_p75=p75,
            percentile=pct,
            higher_is_better=hib,
            assessment=assessment_key,
            assessment_label=assessment_label,
        ))

    # Ukupni percentil (prosjek dostupnih)
    overall = round(sum(percentiles) / len(percentiles)) if percentiles else None

    # Snage i slabosti
    strengths = [
        m.label for m in metrics
        if m.percentile is not None and m.assessment in ("strong", "above_avg")
        and m.higher_is_better and m.percentile >= 55
        or m.assessment in ("strong", "above_avg")
        and not m.higher_is_better and m.percentile is not None and m.percentile <= 45
    ]
    weaknesses = [
        m.label for m in metrics
        if m.percentile is not None and m.assessment in ("weak", "below_avg")
        and m.higher_is_better and m.percentile < 40
        or m.assessment in ("weak", "below_avg")
        and not m.higher_is_better and m.percentile is not None and m.percentile > 60
    ]

    return BenchmarkResult(
        company_id=company_id,
        fiscal_year=fiscal_year,
        industry=ind,
        metrics=metrics,
        overall_percentile=overall,
        strengths=strengths[:5],
        weaknesses=weaknesses[:5],
    )


def list_industries() -> list[str]:
    """Vraća listu podržanih industrija."""
    return sorted(_DB.keys())
