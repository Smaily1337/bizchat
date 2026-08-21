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

class MetaDirectConnectRequest(BaseModel):
    page_id: str
    access_token: str
    page_name: str | None = None

class MetaPageUpdateRequest(BaseModel):
    about: str | None = None
    description: str | None = None
    phone: str | None = None
    website: str | None = None

class MetaPagePictureRequest(BaseModel):
    picture_url: str

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


class RedeemLicenseRequest(BaseModel):
    key: str


class RedeemLicenseResponse(BaseModel):
    success: bool = True
    message: str
    plan: str
    license_status: str
    license_expires_at: datetime | None = None
    usage: LicenseUsageOut


@router.post("/redeem-license", response_model=RedeemLicenseResponse)
async def redeem_license(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: RedeemLicenseRequest,
) -> RedeemLicenseResponse:
    raw_key = body.key.strip().upper()
    if not raw_key:
        raise HTTPException(status_code=400, detail="Wpisz kod licencji")

    from app.models import LicenseKey
    from sqlalchemy import select
    from datetime import datetime, timezone, timedelta
    from app.services.limits import PLAN_DEFAULTS, LICENSE_ACTIVE, apply_plan_defaults

    res = await db.execute(
        select(LicenseKey).where(LicenseKey.key == raw_key)
    )
    lic = res.scalar_one_or_none()
    if lic is None:
        raise HTTPException(
            status_code=404,
            detail="Podany kod licencji jest nieprawidłowy lub nie istnieje",
        )

    if not lic.is_active or lic.times_used >= lic.max_uses:
        raise HTTPException(
            status_code=400,
            detail="Ten kod licencji został już w pełni wykorzystany lub został wyłączony",
        )

    now = datetime.now(timezone.utc)
    if lic.expires_at and lic.expires_at < now:
        raise HTTPException(
            status_code=400,
            detail="Ten kod licencji wygasł i nie może być aktywowany",
        )

    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Firma nie znaleziona")

    plan_key = lic.plan.lower() if lic.plan in PLAN_DEFAULTS else "pro"
    apply_plan_defaults(business, plan_key, start_trial=False)
    business.license_status = LICENSE_ACTIVE

    if lic.duration_days and lic.duration_days > 0:
        # If currently active, extend or set
        base_date = business.license_expires_at if (business.license_expires_at and business.license_expires_at > now) else now
        business.license_expires_at = base_date + timedelta(days=lic.duration_days)
    else:
        business.license_expires_at = None  # Lifetime!

    lic.times_used += 1
    if lic.times_used >= lic.max_uses:
        lic.is_active = False

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

    exp_info = (
        f"do {business.license_expires_at.strftime('%Y-%m-%d')}"
        if business.license_expires_at
        else "Dożywotnia VIP (Lifetime)"
    )

    return RedeemLicenseResponse(
        success=True,
        message=f"🎉 Sukces! Pomyślnie aktywowano pakiet {plan_key.upper()} ({exp_info}). Wszystkie limity zostały podniesione.",
        plan=business.plan,
        license_status=business.license_status,
        license_expires_at=business.license_expires_at,
        usage=usage,
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


@router.post("/meta-direct-connect")
async def direct_connect_meta(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: MetaDirectConnectRequest,
) -> dict:
    """Connect a Meta Facebook Page directly via Page ID and Page Access Token."""
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    page_id = body.page_id.strip()
    page_token = body.access_token.strip()
    page_name = body.page_name.strip() if body.page_name else None

    if not page_id or not page_token:
        raise HTTPException(status_code=400, detail="Wymagane jest podanie Page ID oraz Page Access Token.")

    # Verify token by calling Meta Graph API
    async with httpx.AsyncClient() as client:
        test_resp = await client.get(
            f"https://graph.facebook.com/v21.0/{page_id}",
            params={"fields": "id,name,picture", "access_token": page_token},
        )
        if test_resp.is_error:
            raise HTTPException(
                status_code=400,
                detail=f"Błąd weryfikacji tokena w Meta: {test_resp.text}",
            )
        data = test_resp.json()
        verified_name = data.get("name") or page_name or f"Page {page_id}"

        # Subscribe webhooks
        sub_resp = await client.post(
            f"https://graph.facebook.com/v21.0/{page_id}/subscribed_apps",
            params={
                "subscribed_fields": "messages,messaging_postbacks,messaging_optins,message_reads,standby",
                "access_token": page_token,
            },
        )
        if sub_resp.is_error:
            logger.warning("Webhook subscription returned %s: %s", sub_resp.status_code, sub_resp.text)

    settings_map = dict(business.settings or {})
    settings_map["meta_page_id"] = page_id
    settings_map["meta_page_name"] = verified_name
    settings_map["meta_page_access_token"] = page_token
    business.settings = settings_map
    await db.flush()

    return {"ok": True, "page_id": page_id, "page_name": verified_name}


@router.get("/meta-details")
async def get_meta_page_details(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
) -> dict:
    """Fetch live metadata of connected Facebook page."""
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    settings_map = dict(business.settings or {})
    page_id = settings_map.get("meta_page_id")
    page_token = settings_map.get("meta_page_access_token")

    if not page_id or not page_token:
        return {"connected": False}

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/v21.0/{page_id}",
            params={
                "fields": "id,name,about,description,phone,website,emails,picture{url},followers_count",
                "access_token": page_token,
            },
        )
        if resp.is_error:
            return {
                "connected": True,
                "page_id": page_id,
                "page_name": settings_map.get("meta_page_name"),
                "error": resp.text,
            }
        data = resp.json()
        return {
            "connected": True,
            "page_id": data.get("id"),
            "page_name": data.get("name"),
            "about": data.get("about"),
            "description": data.get("description"),
            "phone": data.get("phone"),
            "website": data.get("website"),
            "emails": data.get("emails", []),
            "picture_url": (data.get("picture") or {}).get("data", {}).get("url"),
            "followers_count": data.get("followers_count"),
        }


