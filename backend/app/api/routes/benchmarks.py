from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.kpi_snapshot import KPISnapshot
from app.api.deps import get_current_user
from app.schemas.benchmark import BenchmarkResponse, IndustriesResponse, MetricBenchmarkOut
from app.modules.ml.benchmarks import get_benchmark, list_industries

router = APIRouter(tags=["benchmarks"])


async def _get_company_or_403(company_id: UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return company


@router.get("/industries", response_model=IndustriesResponse)
async def get_industries(
    current_user: User = Depends(get_current_user),
):
    """Vraća listu podržanih industrija za benchmark poređenje."""
    return IndustriesResponse(industries=list_industries())


@router.get("/companies/{company_id}/benchmarks/{fiscal_year}", response_model=BenchmarkResponse)
async def get_company_benchmark(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Poredi KPI kompanije sa industrijskim medijanima za odabranu godinu.

    Vraća percentilni rang kompanije u odnosu na ostale kompanije u industriji
    za svaki KPI indikator.
    """
    company = await _get_company_or_403(company_id, current_user, db)

    # Dohvati KPI snapshot za godinu
    q = await db.execute(
        select(KPISnapshot).where(
            KPISnapshot.company_id == company_id,
            KPISnapshot.fiscal_year == fiscal_year,
        )
    )
    snap = q.scalar_one_or_none()
    if not snap:
        raise HTTPException(
            status_code=404,
            detail=f"KPI podaci nisu pronađeni za {fiscal_year}. Pokrenite kalkulaciju KPI-a prvo.",
        )

    # Pretvori KPI snapshot u flat dict koji benchmarks modul očekuje
    kpi_flat: dict[str, float | None] = {
        "current_ratio":          float(snap.current_ratio)          if snap.current_ratio          is not None else None,
        "quick_ratio":            float(snap.quick_ratio)            if snap.quick_ratio            is not None else None,
        "cash_ratio":             float(snap.cash_ratio)             if snap.cash_ratio             is not None else None,
        "ebitda_margin":          float(snap.ebitda_margin)          if snap.ebitda_margin          is not None else None,
        "net_margin":             float(snap.net_margin)             if snap.net_margin             is not None else None,
        "roe":                    float(snap.roe)                    if snap.roe                    is not None else None,
        "roa":                    float(snap.roa)                    if snap.roa                    is not None else None,
        "debt_to_equity":         float(snap.debt_to_equity)         if snap.debt_to_equity         is not None else None,
        "debt_ratio":             float(snap.debt_ratio)             if snap.debt_ratio             is not None else None,
        "interest_coverage":      float(snap.interest_coverage)      if snap.interest_coverage      is not None else None,
        "revenue_growth":         float(snap.revenue_growth)         if snap.revenue_growth         is not None else None,
        "asset_turnover":         float(snap.asset_turnover)         if snap.asset_turnover         is not None else None,
        "days_sales_outstanding": float(snap.days_sales_outstanding) if snap.days_sales_outstanding is not None else None,
        "inventory_turnover":     float(snap.inventory_turnover)     if snap.inventory_turnover     is not None else None,
    }

    result = get_benchmark(
        company_id=str(company_id),
        fiscal_year=fiscal_year,
        industry=company.industry,
        kpi_flat=kpi_flat,
    )

    return BenchmarkResponse(
        company_id=company_id,
        fiscal_year=fiscal_year,
        industry=result.industry,
        metrics=[
            MetricBenchmarkOut(
                metric=m.metric,
                label=m.label,
                company_value=m.company_value,
                industry_p25=m.industry_p25,
                industry_median=m.industry_median,
                industry_p75=m.industry_p75,
                percentile=m.percentile,
                higher_is_better=m.higher_is_better,
                assessment=m.assessment,
                assessment_label=m.assessment_label,
            )
            for m in result.metrics
        ],
        overall_percentile=result.overall_percentile,
        strengths=result.strengths,
        weaknesses=result.weaknesses,
    )
