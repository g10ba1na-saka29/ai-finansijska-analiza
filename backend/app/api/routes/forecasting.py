from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.forecast import Forecast
from app.api.deps import get_current_user
from app.schemas.forecast import ForecastResponse, ForecastGenerateRequest, ForecastPointOut, HistoricalPointOut

router = APIRouter(tags=["forecasting"])


async def _get_company_or_403(company_id: UUID, user: User, db: AsyncSession) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return company


@router.get("/companies/{company_id}/forecast", response_model=ForecastResponse)
async def get_forecast(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Vraća posljednju generisanu prognozu za kompaniju.
    Prognoza se generiše via POST /companies/{id}/forecast/generate.
    """
    await _get_company_or_403(company_id, current_user, db)

    q = await db.execute(
        select(Forecast).where(Forecast.company_id == company_id)
    )
    fc = q.scalar_one_or_none()
    if not fc:
        raise HTTPException(
            status_code=404,
            detail="Prognoza nije pronađena. Pokrenite generisanje prvo.",
        )

    return _to_response(company_id, fc)


@router.post("/companies/{company_id}/forecast/generate", response_model=dict, status_code=202)
async def generate_forecast(
    company_id: UUID,
    body: ForecastGenerateRequest = ForecastGenerateRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pokreće Celery task koji generira ML prognozu za kompaniju.
    Vraća task_id za praćenje statusa.
    """
    await _get_company_or_403(company_id, current_user, db)

    horizon = max(1, min(body.horizon, 3))

    from app.workers.tasks.forecasting_task import generate_forecast as forecast_task
    task = forecast_task.delay(str(company_id), horizon)

    return {"task_id": task.id, "status": "queued", "horizon": horizon}


def _to_response(company_id: UUID, fc: Forecast) -> ForecastResponse:
    """Pretvara Forecast ORM model u ForecastResponse."""
    predictions = [
        ForecastPointOut(**p)
        for p in (fc.predictions or [])
    ]
    historical = [
        HistoricalPointOut(**h)
        for h in (fc.historical_summary or [])
    ]
    return ForecastResponse(
        company_id=company_id,
        base_year=fc.base_year,
        horizon=fc.horizon,
        method=fc.method,
        data_points=fc.data_points,
        predictions=predictions,
        historical=historical,
        revenue_r_squared=float(fc.revenue_r_squared) if fc.revenue_r_squared is not None else None,
        revenue_cagr=float(fc.revenue_cagr) if fc.revenue_cagr is not None else None,
        generated_at=fc.generated_at,
    )
