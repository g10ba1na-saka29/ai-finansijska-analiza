import logging
from datetime import datetime, timezone

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_db():
    from app.database import SyncSessionLocal
    return SyncSessionLocal()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def generate_ai_report_task(self, company_id: str, fiscal_year: int, report_id: str) -> dict:
    """
    Generiše AI finansijski izvještaj pozivom LLM-a.
    Lanac: process_pdf_report → calculate_kpis_and_score → generate_ai_report_task
    """
    from app.models.ai_report import AIReport
    from app.models.company import Company
    from app.models.kpi_snapshot import KPISnapshot
    from app.models.company_score import CompanyScore
    from app.modules.llm.report_generator import generate

    db = _get_db()
    try:
        ai_report = db.query(AIReport).filter_by(id=report_id).first()
        if not ai_report:
            return {"status": "error", "message": "AIReport not found"}

        ai_report.status = "generating"
        db.commit()

        company = db.query(Company).filter_by(id=company_id).first()
        kpi = db.query(KPISnapshot).filter_by(company_id=company_id, fiscal_year=fiscal_year).first()
        score = db.query(CompanyScore).filter_by(company_id=company_id, fiscal_year=fiscal_year).first()

        if not kpi or not score:
            ai_report.status = "error"
            ai_report.error_message = "Nedostaju KPI ili score podaci"
            db.commit()
            return {"status": "error", "message": "Missing KPI/score data"}

        # Pripremi flat KPI dict
        kpi_dict = {c.key: getattr(kpi, c.key) for c in kpi.__table__.columns}
        score_dict = {
            "total_score": float(score.total_score),
            "risk_level": score.risk_level,
            "liquidity_score": float(score.liquidity_score) if score.liquidity_score else None,
            "profitability_score": float(score.profitability_score) if score.profitability_score else None,
            "leverage_score": float(score.leverage_score) if score.leverage_score else None,
            "growth_score": float(score.growth_score) if score.growth_score else None,
            "cashflow_score": float(score.cashflow_score) if score.cashflow_score else None,
            "altman_data": score.altman_data,
        }

        # Trend podaci (zadnje 3 godine)
        trend_scores = (
            db.query(CompanyScore)
            .filter(
                CompanyScore.company_id == company_id,
                CompanyScore.fiscal_year < fiscal_year,
            )
            .order_by(CompanyScore.fiscal_year)
            .limit(3)
            .all()
        )
        trend_points = [
            {
                "fiscal_year": s.fiscal_year,
                "total_score": float(s.total_score),
                "ebitda_margin": float(db.query(KPISnapshot).filter_by(
                    company_id=company_id, fiscal_year=s.fiscal_year
                ).first().ebitda_margin or 0) if db.query(KPISnapshot).filter_by(
                    company_id=company_id, fiscal_year=s.fiscal_year
                ).first() else None,
                "revenue_growth": None,
            }
            for s in trend_scores
        ]

        # Pozovi generator
        report_data = generate(
            company_name=company.name,
            industry=company.industry,
            country=company.country,
            fiscal_year=fiscal_year,
            kpi=kpi_dict,
            score=score_dict,
            trend_points=trend_points,
        )

        # Upiši rezultate
        ai_report.summary = report_data.summary
        ai_report.score_explanation = report_data.score_explanation
        ai_report.strengths = report_data.strengths
        ai_report.weaknesses = report_data.weaknesses
        ai_report.key_risks = report_data.key_risks
        ai_report.recommendations = report_data.recommendations
        ai_report.risk_assessment = report_data.risk_assessment
        ai_report.outlook = report_data.outlook
        ai_report.red_flags = report_data.red_flags
        ai_report.model_used = report_data.model_used
        ai_report.status = "done"
        ai_report.generated_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"AI izvještaj generisan: company={company_id}, year={fiscal_year}")
        return {"status": "done", "report_id": report_id}

    except Exception as exc:
        logger.error(f"AI report generation failed: {exc}", exc_info=True)
        try:
            ai_report = db.query(AIReport).filter_by(id=report_id).first()
            if ai_report:
                ai_report.status = "error"
                ai_report.error_message = str(exc)
                db.commit()
        except Exception:
            db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
