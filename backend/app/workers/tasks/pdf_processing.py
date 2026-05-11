import logging
from datetime import datetime, timezone

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_db():
    from app.database import SyncSessionLocal
    return SyncSessionLocal()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_pdf_report(self, report_id: str, file_path: str) -> dict:
    """Parsira PDF finansijski izvještaj i upisuje rezultate u bazu."""
    from app.models.financial_report import FinancialReport
    from app.modules.pdf_parser.extractor import extract_financial_data

    db = _get_db()
    try:
        report = db.query(FinancialReport).filter_by(id=report_id).first()
        if not report:
            return {"status": "error", "message": "Report not found"}

        report.status = "processing"
        db.commit()

        result = extract_financial_data(file_path)

        report.raw_data = result
        report.status = "done"
        report.processed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Report {report_id} processed: {len(result.get('tables', []))} tables extracted")

        # Automatski pokrenuti KPI + Score kalkulaciju
        from app.workers.tasks.kpi_calculation import calculate_kpis_and_score
        calculate_kpis_and_score.delay(str(report.company_id), report.fiscal_year)

        # Dispatch webhook event
        try:
            from app.models.company import Company
            company = db.query(Company).filter_by(id=report.company_id).first()
            if company:
                from app.workers.tasks.webhook_delivery import dispatch_webhook_event
                dispatch_webhook_event.delay(
                    "report.processed",
                    str(company.org_id),
                    {
                        "report_id": report_id,
                        "company_id": str(report.company_id),
                        "company_name": company.name,
                        "fiscal_year": report.fiscal_year,
                    },
                )
        except Exception as we:
            logger.warning(f"Webhook dispatch neuspješan (nefatalno): {we}")

        return {"status": "done", "report_id": report_id}

    except Exception as exc:
        logger.error(f"PDF processing failed for {report_id}: {exc}", exc_info=True)
        try:
            report = db.query(FinancialReport).filter_by(id=report_id).first()
            if report:
                report.status = "error"
                report.error_message = str(exc)
                db.commit()
        except Exception:
            db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
