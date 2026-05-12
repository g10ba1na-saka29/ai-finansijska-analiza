from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.core.audit import audit
from app.api.deps import get_current_user
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyOut, CompanyListOut

router = APIRouter(prefix="/companies", tags=["companies"])


def _assert_owns(company: Company, user: User):
    if company.org_id != user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("", response_model=CompanyListOut)
async def list_companies(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_q = await db.execute(select(func.count()).where(Company.org_id == current_user.org_id))
    total = count_q.scalar_one()

    q = await db.execute(
        select(Company)
        .where(Company.org_id == current_user.org_id)
        .order_by(Company.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    items = q.scalars().all()
    return CompanyListOut(items=items, total=total)


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(
    request: Request,
    payload: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = Company(**payload.model_dump(), org_id=current_user.org_id)
    db.add(company)
    await db.flush()
    await db.refresh(company)
    await audit(
        db, org_id=current_user.org_id, user_id=current_user.id,
        action="company.created",
        resource_type="company", resource_id=str(company.id),
        details={"name": company.name, "industry": company.industry},
        request=request,
    )
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    _assert_owns(company, current_user)
    return company


@router.put("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: UUID,
    payload: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    _assert_owns(company, current_user)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(company, field, value)

    await db.flush()
    await db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    _assert_owns(company, current_user)
    deleted_name = company.name
    await db.delete(company)
    await audit(
        db, org_id=current_user.org_id, user_id=current_user.id,
        action="company.deleted",
        resource_type="company", resource_id=str(company_id),
        details={"name": deleted_name},
        request=request,
    )
    await db.commit()
