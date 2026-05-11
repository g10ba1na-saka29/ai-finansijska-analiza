"""
Detekcija finansijskih anomalija.

Tri metode (kombinovano):
  1. Rule-based — apsolutni pragovi (negativan kapital, IC < 1, CR < 0.5...)
  2. YoY threshold — nagla promjena >50% / >100% u ključnim metrikama
  3. IsolationForest — ako ima >= 5 peer kompanija u istoj industriji

Svaka anomalija ima severity: critical | high | medium | low
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── Pragovi ───────────────────────────────────────────────────────────────────

_YOY_HIGH       = 0.50   # >50 % YoY promjena → high
_YOY_CRITICAL   = 1.00   # >100 % YoY promjena → critical
_IQR_FENCE      = 3.0    # outlier fence: Q1 - 3*IQR ili Q3 + 3*IQR

_SEVERITY_WEIGHT = {"critical": 30, "high": 15, "medium": 8, "low": 3}


# ── Dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class AnomalyFlag:
    metric: str
    label: str
    severity: str          # critical | high | medium | low
    anomaly_type: str      # yoy_change | absolute_threshold | industry_outlier | isolation_forest | combined
    description: str
    value: Optional[float] = None
    previous_value: Optional[float] = None
    industry_norm: Optional[float] = None


@dataclass
class AnomalyResult:
    company_id: str
    fiscal_year: int
    anomalies: list[AnomalyFlag]
    risk_score: int        # 0–100 (zbroj severity weighta)
    summary: str
    methods_used: list[str] = field(default_factory=list)


# ── Interni helperi ───────────────────────────────────────────────────────────

def _pct_change(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    if curr is None or prev is None or prev == 0:
        return None
    return (curr - prev) / abs(prev)


def _check_yoy(
    metric: str,
    label: str,
    curr: Optional[float],
    prev: Optional[float],
    higher_is_better: bool = True,
) -> Optional[AnomalyFlag]:
    pct = _pct_change(curr, prev)
    if pct is None or abs(pct) < _YOY_HIGH:
        return None

    severity    = "critical" if abs(pct) >= _YOY_CRITICAL else "high"
    direction   = "porastao" if pct > 0 else "pao"
    a_type      = "yoy_change"

    # Za metriku gdje je niža vrijednost bolja (npr. debt), invertiraj semantiku
    if not higher_is_better:
        direction = "pogoršao se" if pct > 0 else "poboljšao se"

    desc = f"{label} {direction} za {abs(pct)*100:.0f} % u odnosu na prethodnu godinu"
    return AnomalyFlag(metric, label, severity, a_type, desc, curr, prev)


def _check_industry_outlier(
    metric: str,
    label: str,
    value: Optional[float],
    p25: Optional[float],
    median: Optional[float],
    p75: Optional[float],
    higher_is_better: bool = True,
) -> Optional[AnomalyFlag]:
    if any(v is None for v in (value, p25, median, p75)):
        return None
    iqr = p75 - p25  # type: ignore[operator]
    if iqr == 0:
        return None
    lower_fence = p25 - _IQR_FENCE * iqr   # type: ignore[operator]
    upper_fence = p75 + _IQR_FENCE * iqr   # type: ignore[operator]
    if lower_fence <= value <= upper_fence:  # type: ignore[operator]
        return None

    is_above = value > upper_fence  # type: ignore[operator]
    if is_above:
        direction = "daleko iznad" if higher_is_better else "ekstremno visok (negativno)"
        severity  = "medium" if higher_is_better else "high"
    else:
        direction = "daleko ispod" if higher_is_better else "daleko ispod (pozitivno)"
        severity  = "high" if higher_is_better else "medium"

    desc = (
        f"{label} ({value:.3f}) je {direction} industrijskog prosjeka "
        f"(median: {median:.3f}, IQR fence: [{lower_fence:.3f}, {upper_fence:.3f}])"
    )
    return AnomalyFlag(metric, label, severity, "industry_outlier", desc, value, None, median)


# ── Isolation Forest ──────────────────────────────────────────────────────────

_IF_FEATURES = [
    "ebitda_margin", "net_margin", "current_ratio",
    "debt_to_equity", "roa", "ocf_margin", "asset_turnover",
]


def _isolation_forest(kpi: dict, peers: list[dict]) -> list[AnomalyFlag]:
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        logger.warning("scikit-learn nije dostupan — Isolation Forest preskočen")
        return []

    # Gradi matricu: peers + target (zadnji red)
    rows: list[list[float]] = []
    for k in [*peers, kpi]:
        row = [k.get(f) for f in _IF_FEATURES]
        if any(v is None for v in row):
            continue
        rows.append([float(v) for v in row])  # type: ignore[arg-type]

    if len(rows) < 6:   # treba bar 5 peera + target
        return []

    X = np.array(rows)
    clf = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
    clf.fit(X)

    target_row = [kpi.get(f) for f in _IF_FEATURES]
    if any(v is None for v in target_row):
        return []

    pred  = clf.predict([[float(v) for v in target_row]])[0]   # type: ignore[arg-type]
    score = clf.decision_function([[float(v) for v in target_row]])[0]  # type: ignore[arg-type]

    if pred == -1:
        severity = "high" if score < -0.15 else "medium"
        desc = (
            f"Financijski profil kompanije je outlier unutar industrije "
            f"(IF decision score: {score:.3f}; analizirano {len(peers)} peer kompanija)"
        )
        return [AnomalyFlag(
            metric="composite_profile",
            label="Financijski profil (IF)",
            severity=severity,
            anomaly_type="isolation_forest",
            description=desc,
            value=round(score, 4),
        )]
    return []


# ── Glavna funkcija ───────────────────────────────────────────────────────────

def detect_anomalies(
    kpi: dict,
    prev_kpi: Optional[dict],
    company_id: str,
    fiscal_year: int,
    industry_benchmarks: Optional[dict] = None,
    peer_kpis: Optional[list[dict]] = None,
) -> AnomalyResult:
    """
    Detektuje finansijske anomalije kombinacijom rule-based, statističkih
    i ML metoda.

    Args:
        kpi:                 Dict KPI vrijednosti za tekuću godinu
        prev_kpi:            Dict KPI vrijednosti za prethodnu godinu (može biti None)
        company_id:          UUID string
        fiscal_year:         Fiskalna godina
        industry_benchmarks: Rječnik s listom metrika (format iz benchmarks route)
        peer_kpis:           KPI diktovi peer kompanija iste industrije (za IF)
    """
    flags: list[AnomalyFlag] = []
    methods: list[str] = ["rule_based"]

    # ── 1. Apsolutni pragovi ────────────────────────────────────────────────────

    cr  = kpi.get("current_ratio")
    ic  = kpi.get("interest_coverage")
    dte = kpi.get("debt_to_equity")
    fcf = kpi.get("free_cash_flow")
    rev = kpi.get("revenue_growth")

    if cr is not None and cr < 0.5:
        sev = "critical" if cr < 0.3 else "high"
        flags.append(AnomalyFlag(
            "current_ratio", "Current Ratio", sev, "absolute_threshold",
            f"Kritično nizak current ratio ({cr:.2f}) — rizik neplaćanja kratkoročnih obaveza",
            cr,
        ))

    if ic is not None and ic < 1.0:
        sev = "critical" if ic <= 0 else "high"
        flags.append(AnomalyFlag(
            "interest_coverage", "Interest Coverage", sev, "absolute_threshold",
            f"Interest coverage {ic:.2f} — EBIT ne pokriva kamate",
            ic,
        ))

    if dte is not None and dte > 10.0:
        flags.append(AnomalyFlag(
            "debt_to_equity", "Dug/Kapital", "critical", "absolute_threshold",
            f"Ekstremno visok D/E ({dte:.1f}x) — vjerovatno negativan kapital",
            dte,
        ))
    elif dte is not None and dte > 4.0:
        flags.append(AnomalyFlag(
            "debt_to_equity", "Dug/Kapital", "high", "absolute_threshold",
            f"Visok D/E ({dte:.1f}x) — povišen finansijski leverage",
            dte,
        ))

    if fcf is not None and fcf < 0 and rev is not None and rev < -0.10:
        flags.append(AnomalyFlag(
            "free_cash_flow", "Free Cash Flow", "high", "combined",
            f"Negativan FCF uz pad prihoda ({rev*100:.1f} %) — dupli stres signal",
            fcf,
        ))

    # ── 2. YoY anomalije ────────────────────────────────────────────────────────

    if prev_kpi:
        methods.append("yoy_threshold")
        yoy_checks = [
            ("ebitda_margin",  "EBITDA Margin",      True),
            ("net_margin",     "Neto Margin",         True),
            ("revenue_growth", "Rast Prihoda",        True),
            ("debt_to_equity", "Dug/Kapital",         False),
            ("current_ratio",  "Current Ratio",       True),
            ("roa",            "ROA",                 True),
            ("ocf_margin",     "OCF Margin",          True),
        ]
        existing = {f.metric for f in flags}
        for metric, label, hib in yoy_checks:
            if metric in existing:
                continue
            flag = _check_yoy(metric, label, kpi.get(metric), prev_kpi.get(metric), hib)
            if flag:
                flags.append(flag)

    # ── 3. Industry outlier (IQR fence) ────────────────────────────────────────

    if industry_benchmarks and industry_benchmarks.get("metrics"):
        methods.append("industry_comparison")
        bm_map = {m["metric"]: m for m in industry_benchmarks["metrics"]}
        existing = {f.metric for f in flags}
        outlier_checks = [
            ("ebitda_margin",  "EBITDA Margin",  True),
            ("net_margin",     "Neto Margin",     True),
            ("debt_to_equity", "Dug/Kapital",     False),
            ("current_ratio",  "Current Ratio",   True),
            ("roa",            "ROA",             True),
        ]
        for metric, label, hib in outlier_checks:
            if metric in existing:
                continue
            bm = bm_map.get(metric)
            if not bm:
                continue
            flag = _check_industry_outlier(
                metric, label, kpi.get(metric),
                bm.get("industry_p25"), bm.get("industry_median"), bm.get("industry_p75"),
                hib,
            )
            if flag:
                flags.append(flag)

    # ── 4. Isolation Forest ─────────────────────────────────────────────────────

    if peer_kpis and len(peer_kpis) >= 5:
        methods.append("isolation_forest")
        existing = {f.metric for f in flags}
        if_flags = _isolation_forest(kpi, peer_kpis)
        for flag in if_flags:
            if flag.metric not in existing:
                flags.append(flag)

    # ── Risk score i summary ────────────────────────────────────────────────────

    risk_score = min(100, sum(_SEVERITY_WEIGHT.get(f.severity, 5) for f in flags))

    n_crit = sum(1 for f in flags if f.severity == "critical")
    n_high = sum(1 for f in flags if f.severity == "high")

    if not flags:
        summary = "Nisu detektovane finansijske anomalije."
    elif n_crit > 0:
        summary = (
            f"Detektovano {len(flags)} anomalija, od kojih {n_crit} kritičnih — "
            "hitna analiza potrebna."
        )
    elif n_high > 0:
        summary = f"Detektovano {len(flags)} anomalija visokog prioriteta — preporučena analiza."
    else:
        summary = f"Detektovano {len(flags)} manjih anomalija — preporučen monitoring."

    return AnomalyResult(
        company_id=company_id,
        fiscal_year=fiscal_year,
        anomalies=flags,
        risk_score=risk_score,
        summary=summary,
        methods_used=methods,
    )
