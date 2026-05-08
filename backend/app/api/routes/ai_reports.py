from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.ai_report import AIReport
from app.models.kpi_snapshot import KPISnapshot
from app.models.company_score import CompanyScore
from app.api.deps import get_current_user
from app.schemas.ai_report import AIReportOut, QARequest, QAResponse

router = APIRouter(prefix="/companies", tags=["ai-reports"])


async def _get_company_or_403(company_id: UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return company


async def _require_kpi_and_score(company_id: UUID, fiscal_year: int, db: AsyncSession):
    """Provjeri da postoje KPI i score podaci prije generisanja izvještaja."""
    kpi_q = await db.execute(
        select(KPISnapshot).where(KPISnapshot.company_id == company_id, KPISnapshot.fiscal_year == fiscal_year)
    )
    score_q = await db.execute(
        select(CompanyScore).where(CompanyScore.company_id == company_id, CompanyScore.fiscal_year == fiscal_year)
    )
    if not kpi_q.scalar_one_or_none():
        raise HTTPException(status_code=422, detail=f"KPI data ne postoji za {fiscal_year}. Prvo uploaduj i obradi PDF.")
    if not score_q.scalar_one_or_none():
        raise HTTPException(status_code=422, detail=f"Score ne postoji za {fiscal_year}. Pokrenite kalkulaciju.")


@router.post("/{company_id}/ai-report/{fiscal_year}", response_model=AIReportOut, status_code=202)
async def generate_ai_report(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pokreće asinhrone generisanje AI izvještaja.
    Vraća status=pending odmah; rezultat se dohvata GET endpointom.
    """
    company = await _get_company_or_403(company_id, current_user, db)
    await _require_kpi_and_score(company_id, fiscal_year, db)

    # Provjeri da li već postoji (upsert logika)
    q = await db.execute(
        select(AIReport).where(AIReport.company_id == company_id, AIReport.fiscal_year == fiscal_year)
    )
    report = q.scalar_one_or_none()

    if report and report.status == "generating":
        raise HTTPException(status_code=409, detail="Generisanje je već u toku")

    if not report:
        report = AIReport(company_id=company_id, fiscal_year=fiscal_year, status="pending")
        db.add(report)
        await db.flush()
        await db.refresh(report)

    # Dispatch Celery task
    from app.workers.tasks.report_generation import generate_ai_report_task
    generate_ai_report_task.delay(str(company_id), fiscal_year, str(report.id))

    return report


@router.get("/{company_id}/ai-report/{fiscal_year}", response_model=AIReportOut)
async def get_ai_report(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_company_or_403(company_id, current_user, db)

    q = await db.execute(
        select(AIReport).where(AIReport.company_id == company_id, AIReport.fiscal_year == fiscal_year)
    )
    report = q.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="AI izvještaj ne postoji za ovu godinu")
    return report


@router.get("/{company_id}/ai-report/{fiscal_year}/pdf")
async def download_pdf_report(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Vraća PDF finansijski izvještaj kao attachment."""
    company = await _get_company_or_403(company_id, current_user, db)

    ai_q = await db.execute(
        select(AIReport).where(AIReport.company_id == company_id, AIReport.fiscal_year == fiscal_year)
    )
    ai_report = ai_q.scalar_one_or_none()
    if not ai_report or ai_report.status != "done":
        raise HTTPException(status_code=404, detail="AI izvještaj nije dostupan. Generiši ga prvo.")

    kpi_q = await db.execute(
        select(KPISnapshot).where(KPISnapshot.company_id == company_id, KPISnapshot.fiscal_year == fiscal_year)
    )
    kpi = kpi_q.scalar_one_or_none()
    score_q = await db.execute(
        select(CompanyScore).where(CompanyScore.company_id == company_id, CompanyScore.fiscal_year == fiscal_year)
    )
    score = score_q.scalar_one_or_none()

    kpi_dict = {c.key: getattr(kpi, c.key) for c in kpi.__table__.columns} if kpi else {}
    score_dict = {c.key: getattr(score, c.key) for c in score.__table__.columns} if score else {}

    from app.modules.llm.pdf_export import generate_pdf
    pdf_bytes = generate_pdf(
        company_name=company.name,
        industry=company.industry,
        country=company.country,
        fiscal_year=fiscal_year,
        kpi=kpi_dict,
        score=score_dict,
        ai_report={
            "summary": ai_report.summary,
            "score_explanation": ai_report.score_explanation,
            "strengths": ai_report.strengths or [],
            "weaknesses": ai_report.weaknesses or [],
            "key_risks": ai_report.key_risks or [],
            "recommendations": ai_report.recommendations or [],
            "risk_assessment": ai_report.risk_assessment,
            "outlook": ai_report.outlook,
            "red_flags": ai_report.red_flags or [],
        },
    )

    filename = f"{company.name.replace(' ', '_')}_{fiscal_year}_analiza.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{company_id}/qa/{fiscal_year}", response_model=QAResponse)
async def qa_endpoint(
    company_id: UUID,
    fiscal_year: int,
    payload: QARequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real-time Q&A o finansijskim podacima kompanije."""
    await _get_company_or_403(company_id, current_user, db)

    company_q = await db.execute(select(Company).where(Company.id == company_id))
    company = company_q.scalar_one()

    kpi_q = await db.execute(
        select(KPISnapshot).where(KPISnapshot.company_id == company_id, KPISnapshot.fiscal_year == fiscal_year)
    )
    kpi = kpi_q.scalar_one_or_none()
    if not kpi:
        raise HTTPException(status_code=422, detail="Nema KPI podataka za ovu godinu")

    score_q = await db.execute(
        select(CompanyScore).where(CompanyScore.company_id == company_id, CompanyScore.fiscal_year == fiscal_year)
    )
    score = score_q.scalar_one_or_none()

    ai_q = await db.execute(
        select(AIReport).where(AIReport.company_id == company_id, AIReport.fiscal_year == fiscal_year)
    )
    ai_report = ai_q.scalar_one_or_none()

    kpi_dict = {c.key: getattr(kpi, c.key) for c in kpi.__table__.columns}
    score_dict = {c.key: getattr(score, c.key) for c in score.__table__.columns} if score else {}

    from app.modules.llm.qa import answer
    response_text = answer(
        question=payload.question,
        company_name=company.name,
        fiscal_year=fiscal_year,
        kpi=kpi_dict,
        score=score_dict,
        ai_summary=ai_report.summary if ai_report else "",
        history=payload.history,
    )

    return QAResponse(answer=response_text, company_id=company_id, fiscal_year=fiscal_year)
