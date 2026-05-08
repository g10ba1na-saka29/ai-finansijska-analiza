from app.modules.kpi.financials import FinancialStatement


def _safe_div(num: float | None, den: float | None) -> float | None:
    if num is not None and den and den != 0:
        return round(num / den, 4)
    return None


def gross_margin(fs: FinancialStatement) -> float | None:
    rev = fs.effective_revenue()
    if fs.gross_profit is not None:
        return _safe_div(fs.gross_profit, rev)
    if fs.cogs is not None and rev:
        return _safe_div(rev - fs.cogs, rev)
    return None


def ebitda_margin(fs: FinancialStatement) -> float | None:
    if fs.ebitda is None and fs.ebit is not None and fs.depreciation_amortization is not None:
        ebitda = fs.ebit + fs.depreciation_amortization
        return _safe_div(ebitda, fs.effective_revenue())
    return _safe_div(fs.ebitda, fs.effective_revenue())


def ebit_margin(fs: FinancialStatement) -> float | None:
    return _safe_div(fs.ebit, fs.effective_revenue())


def net_margin(fs: FinancialStatement) -> float | None:
    return _safe_div(fs.net_income, fs.effective_revenue())


def roe(fs: FinancialStatement) -> float | None:
    return _safe_div(fs.net_income, fs.equity)


def roa(fs: FinancialStatement) -> float | None:
    return _safe_div(fs.net_income, fs.total_assets)


def calculate(fs: FinancialStatement) -> dict[str, float | None]:
    return {
        "gross_margin": gross_margin(fs),
        "ebitda_margin": ebitda_margin(fs),
        "ebit_margin": ebit_margin(fs),
        "net_margin": net_margin(fs),
        "roe": roe(fs),
        "roa": roa(fs),
    }
