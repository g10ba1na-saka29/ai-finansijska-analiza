from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.audit import audit
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, TokenResponse, AccessTokenResponse, UserOut, ChangePasswordRequest
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    org = Organization(name=payload.org_name)
    db.add(org)
    await db.flush()

    user = User(
        org_id=org.id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="admin",
    )
    db.add(user)
    await db.flush()

    await audit(
        db, org_id=org.id, user_id=user.id,
        action="auth.register",
        resource_type="user", resource_id=str(user.id),
        details={"email": user.email, "org_name": payload.org_name},
        request=request,
    )
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id), str(org.id), user.role),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    await audit(
        db, org_id=user.org_id, user_id=user.id,
        action="auth.login",
        resource_type="user", resource_id=str(user.id),
        details={"email": user.email},
        request=request,
    )
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id), str(user.org_id), user.role),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    data = decode_token(payload.refresh_token)

    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == data["sub"]))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    return AccessTokenResponse(
        access_token=create_access_token(str(user.id), str(user.org_id), user.role),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        role=current_user.role,
        org_id=str(current_user.org_id),
    )


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Trenutna šifra nije ispravna")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Nova šifra mora imati minimalno 6 karaktera")
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
