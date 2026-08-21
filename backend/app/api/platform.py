"""Platform (superadmin) API — cross-tenant accounts, businesses, stats."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DbSession,
    RequirePlatformAdmin,
    hash_password,
)
from app.config import settings
from app.models import Business, Owner, PageView, UserRole, LicenseKey
from app.schemas import BusinessOut, LicenseUsageOut, OwnerOut, PlanCatalogItem
from app.services import limits as limits_service
from app.services.limits import (
    LICENSE_ACTIVE,
    PLAN_DEFAULTS,
    PLAN_FREE,
    PLAN_PRO,
    apply_plan_defaults,
)

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
    plan: str | None = None
    license_status: str | None = None
    license_expires_at: datetime | None = None
    max_appointments_month: int | None = None
    max_messages_month: int | None = None
    max_seats: int | None = None
    enabled_channels: list[str] | None = None
    apply_plan_defaults: bool = Field(
        default=False,
        description="Przy zmianie planu nadpisz limity wartościami katalogowymi",
    )
    clear_expiry: bool = False


class GrantLicenseRequest(BaseModel):
    email: str | None = None
    business_id: UUID | None = None
    plan: str = Field(default="pro", description="free, starter, pro, enterprise")
    duration_days: int | None = Field(default=365, description="None = Lifetime / bez terminu")
    custom_max_appointments: int | None = None
    custom_max_messages: int | None = None
    custom_max_seats: int | None = None
    custom_channels: list[str] | None = None
    notes: str | None = None


class GrantLicenseResponse(BaseModel):
    success: bool = True
    message: str
    business_id: UUID
    business_name: str
    owner_email: str
    plan: str
    license_status: str
    license_expires_at: datetime | None = None
    usage: LicenseUsageOut


class LicenseKeyCreate(BaseModel):
    plan: str = "pro"
    duration_days: int | None = 365
    max_uses: int = 1
    custom_key: str | None = None
    notes: str | None = None


class LicenseKeyOut(BaseModel):
    id: UUID
    key: str
    plan: str
    duration_days: int | None
    max_uses: int
    times_used: int
    is_active: bool
    expires_at: datetime | None
    notes: str | None
    created_at: datetime


class PlatformBusinessOut(BusinessOut):
    usage: LicenseUsageOut | None = None


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
        apply_plan_defaults(business, PLAN_FREE, start_trial=True)
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


@router.get("/plans", response_model=list[PlanCatalogItem])
async def list_plans(
    _admin: RequirePlatformAdmin,
) -> list[PlanCatalogItem]:
    return [PlanCatalogItem(**item) for item in limits_service.plans_catalog()]


@router.get("/businesses", response_model=list[PlatformBusinessOut])
async def list_businesses(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    include_usage: bool = Query(default=True),
) -> list[PlatformBusinessOut]:
    result = await db.execute(select(Business).order_by(Business.created_at.desc()))
    businesses = list(result.scalars().all())
    out: list[PlatformBusinessOut] = []
    for biz in businesses:
        usage = None
        if include_usage:
            snap = await limits_service.usage_snapshot(db, biz)
            usage = LicenseUsageOut(
                plan=snap.plan,
                license_status=snap.license_status,
                license_expires_at=snap.license_expires_at,
                is_active=snap.is_active,
                appointments_month=snap.appointments_month,
                max_appointments_month=snap.max_appointments_month,
                messages_month=snap.messages_month,
                max_messages_month=snap.max_messages_month,
                seats=snap.seats,
                max_seats=snap.max_seats,
                enabled_channels=snap.enabled_channels,
                period_start=snap.period_start,
                period_end=snap.period_end,
            )
        out.append(
            PlatformBusinessOut.model_validate(biz).model_copy(update={"usage": usage})
        )
    return out


@router.get("/businesses/{business_id}/usage", response_model=LicenseUsageOut)
async def business_usage(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    business_id: UUID,
) -> LicenseUsageOut:
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    if business is None:
        raise HTTPException(status_code=404, detail="Firma nie znaleziona")
    snap = await limits_service.usage_snapshot(db, business)
    return LicenseUsageOut(
        plan=snap.plan,
        license_status=snap.license_status,
        license_expires_at=snap.license_expires_at,
        is_active=snap.is_active,
        appointments_month=snap.appointments_month,
        max_appointments_month=snap.max_appointments_month,
        messages_month=snap.messages_month,
        max_messages_month=snap.max_messages_month,
        seats=snap.seats,
        max_seats=snap.max_seats,
        enabled_channels=snap.enabled_channels,
        period_start=snap.period_start,
        period_end=snap.period_end,
    )


@router.patch("/businesses/{business_id}", response_model=PlatformBusinessOut)
async def update_business(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    business_id: UUID,
    body: BusinessUpdatePlatform,
) -> PlatformBusinessOut:
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    if business is None:
        raise HTTPException(status_code=404, detail="Firma nie znaleziona")
    if body.name is not None:
        business.name = body.name.strip() or business.name
    if body.timezone is not None:
        business.timezone = body.timezone.strip() or business.timezone

    if body.plan is not None:
        if body.plan not in PLAN_DEFAULTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nieznany plan: {body.plan}",
            )
        if body.apply_plan_defaults:
            apply_plan_defaults(business, body.plan, start_trial=False)
            business.license_status = LICENSE_ACTIVE
        else:
            business.plan = body.plan

    if body.license_status is not None:
        business.license_status = body.license_status.strip().lower()
    if body.clear_expiry:
        business.license_expires_at = None
    elif body.license_expires_at is not None:
        business.license_expires_at = body.license_expires_at
    if "max_appointments_month" in body.model_fields_set:
        business.max_appointments_month = body.max_appointments_month
    if "max_messages_month" in body.model_fields_set:
        business.max_messages_month = body.max_messages_month
    if "max_seats" in body.model_fields_set:
        business.max_seats = body.max_seats
    if body.enabled_channels is not None:
        business.enabled_channels = body.enabled_channels

    await db.flush()
    snap = await limits_service.usage_snapshot(db, business)
    usage = LicenseUsageOut(
        plan=snap.plan,
        license_status=snap.license_status,
        license_expires_at=snap.license_expires_at,
        is_active=snap.is_active,
        appointments_month=snap.appointments_month,
        max_appointments_month=snap.max_appointments_month,
        messages_month=snap.messages_month,
        max_messages_month=snap.max_messages_month,
        seats=snap.seats,
        max_seats=snap.max_seats,
        enabled_channels=snap.enabled_channels,
        period_start=snap.period_start,
        period_end=snap.period_end,
    )
    return PlatformBusinessOut.model_validate(business).model_copy(
        update={"usage": usage}
    )


# ---------------------------------------------------------------------------
# Direct License Granting & License Keys Management
# ---------------------------------------------------------------------------


@router.post("/grant-license", response_model=GrantLicenseResponse)
async def grant_license(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    body: GrantLicenseRequest,
) -> GrantLicenseResponse:
    """Directly assign or upgrade a plan/license for any user/business with instant limits unlock."""
    business: Business | None = None
    target_owner: Owner | None = None

    if body.email:
        email_clean = body.email.strip().lower()
        res = await db.execute(
            select(Owner)
            .options(selectinload(Owner.business))
            .where(func.lower(Owner.email) == email_clean)
        )
        target_owner = res.scalar_one_or_none()
        if not target_owner or not target_owner.business:
            raise HTTPException(
                status_code=404,
                detail=f"Nie znaleziono konta lub firmy przypisanej do e-maila: {body.email}",
            )
        business = target_owner.business
    elif body.business_id:
        res = await db.execute(
            select(Business).where(Business.id == body.business_id)
        )
        business = res.scalar_one_or_none()
        if not business:
            raise HTTPException(status_code=404, detail="Firma nie znaleziona")
        owner_res = await db.execute(
            select(Owner).where(Owner.business_id == business.id)
        )
        target_owner = owner_res.scalars().first()
    else:
        raise HTTPException(
            status_code=400,
            detail="Podaj adres e-mail użytkownika lub identyfikator firmy",
        )

    plan_key = body.plan.strip().lower() if body.plan else "pro"
    if plan_key not in PLAN_DEFAULTS:
        plan_key = "pro"

    apply_plan_defaults(business, plan_key, start_trial=False)
    business.license_status = LICENSE_ACTIVE

    now = datetime.now(timezone.utc)
    if body.duration_days is not None and body.duration_days > 0:
        business.license_expires_at = now + timedelta(days=body.duration_days)
    else:
        business.license_expires_at = None  # Lifetime!

    # Optional custom limits overrides
    if body.custom_max_appointments is not None:
        business.max_appointments_month = body.custom_max_appointments
    if body.custom_max_messages is not None:
        business.max_messages_month = body.custom_max_messages
    if body.custom_max_seats is not None:
        business.max_seats = body.custom_max_seats
    if body.custom_channels is not None:
        business.enabled_channels = body.custom_channels

    await db.flush()
    await db.commit()
    await db.refresh(business)

    snap = await limits_service.usage_snapshot(db, business)
    usage = LicenseUsageOut(
        plan=snap.plan,
        license_status=snap.license_status,
        license_expires_at=snap.license_expires_at,
        is_active=snap.is_active,
        appointments_month=snap.appointments_month,
        max_appointments_month=snap.max_appointments_month,
        messages_month=snap.messages_month,
        max_messages_month=snap.max_messages_month,
        seats=snap.seats,
        max_seats=snap.max_seats,
        enabled_channels=snap.enabled_channels,
        period_start=snap.period_start,
        period_end=snap.period_end,
    )

    owner_email_str = target_owner.email if target_owner else "Brak e-maila"
    exp_str = (
        f"do {business.license_expires_at.strftime('%Y-%m-%d')}"
        if business.license_expires_at
        else "Dożywotnia VIP (Lifetime)"
    )

    return GrantLicenseResponse(
        success=True,
        message=f"Pomyślnie nadano licencję {plan_key.upper()} ({exp_str}) dla konta {owner_email_str} ({business.name}).",
        business_id=business.id,
        business_name=business.name,
        owner_email=owner_email_str,
        plan=business.plan,
        license_status=business.license_status,
        license_expires_at=business.license_expires_at,
        usage=usage,
    )


@router.get("/license-keys", response_model=list[LicenseKeyOut])
async def list_license_keys(
    db: DbSession,
    _admin: RequirePlatformAdmin,
) -> list[LicenseKeyOut]:
    result = await db.execute(
        select(LicenseKey).order_by(LicenseKey.created_at.desc())
    )
    return [
        LicenseKeyOut(
            id=k.id,
            key=k.key,
            plan=k.plan,
            duration_days=k.duration_days,
            max_uses=k.max_uses,
            times_used=k.times_used,
            is_active=k.is_active,
            expires_at=k.expires_at,
            notes=k.notes,
            created_at=k.created_at,
        )
        for k in result.scalars().all()
    ]


@router.post("/license-keys", response_model=LicenseKeyOut, status_code=status.HTTP_201_CREATED)
async def create_license_key(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    body: LicenseKeyCreate,
) -> LicenseKeyOut:
    plan_key = body.plan.strip().lower() if body.plan in PLAN_DEFAULTS else "pro"
    if body.custom_key and body.custom_key.strip():
        generated_key = body.custom_key.strip().upper()
    else:
        prefix = "BIZ"
        plan_tag = plan_key.upper()[:3]
        rand1 = secrets.token_hex(2).upper()
        rand2 = secrets.token_hex(2).upper()
        generated_key = f"{prefix}-{plan_tag}-{rand1}-{rand2}"

    # Verify uniqueness
    existing = await db.execute(select(LicenseKey).where(LicenseKey.key == generated_key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Klucz o takiej nazwie już istnieje")

    row = LicenseKey(
        key=generated_key,
        plan=plan_key,
        duration_days=body.duration_days,
        max_uses=max(1, body.max_uses),
        times_used=0,
        is_active=True,
        notes=body.notes.strip() if body.notes else None,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(row)

    return LicenseKeyOut(
        id=row.id,
        key=row.key,
        plan=row.plan,
        duration_days=row.duration_days,
        max_uses=row.max_uses,
        times_used=row.times_used,
        is_active=row.is_active,
        expires_at=row.expires_at,
        notes=row.notes,
        created_at=row.created_at,
    )


@router.delete("/license-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_license_key(
    db: DbSession,
    _admin: RequirePlatformAdmin,
    key_id: UUID,
) -> Response:
    row = await db.get(LicenseKey, key_id)
    if row:
        await db.delete(row)
        await db.flush()
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
