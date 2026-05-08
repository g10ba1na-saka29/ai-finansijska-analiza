"""
Altman Z''-Score za privatne kompanije (ne-manufacturing).

Formula:
    Z'' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4

Gdje:
    X1 = Obrtni kapital / Ukupna imovina
    X2 = Zadržana dobit / Ukupna imovina
    X3 = EBIT / Ukupna imovina
    X4 = Knjigovodstvena vrijednost kapitala / Ukupne obaveze

Zone:
    Z'' > 2.60  → Sigurna zona
    Z'' 1.10–2.60 → Siva zona
    Z'' < 1.10  → Zona opasnosti
"""

from dataclasses import dataclass
from app.modules.kpi.financials import FinancialStatement


@dataclass
class AltmanResult:
    z_score: float | None
    zone: str           # "safe" | "grey" | "distress" | "insufficient_data"
    x1: float | None
    x2: float | None
    x3: float | None
    x4: float | None
    interpretation: str

    def to_dict(self) -> dict:
        return {
            "z_score": self.z_score,
            "zone": self.zone,
            "components": {"x1": self.x1, "x2": self.x2, "x3": self.x3, "x4": self.x4},
            "interpretation": self.interpretation,
        }


_ZONE_LABELS = {
    "safe": "Sigurna zona — nizak rizik od insolventnosti (Z'' > 2.60)",
    "grey": "Siva zona — umjeren rizik, potreban oprez (Z'' 1.10–2.60)",
    "distress": "Zona opasnosti — visok rizik od finansijskih poteškoća (Z'' < 1.10)",
    "insufficient_data": "Nedovoljno podataka za Altman Z-Score kalkulaciju",
}


def calculate(fs: FinancialStatement) -> AltmanResult:
    ta = fs.total_assets
    if not ta or ta == 0:
        return AltmanResult(None, "insufficient_data", None, None, None, None, _ZONE_LABELS["insufficient_data"])

    wc = fs.working_capital()
    re_ = fs.retained_earnings
    ebit = fs.ebit
    eq = fs.equity
    tl = fs.total_liabilities

    x1 = round(wc / ta, 4) if wc is not None else None
    x2 = round(re_ / ta, 4) if re_ is not None else None
    x3 = round(ebit / ta, 4) if ebit is not None else None
    x4 = round(eq / tl, 4) if (eq is not None and tl and tl != 0) else None

    # Barem 3 od 4 komponente moraju biti dostupne
    available = [x for x in [x1, x2, x3, x4] if x is not None]
    if len(available) < 3:
        return AltmanResult(None, "insufficient_data", x1, x2, x3, x4, _ZONE_LABELS["insufficient_data"])

    # Ako nedostaje neka komponenta, koristi 0 kao konzervativnu procjenu
    z = (
        6.56 * (x1 or 0)
        + 3.26 * (x2 or 0)
        + 6.72 * (x3 or 0)
        + 1.05 * (x4 or 0)
    )
    z = round(z, 4)

    if z > 2.60:
        zone = "safe"
    elif z >= 1.10:
        zone = "grey"
    else:
        zone = "distress"

    return AltmanResult(z, zone, x1, x2, x3, x4, _ZONE_LABELS[zone])
