"""
Risk Analysis endpointi — anomaly detection i bankruptcy risk.

GET /companies/{company_id}/anomalies/{fiscal_year}
GET /companies/{company_id}/bankruptcy-risk/{fiscal_year}
"""

from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.kpi_snapshot import KPISnapshot
from app.models.company_score import CompanyScore
from app.api.deps import get_current_user
from app.modules.ml.anomaly import detect_anomalies
from app.modules.ml.risk_model import calculate_bankruptcy_risk
from app.schemas.risk import AnomalyResultOut, AnomalyFlagOut, BankruptcyRiskOut, PiotroskiResultOut, PiotroskiSignalOut
from app.core.cache import cache, anomaly_key, risk_key, RISK_TTL

router = APIRouter(prefix="/companies", tags=["risk-analysis"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_company_or_404(company_id: UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return company


def _snap_to_dict(snap: KPISnapshot) -> dict:
    """Pretvara KPISnapshot u plain dict s float vrijednostima."""
    fields = [
        "current_ratio", "quick_ratio", "cash_ratio",
        "gross_margin", "ebitda_margin", "ebit_margin", "net_margin", "roe", "roa",
        "debt_to_equity", "interest_coverage", "debt_ratio", "equity_ratio",
        "revenue_growth", "ebitda_growth", "net_income_growth", "asset_growth",
        "free_cash_flow", "ocf_margin", "cash_to_debt", "ocf_to_current_liabilities",
        "asset_turnover", "receivables_turnover", "days_sales_outstanding",
        "inventory_turnover", "days_inventory_outstanding",
    ]
    result: dict = {}
    for f in fields:
        val = getattr(snap, f, None)
        if val is None:
            result[f] = None
        elif isinstance(val, Decimal):
            result[f] = float(val)
        else:
            result[f] = float(val)
    return result


async def _get_peer_kpis(
    exclude_company_id: UUID,
    org_id: UUID,
    industry: str | None,
    fiscal_year: int,
    db: AsyncSession,
) -> list[dict]:
    """Vraća KPI diktove peer kompanija iste industrije (max 50)."""
    if not industry:
        return []

    q = await db.execute(
        select(KPISnapshot)
        .join(Company, KPISnapshot.company_id == Company.id)
        .where(
            Company.org_id == org_id,
            Company.industry == industry,
            Company.id != exclude_company_id,
            KPISnapshot.fiscal_year == fiscal_year,
        )
        .limit(50)
    )
    snaps = q.scalars().all()
    return [_snap_to_dict(s) for s in snaps]


# ── Anomaly Detection ─────────────────────────────────────────────────────────

@router.get("/{company_id}/anomalies/{fiscal_year}", response_model=AnomalyResultOut)
async def get_anomalies(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Detektuje finansijske anomalije za kompaniju i fiskalnu godinu.

    Koristi kombinaciju:
    - Rule-based provjera (apsolutni pragovi)
    - YoY threshold analiza (>50 % promjene ključnih metrika)
    - Industry outlier (IQR fence metoda)
    - Isolation Forest (ako ima >= 5 peer kompanija iste industrije u org)
    """
    company = await _get_company_or_404(company_id, current_user, db)

    # ── Cache ─────────────────────────────────────────────────────────────────
    ck = anomaly_key(str(company_id), fiscal_year)
    cached = await cache.get_json(ck)
    if cached:
        return AnomalyResultOut(**cached)

    # ── Fetch KPI snapshotovi ─────────────────────────────────────────────────
    curr_q = await db.execute(
        select(KPISnapshot).where(
            KPISnapshot.company_id == company_id,
            KPISnapshot.fiscal_year == fiscal_year,
        )
    )
    curr_snap = curr_q.scalar_one_or_none()
    if not curr_snap:
        raise HTTPException(status_code=404, detail=f"KPI podaci nisu pronađeni za {fiscal_year}")

    prev_q = await db.execute(
        select(KPISnapshot).where(
            KPISnapshot.company_id == company_id,
            KPISnapshot.fiscal_year == fiscal_year - 1,
        )
    )
    prev_snap = prev_q.scalar_one_or_none()

    kpi_dict      = _snap_to_dict(curr_snap)
    prev_kpi_dict = _snap_to_dict(prev_snap) if prev_snap else None

    # Peer kompanije za Isolation Forest
    peers = await _get_peer_kpis(company_id, company.org_id, company.industry, fiscal_year, db)

    # ── Detekcija ─────────────────────────────────────────────────────────────
    result = detect_anomalies(
        kpi=kpi_dict,
        prev_kpi=prev_kpi_dict,
        company_id=str(company_id),
        fiscal_year=fiscal_year,
        peer_kpis=peers if len(peers) >= 5 else None,
    )

    response = AnomalyResultOut(
        company_id=company_id,
        fiscal_year=fiscal_year,
        anomalies=[
            AnomalyFlagOut(
                metric=f.metric,
                label=f.label,
                severity=f.severity,
                anomaly_type=f.anomaly_type,
                description=f.description,
                value=f.value,
                previous_value=f.previous_value,
                industry_norm=f.industry_norm,
            )
            for f in result.anomalies
        ],
        risk_score=result.risk_score,
        summary=result.summary,
        methods_used=result.methods_used,
    )

    await cache.set_json(ck, response.model_dump(mode="json"), ttl=RISK_TTL)
    return response


# ── Bankruptcy Risk ───────────────────────────────────────────────────────────

@router.get("/{company_id}/bankruptcy-risk/{fiscal_year}", response_model=BankruptcyRiskOut)
async def get_bankruptcy_risk(
    company_id: UUID,
    fiscal_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Procjena rizika od finansijskog sloma.

    Kombinuje:
    - Piotroski F-Score (9 binarnih signala profitabilnosti, leveragea i efikasnosti)
    - Altman Z-Score (iz prethodno izračunatog company score-a)
    - Probabilistički output (distress probability 0–100 %)
    """
    company = await _get_company_or_404(company_id, current_user, db)  # noqa: F841

    # ── Cache ─────────────────────────────────────────────────────────────────
    ck = risk_key(str(company_id), fiscal_year)
    cached = await cache.get_json(ck)
    if cached:
        return BankruptcyRiskOut(**cached)

    # ── Fetch KPI snapshotovi ─────────────────────────────────────────────────
    curr_q = await db.execute(
        select(KPISnapshot).where(
            KPISnapshot.company_id == company_id,
            KPISnapshot.fiscal_year == fiscal_year,
        )
    )
    curr_snap = curr_q.scalar_one_or_none()
    if not curr_snap:
        raise HTTPException(status_code=404, detail=f"KPI podaci nisu pronađeni za {fiscal_year}")

    prev_q = await db.execute(
        select(KPISnapshot).where(
            KPISnapshot.company_id == company_id,
            KPISnapshot.fiscal_year == fiscal_year - 1,
        )
    )
    prev_snap = prev_q.scalar_one_or_none()

    # ── Fetch Altman Z-Score iz CompanyScore ──────────────────────────────────
    score_q = await db.execute(
        select(CompanyScore).where(
            CompanyScore.company_id == company_id,
            CompanyScore.fiscal_year == fiscal_year,
        )
    )
    score_row = score_q.scalar_one_or_none()

    altman_z    = None
    altman_zone = None
    if score_row and score_row.altman_data:
        altman_z    = score_row.altman_data.get("z_score")
        altman_zone = score_row.altman_data.get("zone")

    # ── Kalkulacija ───────────────────────────────────────────────────────────
    result = calculate_bankruptcy_risk(
        company_id=str(company_id),
        fiscal_year=fiscal_year,
        kpi=_snap_to_dict(curr_snap),
        prev_kpi=_snap_to_dict(prev_snap) if prev_snap else None,
        altman_z_score=float(altman_z) if altman_z is not None else None,
        altman_zone=altman_zone,
    )

    pio = result.piotroski
    response = BankruptcyRiskOut(
        company_id=company_id,
        fiscal_year=fiscal_year,
        piotroski=PiotroskiResultOut(
            score=pio.score,
            available=pio.available,
            category=pio.category,
            signals=[
                PiotroskiSignalOut(
                    name=s.name,
                    description=s.description,
                    passed=s.passed,
                    value=s.value,
                )
                for s in pio.signals
            ],
        ),
        altman_z_score=result.altman_z_score,
        altman_zone=result.altman_zone,
        distress_probability=result.distress_probability,
        distress_label=result.distress_label,
        risk_factors=result.risk_factors,
        positive_factors=result.positive_factors,
    )

    await cache.set_json(ck, response.model_dump(mode="json"), ttl=RISK_TTL)
    return response
