"""Platform (superadmin) API — cross-tenant accounts, businesses, stats."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DbSession,
    RequirePlatformAdmin,
    hash_password,
)
from app.config import settings
from app.models import Business, Owner, PageView, UserRole
from app.schemas import BusinessOut, OwnerOut

router = APIRouter(prefix="/api/platform", tags=["platform"])


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ValueError("Nieprawidłowy adres e-mail")
    return email


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class PlatformAccountOut(OwnerOut):
    business_name: Optional[str] = None


class PlatformAccountCreate(BaseModel):
    email: str
    name: str | None = None
    role: UserRole = UserRole.owner
    business_id: UUID | None = None
    business_name: str | None = Field(
        default=None,
        description="Jeśli brak business_id — utwórz nową firmę o tej nazwie",
    )
    is_platform_admin: bool = False

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        return _normalize_email(v)


class PlatformAccountCreateOut(BaseModel):
    account: PlatformAccountOut
    temporary_password: str
    message: str = "Konto utworzone — hasło tymczasowe pokazywane raz"


class PlatformAccountUpdate(BaseModel):
    name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    is_platform_admin: bool | None = None
    email: str | None = None

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _normalize_email(v)


class PasswordResetOut(BaseModel):
    message: str
    temporary_password: str | None = None


class BusinessUpdatePlatform(BaseModel):
    name: str | None = None
    timezone: str | None = None


class PageViewDayBucket(BaseModel):
    day: str
    count: int


class PageViewPathBucket(BaseModel):
    path: str
    count: int


class PageViewRecent(BaseModel):
    id: UUID
    path: str
    referrer: str | None = None
    user_agent: str | None = None
    session_id: str | None = None
    created_at: datetime


class PlatformPageviewStats(BaseModel):
    visits_today: int
    visits_7d: int
    visits_30d: int
    unique_sessions_7d: int
    by_day: list[PageViewDayBucket]
    top_paths: list[PageViewPathBucket]
    recent: list[PageViewRecent]


def _account_out(owner: Owner) -> PlatformAccountOut:
    return PlatformAccountOut(
        id=owner.id,
        email=owner.email,
        business_id=owner.business_id,
        name=owner.name,
        role=owner.role,
        email_verified=owner.email_verified,
        is_active=owner.is_active,
        is_platform_admin=owner.is_platform_admin,
        created_at=owner.created_at,
        business_name=owner.business.name if owner.business else None,
    )


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------


@router.get("/accounts", response_model=list[PlatformAccountOut])
async def list_accounts(
    db: DbSession,
    _admin: RequirePlatformAdmin,
) -> list[PlatformAccountOut]:
    result = await db.execute(
        select(Owner)
        .options(selectinload(Owner.business))
        .order_by(Owner.created_at.desc())
    )
    return [_account_out(o) for o in result.scalars().all()]


@router.post(
    "/accounts",
    response_model=PlatformAccountCreateOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_account(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    body: PlatformAccountCreate,
) -> PlatformAccountCreateOut:
    existing = await db.execute(select(Owner).where(Owner.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto z tym e-mailem już istnieje",
        )

    business_id = body.business_id
    if business_id is None:
        name = (body.business_name or "").strip() or f"Firma {body.email.split('@')[0]}"
        business = Business(
            name=name,
            timezone="Europe/Warsaw",
            settings={"locale": "pl", "currency": "PLN"},
        )
        db.add(business)
        await db.flush()
        business_id = business.id
    else:
        biz = await db.execute(select(Business).where(Business.id == business_id))
        if biz.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Firma nie znaleziona")

    temp_password = secrets.token_urlsafe(10)
    owner = Owner(
        email=body.email,
        password_hash=hash_password(temp_password),
        name=(body.name or "").strip() or None,
        role=body.role,
        email_verified=True,
        is_active=True,
        is_platform_admin=body.is_platform_admin,
        business_id=business_id,
    )
    db.add(owner)
    await db.flush()
    result = await db.execute(
        select(Owner)
        .options(selectinload(Owner.business))
        .where(Owner.id == owner.id)
    )
    owner = result.scalar_one()

    return PlatformAccountCreateOut(
        account=_account_out(owner),
        temporary_password=temp_password,
    )


@router.patch("/accounts/{account_id}", response_model=PlatformAccountOut)
async def update_account(
    db: DbSession,
    admin: RequirePlatformAdmin,
    account_id: UUID,
    body: PlatformAccountUpdate,
) -> PlatformAccountOut:
    result = await db.execute(
        select(Owner)
        .options(selectinload(Owner.business))
        .where(Owner.id == account_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Konto nie znalezione")

    if body.email is not None:
        clash = await db.execute(
            select(Owner).where(Owner.email == body.email, Owner.id != user.id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Konto z tym e-mailem już istnieje",
            )
        user.email = body.email

    if body.name is not None:
        user.name = body.name.strip() or None
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        if user.id == admin.id and not body.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nie możesz dezaktywować własnego konta",
            )
        user.is_active = body.is_active
    if body.is_platform_admin is not None:
        if user.id == admin.id and not body.is_platform_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nie możesz odebrać sobie uprawnień platform admin",
            )
        user.is_platform_admin = body.is_platform_admin

    await db.flush()
    return _account_out(user)


@router.post(
    "/accounts/{account_id}/reset-password",
    response_model=PasswordResetOut,
)
async def reset_account_password(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    account_id: UUID,
) -> PasswordResetOut:
    result = await db.execute(select(Owner).where(Owner.id == account_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Konto nie znalezione")
    temp_password = secrets.token_urlsafe(10)
    user.password_hash = hash_password(temp_password)
    await db.flush()
    return PasswordResetOut(
        message="Hasło zostało zresetowane",
        temporary_password=temp_password,
    )


# ---------------------------------------------------------------------------
# Businesses
# ---------------------------------------------------------------------------


@router.get("/businesses", response_model=list[BusinessOut])
async def list_businesses(
    db: DbSession,
    _admin: RequirePlatformAdmin,
) -> list[Business]:
    result = await db.execute(select(Business).order_by(Business.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/businesses/{business_id}", response_model=BusinessOut)
async def update_business(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    business_id: UUID,
    body: BusinessUpdatePlatform,
) -> Business:
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    if business is None:
        raise HTTPException(status_code=404, detail="Firma nie znaleziona")
    if body.name is not None:
        business.name = body.name.strip() or business.name
    if body.timezone is not None:
        business.timezone = body.timezone.strip() or business.timezone
    await db.flush()
    return business


# ---------------------------------------------------------------------------
# Pageview stats
# ---------------------------------------------------------------------------


@router.get("/stats/pageviews", response_model=PlatformPageviewStats)
async def pageview_stats(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    recent_limit: int = Query(default=50, ge=1, le=200),
) -> PlatformPageviewStats:
    now = datetime.now(timezone.utc)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_7d = now - timedelta(days=7)
    start_30d = now - timedelta(days=30)

    async def _count_since(since: datetime) -> int:
        result = await db.execute(
            select(func.count()).select_from(PageView).where(PageView.created_at >= since)
        )
        return int(result.scalar_one())

    visits_today = await _count_since(start_today)
    visits_7d = await _count_since(start_7d)
    visits_30d = await _count_since(start_30d)

    unique_result = await db.execute(
        select(func.count(func.distinct(PageView.session_id))).where(
            PageView.created_at >= start_7d,
            PageView.session_id.is_not(None),
        )
    )
    unique_sessions_7d = int(unique_result.scalar_one() or 0)

    # Daily buckets for last 30 days
    if settings.is_sqlite:
        day_expr = func.strftime("%Y-%m-%d", PageView.created_at)
    else:
        day_expr = func.to_char(func.date_trunc("day", PageView.created_at), "YYYY-MM-DD")

    day_col = day_expr.label("day")
    by_day_rows = (
        await db.execute(
            select(day_col, func.count().label("count"))
            .where(PageView.created_at >= start_30d)
            .group_by(day_col)
            .order_by(day_col)
        )
    ).all()
    by_day = [PageViewDayBucket(day=str(r.day), count=int(r.count)) for r in by_day_rows]

    top_rows = (
        await db.execute(
            select(PageView.path, func.count().label("count"))
            .where(PageView.created_at >= start_30d)
            .group_by(PageView.path)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()
    top_paths = [PageViewPathBucket(path=r.path, count=int(r.count)) for r in top_rows]

    recent_rows = (
        await db.execute(
            select(PageView)
            .order_by(PageView.created_at.desc())
            .limit(recent_limit)
        )
    ).scalars().all()
    recent = [
        PageViewRecent(
            id=pv.id,
            path=pv.path,
            referrer=pv.referrer,
            user_agent=pv.user_agent,
            session_id=pv.session_id,
            created_at=pv.created_at,
        )
        for pv in recent_rows
    ]

    return PlatformPageviewStats(
        visits_today=visits_today,
        visits_7d=visits_7d,
        visits_30d=visits_30d,
        unique_sessions_7d=unique_sessions_7d,
        by_day=by_day,
        top_paths=top_paths,
        recent=recent,
    )
