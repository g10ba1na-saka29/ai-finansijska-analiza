from app.modules.kpi.financials import FinancialStatement


def free_cash_flow(fs: FinancialStatement) -> float | None:
    if fs.operating_cf is not None and fs.capex is not None:
        return round(fs.operating_cf - abs(fs.capex), 2)
    return None


def ocf_margin(fs: FinancialStatement) -> float | None:
    rev = fs.effective_revenue()
    if fs.operating_cf is not None and rev and rev != 0:
        return round(fs.operating_cf / rev, 4)
    return None


def cash_to_debt(fs: FinancialStatement) -> float | None:
    debt = fs.total_debt() or fs.total_liabilities
    if fs.cash and debt and debt != 0:
        return round(fs.cash / debt, 4)
    return None


def operating_cf_to_current_liabilities(fs: FinancialStatement) -> float | None:
    if fs.operating_cf is not None and fs.current_liabilities and fs.current_liabilities != 0:
        return round(fs.operating_cf / fs.current_liabilities, 4)
    return None


def calculate(fs: FinancialStatement) -> dict[str, float | None]:
    return {
        "free_cash_flow": free_cash_flow(fs),
        "ocf_margin": ocf_margin(fs),
        "cash_to_debt": cash_to_debt(fs),
        "ocf_to_current_liabilities": operating_cf_to_current_liabilities(fs),
    }
