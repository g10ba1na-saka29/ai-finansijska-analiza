from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.core.security import hash_password
from app.schemas.org import MemberOut, MemberListOut, MemberCreate, MemberUpdate
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/org", tags=["organization"])


def _member_out(m: User) -> MemberOut:
    return MemberOut(
        id=str(m.id),
        email=m.email,
        role=m.role,
        is_active=m.is_active,
        created_at=m.created_at,
    )


@router.get("/members", response_model=MemberListOut)
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Svi korisnici u organizaciji."""
    result = await db.execute(
        select(User)
        .where(User.org_id == current_user.org_id)
        .order_by(User.created_at)
    )
    members = result.scalars().all()
    return MemberListOut(items=[_member_out(m) for m in members], total=len(members))


@router.post("/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def create_member(
    payload: MemberCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Dodaj novog člana org-a (samo admin)."""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email već postoji")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Šifra mora imati minimalno 6 karaktera")

    if payload.role not in ("admin", "analyst"):
        raise HTTPException(status_code=400, detail="Dozvoljena rola: admin ili analyst")

    user = User(
        org_id=current_user.org_id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _member_out(user)


@router.patch("/members/{user_id}", response_model=MemberOut)
async def update_member(
    user_id: str,
    payload: MemberUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Promijeni rolu ili status člana (samo admin)."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    if str(member.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Ne možete mijenjati vlastitu rolu ili status")

    if payload.role is not None:
        if payload.role not in ("admin", "analyst"):
            raise HTTPException(status_code=400, detail="Dozvoljena rola: admin ili analyst")
        member.role = payload.role

    if payload.is_active is not None:
        member.is_active = payload.is_active

    await db.commit()
    await db.refresh(member)
    return _member_out(member)


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Ukloni člana iz organizacije (samo admin, ne može ukloniti sebe ni posljednjeg admina)."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    if str(member.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Ne možete ukloniti sami sebe")

    # Zaštita — mora ostati min. jedan aktivan admin
    if member.role == "admin":
        count_res = await db.execute(
            select(func.count(User.id)).where(
                User.org_id == current_user.org_id,
                User.role == "admin",
                User.is_active.is_(True),
            )
        )
        if (count_res.scalar() or 0) <= 1:
            raise HTTPException(status_code=400, detail="Ne možete ukloniti posljednjeg admina")

    await db.delete(member)
    await db.commit()
