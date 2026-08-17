"""Business settings — get/update current owner's salon."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentOwner, DbSession
from app.models import Business
from app.schemas import BusinessOut, BusinessUpdate, LicenseUsageOut
from app.services import limits as limits_service

router = APIRouter(prefix="/api/business", tags=["business"])


@router.get("", response_model=BusinessOut)
async def get_business(db: DbSession, owner: CurrentOwner) -> Business:
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@router.get("/usage", response_model=LicenseUsageOut)
async def get_usage(db: DbSession, owner: CurrentOwner) -> LicenseUsageOut:
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")
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


@router.patch("", response_model=BusinessOut)
async def update_business(
    db: DbSession,
    owner: CurrentOwner,
    body: BusinessUpdate,
) -> Business:
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(business, key, value)
    await db.flush()
    return business
