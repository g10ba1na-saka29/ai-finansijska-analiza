from app.modules.kpi.financials import FinancialStatement


def asset_turnover(fs: FinancialStatement) -> float | None:
    rev = fs.effective_revenue()
    if rev and fs.total_assets and fs.total_assets != 0:
        return round(rev / fs.total_assets, 4)
    return None


def receivables_turnover(fs: FinancialStatement) -> float | None:
    rev = fs.effective_revenue()
    if rev and fs.receivables and fs.receivables != 0:
        return round(rev / fs.receivables, 4)
    return None


def days_sales_outstanding(fs: FinancialStatement) -> float | None:
    rt = receivables_turnover(fs)
    if rt and rt != 0:
        return round(365 / rt, 1)
    return None


def inventory_turnover(fs: FinancialStatement) -> float | None:
    cogs = fs.cogs
    if cogs is None:
        rev = fs.effective_revenue()
        if rev and fs.gross_profit is not None:
            cogs = rev - fs.gross_profit
    if cogs and fs.inventories and fs.inventories != 0:
        return round(cogs / fs.inventories, 4)
    return None


def days_inventory_outstanding(fs: FinancialStatement) -> float | None:
    it = inventory_turnover(fs)
    if it and it != 0:
        return round(365 / it, 1)
    return None


def calculate(fs: FinancialStatement) -> dict[str, float | None]:
    return {
        "asset_turnover": asset_turnover(fs),
        "receivables_turnover": receivables_turnover(fs),
        "days_sales_outstanding": days_sales_outstanding(fs),
        "inventory_turnover": inventory_turnover(fs),
        "days_inventory_outstanding": days_inventory_outstanding(fs),
    }
