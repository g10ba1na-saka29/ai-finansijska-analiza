from app.modules.kpi.financials import FinancialStatement


def debt_to_equity(fs: FinancialStatement) -> float | None:
    debt = fs.total_debt()
    if debt is not None and fs.equity and fs.equity != 0:
        return round(debt / fs.equity, 4)
    # Fallback: ukupne obaveze / kapital
    if fs.total_liabilities and fs.equity and fs.equity != 0:
        return round(fs.total_liabilities / fs.equity, 4)
    return None


def interest_coverage(fs: FinancialStatement) -> float | None:
    ebit = fs.ebit
    if ebit is None and fs.ebitda and fs.depreciation_amortization:
        ebit = fs.ebitda - fs.depreciation_amortization
    if ebit is not None and fs.interest_expense and fs.interest_expense != 0:
        return round(ebit / fs.interest_expense, 4)
    return None


def debt_ratio(fs: FinancialStatement) -> float | None:
    if fs.total_liabilities and fs.total_assets and fs.total_assets != 0:
        return round(fs.total_liabilities / fs.total_assets, 4)
    return None


def equity_ratio(fs: FinancialStatement) -> float | None:
    if fs.equity and fs.total_assets and fs.total_assets != 0:
        return round(fs.equity / fs.total_assets, 4)
    return None


def calculate(fs: FinancialStatement) -> dict[str, float | None]:
    return {
        "debt_to_equity": debt_to_equity(fs),
        "interest_coverage": interest_coverage(fs),
        "debt_ratio": debt_ratio(fs),
        "equity_ratio": equity_ratio(fs),
    }
