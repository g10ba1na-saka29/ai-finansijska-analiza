import logging
from datetime import datetime, timezone
from uuid import UUID

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_db():
    from app.database import SyncSessionLocal
    return SyncSessionLocal()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def calculate_kpis_and_score(self, company_id: str, fiscal_year: int) -> dict:
    """
    Učitava raw_data iz FinancialReport, računa KPI + score i upisuje u bazu.
    Traži i prethodnu godinu za growth metrike.
    """
    from app.models.financial_report import FinancialReport
    from app.models.kpi_snapshot import KPISnapshot
    from app.models.company_score import CompanyScore
    from app.models.company import Company
    from app.modules.kpi.calculator import calculate_all, flatten_kpis
    from app.modules.kpi.financials import extract_from_raw
    from app.modules.scoring.composite_score import calculate as calc_score

    db = _get_db()
    try:
        # Dohvati kompaniju
        company = db.query(Company).filter_by(id=company_id).first()
        if not company:
            return {"status": "error", "message": "Company not found"}

        # Dohvati izvještaj tekuće godine (preferiramo balance_sheet ili income)
        report = (
            db.query(FinancialReport)
            .filter_by(company_id=company_id, fiscal_year=fiscal_year, status="done")
            .order_by(FinancialReport.uploaded_at.desc())
            .first()
        )
        if not report or not report.raw_data:
            return {"status": "error", "message": f"No processed report for {fiscal_year}"}

        # Prethodna godina za growth metrike
        prev_report = (
            db.query(FinancialReport)
            .filter_by(company_id=company_id, fiscal_year=fiscal_year - 1, status="done")
            .order_by(FinancialReport.uploaded_at.desc())
            .first()
        )
        prev_raw = prev_report.raw_data if prev_report else None

        # Izračunaj KPI
        kpi_data = calculate_all(report.raw_data, prev_raw)
        flat = flatten_kpis(kpi_data)

        # Upsert KPISnapshot
        snap = db.query(KPISnapshot).filter_by(company_id=company_id, fiscal_year=fiscal_year).first()
        if not snap:
            snap = KPISnapshot(company_id=UUID(company_id), fiscal_year=fiscal_year)
            db.add(snap)

        snap.current_ratio = flat.get("current_ratio")
        snap.quick_ratio = flat.get("quick_ratio")
        snap.cash_ratio = flat.get("cash_ratio")
        snap.gross_margin = flat.get("gross_margin")
        snap.ebitda_margin = flat.get("ebitda_margin")
        snap.ebit_margin = flat.get("ebit_margin")
        snap.net_margin = flat.get("net_margin")
        snap.roe = flat.get("roe")
        snap.roa = flat.get("roa")
        snap.debt_to_equity = flat.get("debt_to_equity")
        snap.interest_coverage = flat.get("interest_coverage")
        snap.debt_ratio = flat.get("debt_ratio")
        snap.equity_ratio = flat.get("equity_ratio")
        snap.revenue_growth = flat.get("revenue_growth")
        snap.ebitda_growth = flat.get("ebitda_growth")
        snap.net_income_growth = flat.get("net_income_growth")
        snap.asset_growth = flat.get("asset_growth")
        snap.free_cash_flow = flat.get("free_cash_flow")
        snap.ocf_margin = flat.get("ocf_margin")
        snap.cash_to_debt = flat.get("cash_to_debt")
        snap.ocf_to_current_liabilities = flat.get("ocf_to_current_liabilities")
        snap.asset_turnover = flat.get("asset_turnover")
        snap.receivables_turnover = flat.get("receivables_turnover")
        snap.days_sales_outstanding = flat.get("days_sales_outstanding")
        snap.inventory_turnover = flat.get("inventory_turnover")
        snap.days_inventory_outstanding = flat.get("days_inventory_outstanding")
        snap.raw_financials = kpi_data.get("raw_financials")
        snap.calculated_at = datetime.now(timezone.utc)
        db.flush()

        # Izračunaj Score
        fs = extract_from_raw(report.raw_data)
        score_result = calc_score(kpi_data, fs, industry=company.industry)

        score = db.query(CompanyScore).filter_by(company_id=company_id, fiscal_year=fiscal_year).first()
        if not score:
            score = CompanyScore(company_id=UUID(company_id), fiscal_year=fiscal_year)
            db.add(score)

        score.total_score = score_result.total
        score.risk_level = score_result.risk_level
        score.liquidity_score = score_result.liquidity
        score.profitability_score = score_result.profitability
        score.leverage_score = score_result.leverage
        score.growth_score = score_result.growth
        score.cashflow_score = score_result.cashflow
        score.altman_data = score_result.altman
        score.breakdown = score_result.breakdown
        score.calculated_at = datetime.now(timezone.utc)

        db.commit()

        # Invaliduj Redis cache za ovu kompaniju/godinu
        try:
            from app.core.cache import invalidate_company_sync
            invalidate_company_sync(company_id, fiscal_year)
        except Exception as ce:
            logger.warning(f"Cache invalidacija neuspješna (nefatalno): {ce}")

        # Dispatch webhook event
        try:
            from app.workers.tasks.webhook_delivery import dispatch_webhook_event
            dispatch_webhook_event.delay(
                "kpi.calculated",
                str(company.org_id),
                {
                    "company_id": company_id,
                    "company_name": company.name,
                    "fiscal_year": fiscal_year,
                    "total_score": score_result.total,
                    "risk_level": score_result.risk_level,
                },
            )
        except Exception as we:
            logger.warning(f"Webhook dispatch neuspješan (nefatalno): {we}")

        logger.info(f"KPI+Score kalkulacija završena: company={company_id}, year={fiscal_year}, score={score_result.total}")
        return {
            "status": "done",
            "company_id": company_id,
            "fiscal_year": fiscal_year,
            "total_score": score_result.total,
            "risk_level": score_result.risk_level,
        }

    except Exception as exc:
        db.rollback()
        logger.error(f"KPI kalkulacija failed: {exc}", exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()