@router.post("/meta-page-update")
async def update_meta_page(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: MetaPageUpdateRequest,
) -> dict:
    """Update Facebook Page about, description, phone, website."""
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    settings_map = dict(business.settings or {})
    page_id = settings_map.get("meta_page_id")
    page_token = settings_map.get("meta_page_access_token")

    if not page_id or not page_token:
        raise HTTPException(status_code=400, detail="Brak podłączonego profilu Meta.")

    payload: dict = {}
    if body.about is not None:
        payload["about"] = body.about
    if body.description is not None:
        payload["description"] = body.description
    if body.phone is not None:
        payload["phone"] = body.phone
    if body.website is not None:
        payload["website"] = body.website

    if not payload:
        return {"ok": True, "message": "Brak zmian"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/v21.0/{page_id}",
            params={"access_token": page_token},
            json=payload,
        )
        if resp.is_error:
            raise HTTPException(
                status_code=400,
                detail=f"Błąd aktualizacji strony w Meta: {resp.text}",
            )
        return {"ok": True, "result": resp.json()}


@router.post("/meta-page-picture")
async def change_meta_page_picture(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: MetaPagePictureRequest,
) -> dict:
    """Update Facebook Page profile picture using an image URL."""
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    settings_map = dict(business.settings or {})
    page_id = settings_map.get("meta_page_id")
    page_token = settings_map.get("meta_page_access_token")

    if not page_id or not page_token:
        raise HTTPException(status_code=400, detail="Brak podłączonego profilu Meta.")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/v21.0/{page_id}/picture",
            params={
                "access_token": page_token,
                "url": body.picture_url.strip(),
            },
        )
        if resp.is_error:
            raise HTTPException(
                status_code=400,
                detail=f"Błąd zmiany zdjęcia profilowego w Meta: {resp.text}",
            )
        return {"ok": True, "result": resp.json()}


@router.post("/meta-disconnect")
async def disconnect_meta_page(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
) -> dict:
    """Disconnect currently linked Facebook page and remove stored tokens."""
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    settings_map = dict(business.settings or {})
    page_id = settings_map.pop("meta_page_id", None)
    page_token = settings_map.pop("meta_page_access_token", None)
    settings_map.pop("meta_page_name", None)
    business.settings = settings_map
    await db.flush()

    if page_id and page_token:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                await client.delete(
                    f"https://graph.facebook.com/v21.0/{page_id}/subscribed_apps",
                    params={"access_token": page_token},
                )
        except Exception:
            pass

    return {"ok": True, "message": "Pomyślnie odłączono stronę Facebook."}


class GeminiConfigRequest(BaseModel):
    gemini_api_key: str | None = None
    gemini_model: str | None = "gemini-2.0-flash"


@router.post("/gemini-config")
async def save_gemini_config(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: GeminiConfigRequest,
) -> dict:
    """Configure Google Gemini AI for salon bot."""
    business = await db.get(Business, owner.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Business not found")

    settings_map = dict(business.settings or {})
    if body.gemini_api_key is not None:
        settings_map["gemini_api_key"] = body.gemini_api_key.strip()
    if body.gemini_model:
        settings_map["gemini_model"] = body.gemini_model.strip()
    business.settings = settings_map
    await db.flush()
    return {"ok": True, "message": "Konfiguracja Gemini AI została pomyślnie zapisana."}


