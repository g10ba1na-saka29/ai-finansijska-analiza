"""
FinancialStatement dataclass + parser koji izvlači finansijske cifre iz
normalizovanog raw_data (output PDF parsera).
"""

import re
from dataclasses import dataclass, fields
from typing import Any


@dataclass
class FinancialStatement:
    # ── Income Statement ───────────────────────────────────────────────────────
    revenue: float | None = None
    total_revenue: float | None = None
    gross_profit: float | None = None
    cogs: float | None = None
    ebitda: float | None = None
    ebit: float | None = None
    net_income: float | None = None
    interest_expense: float | None = None
    income_tax: float | None = None
    depreciation_amortization: float | None = None
    operating_expenses: float | None = None
    financial_income: float | None = None
    financial_expenses: float | None = None
    ebt: float | None = None

    # ── Balance Sheet — Assets ─────────────────────────────────────────────────
    total_assets: float | None = None
    non_current_assets: float | None = None
    property_plant_equipment: float | None = None
    intangible_assets: float | None = None
    long_term_investments: float | None = None
    current_assets: float | None = None
    inventories: float | None = None
    receivables: float | None = None
    cash: float | None = None

    # ── Balance Sheet — Liabilities & Equity ──────────────────────────────────
    equity: float | None = None
    share_capital: float | None = None
    retained_earnings: float | None = None
    total_liabilities: float | None = None
    long_term_liabilities: float | None = None
    long_term_debt: float | None = None
    current_liabilities: float | None = None
    short_term_debt: float | None = None
    accounts_payable: float | None = None

    # ── Cash Flow ─────────────────────────────────────────────────────────────
    operating_cf: float | None = None
    investing_cf: float | None = None
    financing_cf: float | None = None
    capex: float | None = None

    def effective_revenue(self) -> float | None:
        return self.revenue or self.total_revenue

    def total_debt(self) -> float | None:
        lt = self.long_term_debt or 0.0
        st = self.short_term_debt or 0.0
        if lt == 0.0 and st == 0.0:
            return None
        return lt + st

    def working_capital(self) -> float | None:
        if self.current_assets is not None and self.current_liabilities is not None:
            return self.current_assets - self.current_liabilities
        return None

    def to_dict(self) -> dict[str, float | None]:
        return {f.name: getattr(self, f.name) for f in fields(self)}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_amount(value: Any) -> float | None:
    """Parsira finansijski iznos iz stringa (podržava BiH/RS/HR i EN format)."""
    if value is None:
        return None
    raw = str(value).strip()
    if raw in ("", "-", "/", "N/A", "n/a", "—"):
        return None

    negative = raw.startswith("(") or raw.startswith("-")
    cleaned = re.sub(r"[()%\s]", "", raw).lstrip("+-")

    if not cleaned:
        return None

    dot_pos = cleaned.rfind(".")
    comma_pos = cleaned.rfind(",")

    if dot_pos > comma_pos and comma_pos != -1:
        # EN format: 1,234,567.89 — ukloni zarez
        cleaned = cleaned.replace(",", "")
    elif comma_pos > dot_pos and dot_pos != -1:
        # BiH/DE format: 1.234.567,89 — ukloni tačku, zamijeni zarez
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif comma_pos != -1 and dot_pos == -1:
        # Samo zarez — ako je na 3 od kraja, separator hiljada; inače decimal
        after_comma = len(cleaned) - comma_pos - 1
        if after_comma == 3:
            cleaned = cleaned.replace(",", "")
        else:
            cleaned = cleaned.replace(",", ".")
    elif dot_pos != -1 and comma_pos == -1:
        # Samo tačka — ako je na 3 od kraja, separator hiljada
        after_dot = len(cleaned) - dot_pos - 1
        if after_dot == 3 and cleaned.count(".") == 1:
            cleaned = cleaned.replace(".", "")

    try:
        result = float(cleaned)
        return -result if negative else result
    except ValueError:
        return None


_FS_FIELDS = {f.name for f in fields(FinancialStatement)}


def extract_from_raw(raw_data: dict[str, Any]) -> FinancialStatement:
    """
    Ekstrahuje FinancialStatement iz raw_data-a PDF parsera.

    Traži po normalizovanim ključevima kroz sve tabele.
    Prva pronađena ne-None vrijednost se koristi.
    """
    collected: dict[str, float] = {}

    for table in raw_data.get("tables", []):
        for row in table.get("rows_normalized", []):
            for key, val in row.items():
                if key in _FS_FIELDS and key not in collected:
                    parsed = _parse_amount(val)
                    if parsed is not None:
                        collected[key] = parsed

    return FinancialStatement(**{k: v for k, v in collected.items() if k in _FS_FIELDS})
