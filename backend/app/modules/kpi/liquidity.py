from app.modules.kpi.financials import FinancialStatement


def current_ratio(fs: FinancialStatement) -> float | None:
    if fs.current_assets and fs.current_liabilities:
        return round(fs.current_assets / fs.current_liabilities, 4)
    return None


def quick_ratio(fs: FinancialStatement) -> float | None:
    if fs.current_assets and fs.current_liabilities:
        inventories = fs.inventories or 0.0
        return round((fs.current_assets - inventories) / fs.current_liabilities, 4)
    return None


def cash_ratio(fs: FinancialStatement) -> float | None:
    if fs.cash and fs.current_liabilities:
        return round(fs.cash / fs.current_liabilities, 4)
    return None


def calculate(fs: FinancialStatement) -> dict[str, float | None]:
    return {
        "current_ratio": current_ratio(fs),
        "quick_ratio": quick_ratio(fs),
        "cash_ratio": cash_ratio(fs),
    }
