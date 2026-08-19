"""Business settings — get/update current owner's salon."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentOwner, DbSession, RequireOwnerOrAdmin
from app.models import Business
from app.schemas import BusinessOut, BusinessUpdate, LicenseUsageOut
import logging
from app.services import limits as limits_service
import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class MetaLinkRequest(BaseModel):
    access_token: str

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
    owner: RequireOwnerOrAdmin,
    body: BusinessUpdate,
) -> Business:
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    data = body.model_dump(exclude_unset=True)
    if "public_slug" in data and data["public_slug"]:
        data["public_slug"] = str(data["public_slug"]).strip().lower()
    for key, value in data.items():
        setattr(business, key, value)
    await db.flush()
    return business

@router.post("/meta-link")
async def link_meta_account(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: MetaLinkRequest,
) -> dict:
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    user_token = body.access_token
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.facebook.com/v21.0/me/accounts",
            params={"access_token": user_token}
        )
        if resp.is_error:
            raise HTTPException(status_code=400, detail="Failed to fetch Meta pages: " + resp.text)
        data = resp.json()
        pages = data.get("data", [])
        if not pages:
            raise HTTPException(status_code=400, detail="No Meta pages found for this user.")

        page = pages[0]
        page_id = page.get("id")
        page_name = page.get("name")
        page_token = page.get("access_token")

        if not page_id or not page_token:
            raise HTTPException(status_code=400, detail="Invalid Meta page data returned.")

        settings_map = dict(business.settings or {})
        settings_map["meta_page_id"] = str(page_id)
        settings_map["meta_page_name"] = str(page_name)
        settings_map["meta_page_access_token"] = str(page_token)
        business.settings = settings_map
        await db.flush()

        # Subscribe app to page webhooks
        sub_resp = await client.post(
            f"https://graph.facebook.com/v21.0/{page_id}/subscribed_apps",
            params={
                "subscribed_fields": "messages,messaging_postbacks,messaging_optins,message_reads,standby",
                "access_token": page_token,
            },
        )
        if sub_resp.is_error:
            logger.warning(
                "Meta webhook subscription for page %s (%s) returned status %s: %s",
                page_id,
                page_name,
                sub_resp.status_code,
                sub_resp.text,
            )
        else:
            logger.info("Successfully subscribed webhook for Meta page %s (%s)", page_id, page_name)

        return {"ok": True, "page_id": page_id, "page_name": page_name}
