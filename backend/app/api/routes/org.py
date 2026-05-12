from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.security import hash_password
from app.core.audit import audit
from app.schemas.org import MemberOut, MemberListOut, MemberCreate, MemberUpdate, AuditLogOut, AuditLogListOut
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
    request: Request,
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
    await db.flush()
    await db.refresh(user)

    await audit(
        db, org_id=current_user.org_id, user_id=current_user.id,
        action="member.added",
        resource_type="user", resource_id=str(user.id),
        details={"email": user.email, "role": user.role},
        request=request,
    )
    await db.commit()
    return _member_out(user)


@router.patch("/members/{user_id}", response_model=MemberOut)
async def update_member(
    user_id: str,
    payload: MemberUpdate,
    request: Request,
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

    changes: dict = {}
    if payload.role is not None:
        if payload.role not in ("admin", "analyst"):
            raise HTTPException(status_code=400, detail="Dozvoljena rola: admin ili analyst")
        changes["role"] = {"from": member.role, "to": payload.role}
        member.role = payload.role

    if payload.is_active is not None:
        changes["is_active"] = {"from": member.is_active, "to": payload.is_active}
        member.is_active = payload.is_active

    action = "member.deactivated" if payload.is_active is False else \
             "member.activated"   if payload.is_active is True  else \
             "member.role_changed"

    await audit(
        db, org_id=current_user.org_id, user_id=current_user.id,
        action=action,
        resource_type="user", resource_id=str(member.id),
        details={"email": member.email, **changes},
        request=request,
    )
    await db.commit()
    await db.refresh(member)
    return _member_out(member)


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: str,
    request: Request,
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

    removed_email = member.email
    removed_role  = member.role
    await db.delete(member)

    await audit(
        db, org_id=current_user.org_id, user_id=current_user.id,
        action="member.removed",
        resource_type="user", resource_id=user_id,
        details={"email": removed_email, "role": removed_role},
        request=request,
    )
    await db.commit()


@router.get("/audit-log", response_model=AuditLogListOut)
async def get_audit_log(
    skip: int = 0,
    limit: int = 50,
    resource_type: str | None = None,
    action: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Dnevnik aktivnosti organizacije (samo admin)."""
    q = select(AuditLog).where(AuditLog.org_id == current_user.org_id)
    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type)
    if action:
        q = q.where(AuditLog.action == action)
    q = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)

    count_q = select(func.count()).select_from(AuditLog).where(AuditLog.org_id == current_user.org_id)
    if resource_type:
        count_q = count_q.where(AuditLog.resource_type == resource_type)
    if action:
        count_q = count_q.where(AuditLog.action == action)

    total_res = await db.execute(count_q)
    total = total_res.scalar_one()

    entries_res = await db.execute(q)
    entries = entries_res.scalars().all()

    return AuditLogListOut(
        items=[
            AuditLogOut(
                id=str(e.id),
                user_id=str(e.user_id) if e.user_id else None,
                action=e.action,
                resource_type=e.resource_type,
                resource_id=e.resource_id,
                details=e.details,
                ip_address=e.ip_address,
                created_at=e.created_at,
            )
            for e in entries
        ],
        total=total,
    )
