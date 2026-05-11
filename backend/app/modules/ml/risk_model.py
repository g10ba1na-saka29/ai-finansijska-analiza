"""
Piotroski F-Score i probabilistički model finansijske uznemirenosti.

Piotroski F-Score (0–9 bodova):
  Profitabilnost (F1–F4):
    F1: ROA > 0
    F2: OCF margin > 0
    F3: ROA poboljšan YoY
    F4: Kvalitet zarade — OCF margin > neto margin

  Leverage/Likvidnost (F5–F7):
    F5: Debt ratio smanjen YoY
    F6: Current ratio poboljšan YoY
    F7: Equity ratio stabilan ili poboljšan (proxy za ne-diluciju)

  Operativna efikasnost (F8–F9):
    F8: Bruto marža poboljšana YoY
    F9: Asset turnover poboljšan YoY

Interpretacija:
  7–9 bodova → Jaka kompanija (strong)
  3–6 bodova → Neutralna (neutral)
  0–2 boda   → Slaba / ugrožena (weak)

Distress probability se računa kombinacijom Altman Z-zone i Piotroski kategorije.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ── Dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class PiotroskiSignal:
    name: str               # F1 … F9
    description: str
    passed: bool
    value: Optional[float] = None   # razlika ili apsolutna vrijednost


@dataclass
class PiotroskiResult:
    score: int                             # broj prošlih signala (0–9)
    available: int                         # broj evaluiranih signala (može biti < 9 ako nema prev)
    category: str                          # "strong" | "neutral" | "weak"
    signals: list[PiotroskiSignal] = field(default_factory=list)


@dataclass
class BankruptcyRiskResult:
    company_id: str
    fiscal_year: int
    piotroski: PiotroskiResult
    altman_z_score: Optional[float]
    altman_zone: Optional[str]            # "safe" | "grey" | "distress"
    distress_probability: float           # 0.0 – 1.0
    distress_label: str                   # very_low | low | moderate | high | very_high
    risk_factors: list[str] = field(default_factory=list)
    positive_factors: list[str] = field(default_factory=list)


# ── Piotroski F-Score ─────────────────────────────────────────────────────────

def piotroski_fscore(kpi: dict, prev_kpi: Optional[dict]) -> PiotroskiResult:
    """
    Izračunava Piotroski F-Score iz flat KPI rječnika.
    Signali koji zahtijevaju prethodnu godinu se preskače ako prev_kpi = None.
    """
    signals: list[PiotroskiSignal] = []
    passed = 0
    available = 0

    def _add(name: str, desc: str, condition: Optional[bool], value: Optional[float] = None) -> None:
        nonlocal passed, available
        if condition is None:
            return
        available += 1
        if condition:
            passed += 1
        signals.append(PiotroskiSignal(name=name, description=desc, passed=condition, value=value))

    roa         = kpi.get("roa")
    ocf_margin  = kpi.get("ocf_margin")
    net_margin  = kpi.get("net_margin")
    gross_margin = kpi.get("gross_margin")
    debt_ratio  = kpi.get("debt_ratio")
    eq_ratio    = kpi.get("equity_ratio")
    cur_ratio   = kpi.get("current_ratio")
    asset_turn  = kpi.get("asset_turnover")

    p_roa        = prev_kpi.get("roa")          if prev_kpi else None
    p_gross      = prev_kpi.get("gross_margin") if prev_kpi else None
    p_debt       = prev_kpi.get("debt_ratio")   if prev_kpi else None
    p_eq         = prev_kpi.get("equity_ratio") if prev_kpi else None
    p_cur        = prev_kpi.get("current_ratio") if prev_kpi else None
    p_asset_turn = prev_kpi.get("asset_turnover") if prev_kpi else None

    # F1: ROA > 0
    _add("F1", "ROA pozitivan (profitabilnost imovine)",
         roa > 0 if roa is not None else None, roa)

    # F2: OCF margin > 0
    _add("F2", "Pozitivan operativni novčani tok",
         ocf_margin > 0 if ocf_margin is not None else None, ocf_margin)

    # F3: ROA poboljšan YoY
    if roa is not None and p_roa is not None:
        _add("F3", "ROA poboljšan u odnosu na prethodnu godinu",
             roa > p_roa, roa - p_roa)

    # F4: OCF margin > neto margin (kvalitet zarade)
    if ocf_margin is not None and net_margin is not None:
        _add("F4", "Kvalitet zarade: OCF margin veći od neto margine",
             ocf_margin > net_margin, ocf_margin - net_margin)

    # F5: Debt ratio smanjen YoY (leverage manji)
    if debt_ratio is not None and p_debt is not None:
        _add("F5", "Zaduženost smanjena u odnosu na prethodnu godinu",
             debt_ratio < p_debt, p_debt - debt_ratio)

    # F6: Current ratio poboljšan YoY
    if cur_ratio is not None and p_cur is not None:
        _add("F6", "Current ratio poboljšan u odnosu na prethodnu godinu",
             cur_ratio > p_cur, cur_ratio - p_cur)

    # F7: Equity ratio stabilan ili rastući (proxy za bez dilucije)
    if eq_ratio is not None and p_eq is not None:
        _add("F7", "Udio kapitala u aktivi stabilan ili porastao",
             eq_ratio >= p_eq - 0.02, eq_ratio - p_eq)

    # F8: Bruto marža poboljšana YoY
    if gross_margin is not None and p_gross is not None:
        _add("F8", "Bruto marža poboljšana u odnosu na prethodnu godinu",
             gross_margin > p_gross, gross_margin - p_gross)

    # F9: Asset turnover poboljšan YoY
    if asset_turn is not None and p_asset_turn is not None:
        _add("F9", "Efikasnost imovine (asset turnover) poboljšana",
             asset_turn > p_asset_turn, asset_turn - p_asset_turn)

    # Kategorija — normalizovana na 9 ako je dostupno manje signala
    if available == 0:
        category = "neutral"
    else:
        norm = round(passed / available * 9) if available < 9 else passed
        category = "strong" if norm >= 7 else ("weak" if norm <= 2 else "neutral")

    return PiotroskiResult(score=passed, available=available, category=category, signals=signals)


# ── Distress probability ──────────────────────────────────────────────────────

_PROB_MATRIX: dict[tuple[str, str], float] = {
    # (altman_zone, piotroski_category): base_probability
    ("distress", "weak"):    0.82,
    ("distress", "neutral"): 0.65,
    ("distress", "strong"):  0.45,
    ("grey",     "weak"):    0.52,
    ("grey",     "neutral"): 0.30,
    ("grey",     "strong"):  0.14,
    ("safe",     "weak"):    0.18,
    ("safe",     "neutral"): 0.09,
    ("safe",     "strong"):  0.04,
}


def _label_from_prob(p: float) -> str:
    if p >= 0.70:
        return "very_high"
    if p >= 0.40:
        return "high"
    if p >= 0.20:
        return "moderate"
    if p >= 0.08:
        return "low"
    return "very_low"


def calculate_bankruptcy_risk(
    company_id: str,
    fiscal_year: int,
    kpi: dict,
    prev_kpi: Optional[dict],
    altman_z_score: Optional[float] = None,
    altman_zone: Optional[str] = None,
) -> BankruptcyRiskResult:
    """
    Izračunava probabilistički rizik od finansijskog sloma.
    Kombinuje Piotroski F-Score s Altman Z-Score.
    """
    pio = piotroski_fscore(kpi, prev_kpi)

    # Normalizuj Altman zone
    z = altman_z_score or 0.0
    if altman_zone is None:
        altman_zone = "distress" if z < 1.8 else ("grey" if z < 2.9 else "safe")

    base_prob = _PROB_MATRIX.get((altman_zone, pio.category), 0.30)

    # Korekcije na osnovu apsolutnih signala
    cr  = kpi.get("current_ratio", 1.5)
    ic  = kpi.get("interest_coverage")
    dte = kpi.get("debt_to_equity")

    if cr is not None and cr < 0.5:
        base_prob = min(1.0, base_prob + 0.18)
    if ic is not None and ic < 1.0:
        base_prob = min(1.0, base_prob + 0.22)
    if dte is not None and dte > 10.0:
        base_prob = min(1.0, base_prob + 0.15)

    prob  = round(base_prob, 3)
    label = _label_from_prob(prob)

    # ── Faktori rizika i pozitivni faktori ────────────────────────────────────

    risk_factors: list[str] = []
    positive_factors: list[str] = []

    # Altman
    if altman_zone == "distress":
        risk_factors.append(f"Altman Z-Score ({z:.2f}) u zoni opasnosti (< 1.8)")
    elif altman_zone == "grey":
        risk_factors.append(f"Altman Z-Score ({z:.2f}) u sivoj zoni (1.8 – 2.9)")
    else:
        positive_factors.append(f"Altman Z-Score ({z:.2f}) u sigurnoj zoni (> 2.9)")

    # Piotroski signali
    for sig in pio.signals:
        if not sig.passed:
            risk_factors.append(f"Piotroski {sig.name}: {sig.description} — nije zadovoljeno")
        elif len(positive_factors) < 4:
            positive_factors.append(f"Piotroski {sig.name}: {sig.description}")

    # Apsolutni rizici
    if dte is not None and dte > 3.0:
        risk_factors.append(f"Visok D/E ratio ({dte:.1f}x)")
    if cr is not None and cr < 0.8:
        risk_factors.append(f"Nizak current ratio ({cr:.2f})")
    if ic is not None and ic < 2.0:
        risk_factors.append(f"Nizak interest coverage ({ic:.1f}x)")

    return BankruptcyRiskResult(
        company_id=company_id,
        fiscal_year=fiscal_year,
        piotroski=pio,
        altman_z_score=altman_z_score,
        altman_zone=altman_zone,
        distress_probability=prob,
        distress_label=label,
        risk_factors=risk_factors[:8],
        positive_factors=positive_factors[:5],
    )
