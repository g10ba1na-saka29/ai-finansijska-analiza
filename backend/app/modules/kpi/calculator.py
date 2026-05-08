"""
Agregira sve KPI kategorije u jedan dict.
Koristi se direktno iz Celery taska.
"""

from typing import Any

from app.modules.kpi.financials import FinancialStatement, extract_from_raw
from app.modules.kpi import liquidity, profitability, leverage, cashflow, efficiency, growth


def calculate_all(
    raw_data: dict[str, Any],
    previous_raw_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Izračunava sve KPI metrike iz raw_data-a PDF parsera.

    Args:
        raw_data:          Normalized output tekuće godine.
        previous_raw_data: Normalized output prethodne godine (za growth metrike).

    Returns:
        Dict sa svim KPI kategorijama + raw financials.
    """
    fs = extract_from_raw(raw_data)
    fs_prev = extract_from_raw(previous_raw_data) if previous_raw_data else None

    result: dict[str, Any] = {
        "liquidity": liquidity.calculate(fs),
        "profitability": profitability.calculate(fs),
        "leverage": leverage.calculate(fs),
        "cashflow": cashflow.calculate(fs),
        "efficiency": efficiency.calculate(fs),
        "growth": growth.calculate(fs, fs_prev) if fs_prev else {},
        "raw_financials": fs.to_dict(),
    }

    return result


def flatten_kpis(kpi_data: dict[str, Any]) -> dict[str, float | None]:
    """Ravna strukturu KPI kategorija u jedan nivo za DB storage."""
    flat = {}
    for category, metrics in kpi_data.items():
        if isinstance(metrics, dict):
            flat.update(metrics)
    return flat
