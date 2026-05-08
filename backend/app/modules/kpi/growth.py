from app.modules.kpi.financials import FinancialStatement


def _yoy(current: float | None, previous: float | None) -> float | None:
    if current is not None and previous and previous != 0:
        return round((current - previous) / abs(previous), 4)
    return None


def revenue_growth(current: FinancialStatement, previous: FinancialStatement) -> float | None:
    return _yoy(current.effective_revenue(), previous.effective_revenue())


def ebitda_growth(current: FinancialStatement, previous: FinancialStatement) -> float | None:
    c = current.ebitda
    p = previous.ebitda
    return _yoy(c, p)


def net_income_growth(current: FinancialStatement, previous: FinancialStatement) -> float | None:
    return _yoy(current.net_income, previous.net_income)


def asset_growth(current: FinancialStatement, previous: FinancialStatement) -> float | None:
    return _yoy(current.total_assets, previous.total_assets)


def cagr(first: float, last: float, years: int) -> float | None:
    """Compound Annual Growth Rate za 'years' perioda."""
    if first and first > 0 and last and years > 0:
        return round((last / first) ** (1 / years) - 1, 4)
    return None


def calculate(
    current: FinancialStatement,
    previous: FinancialStatement,
) -> dict[str, float | None]:
    return {
        "revenue_growth": revenue_growth(current, previous),
        "ebitda_growth": ebitda_growth(current, previous),
        "net_income_growth": net_income_growth(current, previous),
        "asset_growth": asset_growth(current, previous),
    }
