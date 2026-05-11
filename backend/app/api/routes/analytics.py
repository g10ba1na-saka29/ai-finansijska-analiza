from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.kpi_snapshot import KPISnapshot
from app.models.company_score import CompanyScore
from app.api.deps import get_current_user
from app.schemas.kpi import KPIResponse, LiquidityKPIs, ProfitabilityKPIs, LeverageKPIs, GrowthKPIs, CashFlowKPIs, EfficiencyKPIs, KPITrendResponse, KPITrendPoint
from app.schemas.score import ScoreResponse, AltmanData, ScoreBreakdown, ScoreHistoryResponse, ScoreHistoryPoint
from app.core.cache import (
    cache,
    kpi_key, score_key, score_history_key, kpi_trend_key,
    KPI_TTL, SCORE_TTL,
)

router = APIRouter(prefix="/companies", tags=["analytics"])


async def _get_company_or_403(company_id: UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return company


# ── KPI Endpointi ──────────────────────────────────────────────────────────────

@router.get("/{company_id}/kpi/{fiscal_year}", response_model=KPIResponse)
async def get_kpi(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_company_or_403(company_id, current_user, db)

    cid = str(company_id)
    ck  = kpi_key(cid, fiscal_year)

    # ── Cache hit? ─────────────────────────────────────────────────────────────
    cached = await cache.get_json(ck)
    if cached:
        return KPIResponse(**cached)

    # ── DB lookup ──────────────────────────────────────────────────────────────
    q = await db.execute(
        select(KPISnapshot).where(
            KPISnapshot.company_id == company_id,
            KPISnapshot.fiscal_year == fiscal_year,
        )
    )
    snap = q.scalar_one_or_none()
    if not snap:
        raise HTTPException(status_code=404, detail=f"KPI data not found for {fiscal_year}")

    response = KPIResponse(
        company_id=company_id,
        fiscal_year=fiscal_year,
        liquidity=LiquidityKPIs(
            current_ratio=snap.current_ratio,
            quick_ratio=snap.quick_ratio,
            cash_ratio=snap.cash_ratio,
        ),
        profitability=ProfitabilityKPIs(
            gross_margin=snap.gross_margin,
            ebitda_margin=snap.ebitda_margin,
            net_margin=snap.net_margin,
            roe=snap.roe,
            roa=snap.roa,
        ),
        leverage=LeverageKPIs(
            debt_to_equity=snap.debt_to_equity,
            interest_coverage=snap.interest_coverage,
            debt_ratio=snap.debt_ratio,
        ),
        growth=GrowthKPIs(
            revenue_growth=snap.revenue_growth,
            ebitda_growth=snap.ebitda_growth,
            net_income_growth=snap.net_income_growth,
        ),
        cashflow=CashFlowKPIs(
            free_cash_flow=float(snap.free_cash_flow) if snap.free_cash_flow else None,
            ocf_margin=snap.ocf_margin,
        ),
        efficiency=EfficiencyKPIs(
            asset_turnover=snap.asset_turnover,
            days_sales_outstanding=float(snap.days_sales_outstanding) if snap.days_sales_outstanding else None,
        ),
        calculated_at=snap.calculated_at,
    )

    # ── Upiši u cache ──────────────────────────────────────────────────────────
    await cache.set_json(ck, response.model_dump(mode="json"), ttl=KPI_TTL)

    return response


@router.get("/{company_id}/kpi/trend", response_model=KPITrendResponse)
async def get_kpi_trend(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_company_or_403(company_id, current_user, db)

    cid = str(company_id)
    ck  = kpi_trend_key(cid)

    cached = await cache.get_json(ck)
    if cached:
        return KPITrendResponse(**cached)

    q = await db.execute(
        select(KPISnapshot, CompanyScore)
        .outerjoin(
            CompanyScore,
            (CompanyScore.company_id == KPISnapshot.company_id)
            & (CompanyScore.fiscal_year == KPISnapshot.fiscal_year),
        )
        .where(KPISnapshot.company_id == company_id)
        .order_by(KPISnapshot.fiscal_year)
    )
    rows = q.all()

    points = []
    for snap, score in rows:
        points.append(KPITrendPoint(
            fiscal_year=snap.fiscal_year,
            ebitda_margin=snap.ebitda_margin,
            net_margin=snap.net_margin,
            current_ratio=snap.current_ratio,
            debt_to_equity=snap.debt_to_equity,
            revenue_growth=snap.revenue_growth,
            total_score=float(score.total_score) if score else None,
        ))

    response = KPITrendResponse(company_id=company_id, points=points)
    await cache.set_json(ck, response.model_dump(mode="json"), ttl=KPI_TTL)
    return response


# ── Score Endpointi ────────────────────────────────────────────────────────────

@router.get("/{company_id}/score/{fiscal_year}", response_model=ScoreResponse)
async def get_score(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_company_or_403(company_id, current_user, db)

    cid = str(company_id)
    ck  = score_key(cid, fiscal_year)

    cached = await cache.get_json(ck)
    if cached:
        return ScoreResponse(**cached)

    q = await db.execute(
        select(CompanyScore).where(
            CompanyScore.company_id == company_id,
            CompanyScore.fiscal_year == fiscal_year,
        )
    )
    score = q.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail=f"Score not found for {fiscal_year}")

    altman_raw = score.altman_data or {}
    breakdown_raw = score.breakdown or {}

    response = ScoreResponse(
        company_id=company_id,
        fiscal_year=fiscal_year,
        total_score=float(score.total_score),
        risk_level=score.risk_level,
        liquidity_score=float(score.liquidity_score) if score.liquidity_score else None,
        profitability_score=float(score.profitability_score) if score.profitability_score else None,
        leverage_score=float(score.leverage_score) if score.leverage_score else None,
        growth_score=float(score.growth_score) if score.growth_score else None,
        cashflow_score=float(score.cashflow_score) if score.cashflow_score else None,
        altman=AltmanData(**altman_raw) if altman_raw else None,
        breakdown=ScoreBreakdown(**breakdown_raw) if breakdown_raw else None,
        score_version=score.score_version,
        calculated_at=score.calculated_at,
    )

    await cache.set_json(ck, response.model_dump(mode="json"), ttl=SCORE_TTL)
    return response


@router.get("/{company_id}/score/history", response_model=ScoreHistoryResponse)
async def get_score_history(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_company_or_403(company_id, current_user, db)

    cid = str(company_id)
    ck  = score_history_key(cid)

    cached = await cache.get_json(ck)
    if cached:
        return ScoreHistoryResponse(**cached)

    q = await db.execute(
        select(CompanyScore)
        .where(CompanyScore.company_id == company_id)
        .order_by(CompanyScore.fiscal_year)
    )
    rows = q.scalars().all()

    history = [
        ScoreHistoryPoint(
            fiscal_year=s.fiscal_year,
            total_score=float(s.total_score),
            risk_level=s.risk_level,
            liquidity_score=float(s.liquidity_score) if s.liquidity_score else None,
            profitability_score=float(s.profitability_score) if s.profitability_score else None,
            leverage_score=float(s.leverage_score) if s.leverage_score else None,
            growth_score=float(s.growth_score) if s.growth_score else None,
            cashflow_score=float(s.cashflow_score) if s.cashflow_score else None,
        )
        for s in rows
    ]

    response = ScoreHistoryResponse(company_id=company_id, history=history)
    await cache.set_json(ck, response.model_dump(mode="json"), ttl=SCORE_TTL)
    return response


@router.post("/{company_id}/calculate/{fiscal_year}", status_code=202)
async def trigger_calculation(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ručno pokreće KPI + score kalkulaciju za godinu."""
    await _get_company_or_403(company_id, current_user, db)

    # Invaliduj cache za ovu godinu prije nego počne nova kalkulacija
    cid = str(company_id)
    await cache.delete(
        kpi_key(cid, fiscal_year),
        score_key(cid, fiscal_year),
        score_history_key(cid),
        kpi_trend_key(cid),
    )

    from app.workers.tasks.kpi_calculation import calculate_kpis_and_score
    task = calculate_kpis_and_score.delay(str(company_id), fiscal_year)

    return {"task_id": task.id, "status": "queued"}
