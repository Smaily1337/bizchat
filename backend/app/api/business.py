"""Business settings — get/update current owner's salon."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentOwner, DbSession
from app.models import Business
from app.schemas import BusinessOut, BusinessUpdate

router = APIRouter(prefix="/api/business", tags=["business"])


@router.get("", response_model=BusinessOut)
async def get_business(db: DbSession, owner: CurrentOwner) -> Business:
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


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
