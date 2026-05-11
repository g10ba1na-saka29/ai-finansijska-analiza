import logging
from datetime import datetime, timezone
from uuid import UUID

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_db():
    from app.database import SyncSessionLocal
    return SyncSessionLocal()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_forecast(self, company_id: str, horizon: int = 3) -> dict:
    """
    Generira ML prognozu za kompaniju na osnovu svih dostupnih KPI snapshotova.

    Koraci:
    1. Učitaj sve KPI snapshots za kompaniju (sortirano ASC po godini)
    2. Ekstrahuj historijske financijske tačke iz raw_financials
    3. Pokreni OLS forecast
    4. Upsert Forecast record u bazu
    """
    from app.models.kpi_snapshot import KPISnapshot
    from app.models.forecast import Forecast
    from app.modules.ml.forecasting import forecast, HistoricalPoint

    db = _get_db()
    try:
        # Dohvati sve KPI snapshots, sortirane ASC
        snaps = (
            db.query(KPISnapshot)
            .filter_by(company_id=company_id)
            .order_by(KPISnapshot.fiscal_year)
            .all()
        )

        if not snaps:
            return {"status": "error", "message": "Nema KPI podataka za prognozu"}

        # Izgradi historijske tačke
        historical: list[HistoricalPoint] = []
        for snap in snaps:
            rf = snap.raw_financials or {}
            revenue = rf.get("revenue") or rf.get("total_revenue")
            ebitda = rf.get("ebitda")
            net_income = rf.get("net_income")
            total_assets = rf.get("total_assets")

            # Fallback: izračunaj ebitda iz ebitda_margin × revenue
            if ebitda is None and snap.ebitda_margin is not None and revenue:
                ebitda = float(snap.ebitda_margin) * revenue

            # Fallback: net_income iz net_margin × revenue
            if net_income is None and snap.net_margin is not None and revenue:
                net_income = float(snap.net_margin) * revenue

            historical.append(HistoricalPoint(
                year=snap.fiscal_year,
                revenue=float(revenue) if revenue is not None else None,
                ebitda=float(ebitda) if ebitda is not None else None,
                net_income=float(net_income) if net_income is not None else None,
                total_assets=float(total_assets) if total_assets is not None else None,
            ))

        result = forecast(
            company_id=company_id,
            historical=historical,
            horizon=horizon,
        )

        # Serijaliziraj predictions u JSON-friendly format
        predictions_json = [
            {
                "year": p.year,
                "revenue": p.revenue,
                "revenue_low": p.revenue_low,
                "revenue_high": p.revenue_high,
                "ebitda": p.ebitda,
                "ebitda_low": p.ebitda_low,
                "ebitda_high": p.ebitda_high,
                "net_income": p.net_income,
                "net_income_low": p.net_income_low,
                "net_income_high": p.net_income_high,
                "ebitda_margin": p.ebitda_margin,
                "net_margin": p.net_margin,
            }
            for p in result.predictions
        ]

        historical_json = [
            {
                "year": h.year,
                "revenue": h.revenue,
                "ebitda": h.ebitda,
                "net_income": h.net_income,
                "total_assets": h.total_assets,
            }
            for h in result.historical
        ]

        # Upsert — jedan record po kompaniji (uvijek najsvježiji)
        fc = db.query(Forecast).filter_by(company_id=company_id).first()
        if not fc:
            fc = Forecast(company_id=UUID(company_id))
            db.add(fc)

        fc.base_year = result.base_year
        fc.horizon = result.horizon
        fc.method = result.method
        fc.data_points = result.data_points
        fc.predictions = predictions_json
        fc.historical_summary = historical_json
        fc.revenue_r_squared = result.revenue_r_squared
        fc.revenue_cagr = result.revenue_cagr
        fc.generated_at = datetime.now(timezone.utc)

        db.commit()

        logger.info(
            f"Forecast generisan: company={company_id}, "
            f"base={result.base_year}, horizon={horizon}, "
            f"method={result.method}, points={result.data_points}"
        )
        return {
            "status": "done",
            "company_id": company_id,
            "base_year": result.base_year,
            "horizon": horizon,
            "method": result.method,
        }

    except Exception as exc:
        db.rollback()
        logger.error(f"Forecast task failed: {exc}", exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()
