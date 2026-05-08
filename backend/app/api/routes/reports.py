import os
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.financial_report import FinancialReport
from app.api.deps import get_current_user
from app.config import settings
from app.schemas.report import ReportOut, ReportListOut, VALID_REPORT_TYPES

router = APIRouter(tags=["reports"])


async def _get_company_or_404(company_id: UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return company


@router.post("/companies/{company_id}/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def upload_report(
    company_id: UUID,
    fiscal_year: int = Form(...),
    report_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_company_or_404(company_id, current_user, db)

    if report_type not in VALID_REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of: {VALID_REPORT_TYPES}")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    if len(contents) > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit")

    # Persist file
    upload_path = Path(settings.UPLOAD_DIR) / str(current_user.org_id) / str(company_id)
    upload_path.mkdir(parents=True, exist_ok=True)

    report = FinancialReport(
        company_id=company_id,
        uploaded_by=current_user.id,
        fiscal_year=fiscal_year,
        report_type=report_type,
        status="pending",
    )
    db.add(report)
    await db.flush()

    file_path = upload_path / f"{report.id}.pdf"
    file_path.write_bytes(contents)

    report.source_file = str(file_path)
    await db.flush()

    # Dispatch Celery task
    from app.workers.tasks.pdf_processing import process_pdf_report
    process_pdf_report.delay(str(report.id), str(file_path))

    await db.refresh(report)
    return report


@router.get("/companies/{company_id}/reports", response_model=ReportListOut)
async def list_reports(
    company_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_company_or_404(company_id, current_user, db)

    count_q = await db.execute(
        select(func.count()).where(FinancialReport.company_id == company_id)
    )
    total = count_q.scalar_one()

    q = await db.execute(
        select(FinancialReport)
        .where(FinancialReport.company_id == company_id)
        .order_by(FinancialReport.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return ReportListOut(items=q.scalars().all(), total=total)


@router.get("/reports/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = await db.execute(
        select(FinancialReport)
        .join(Company, FinancialReport.company_id == Company.id)
        .where(FinancialReport.id == report_id, Company.org_id == current_user.org_id)
    )
    report = q.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = await db.execute(
        select(FinancialReport)
        .join(Company, FinancialReport.company_id == Company.id)
        .where(FinancialReport.id == report_id, Company.org_id == current_user.org_id)
    )
    report = q.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.source_file and os.path.exists(report.source_file):
        os.remove(report.source_file)

    await db.delete(report)
