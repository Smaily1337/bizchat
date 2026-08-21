"""Resolve which salon owns an inbound Meta/WhatsApp webhook."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Business

logger = logging.getLogger(__name__)


async def resolve_meta_business_id(
    db: AsyncSession,
    *,
    query_business_id: UUID | None,
    page_id: str | None = None,
) -> UUID | None:
    """Pick salon for Messenger/IG/WhatsApp inbound without dropping webhook messages.

    Order:
    1. ?business_id= on the webhook URL
    2. META_DEFAULT_BUSINESS_ID env
    3. Business.settings matching payload page id or instagram account id
    4. Business with connected Meta/Facebook tokens
    5. Sole / primary business in the database
    """
    if query_business_id is not None:
        return query_business_id

    if settings.meta_default_business_id:
        try:
            return UUID(settings.meta_default_business_id)
        except ValueError:
            logger.warning(
                "Invalid META_DEFAULT_BUSINESS_ID=%r",
                settings.meta_default_business_id,
            )

    all_businesses = (await db.execute(select(Business))).scalars().all()
    if not all_businesses:
        logger.error("Meta webhook: no business records found in database.")
        return None

    # Exact page ID or Instagram ID match in settings
    if page_id:
        norm_page_id = str(page_id).strip()
        for biz in all_businesses:
            settings_map = biz.settings if isinstance(biz.settings, dict) else {}
            for key in ("meta_page_id", "facebook_page_id", "instagram_account_id", "instagram_id", "page_id"):
                val = str(settings_map.get(key) or "").strip()
                if val and val == norm_page_id:
                    return biz.id

    # Fallback to business with active Meta connection tokens
    for biz in all_businesses:
        settings_map = biz.settings if isinstance(biz.settings, dict) else {}
        if (
            settings_map.get("meta_page_access_token")
            or settings_map.get("facebook_page_access_token")
            or settings_map.get("meta_access_token")
            or settings_map.get("meta_connected")
        ):
            logger.info("Meta webhook: resolving to business %s with connected Meta token", biz.id)
            return biz.id

    # Fallback: single business or first primary business in the database
    primary_biz = all_businesses[0]
    logger.info(
        "Meta webhook: falling back to primary business %s (%s) for page_id=%s",
        primary_biz.id,
        primary_biz.name,
        page_id,
    )
    return primary_biz.id


async def remember_meta_page_id(
    db: AsyncSession, business_id: UUID, page_id: str | None
) -> None:
    """Persist Facebook page id on the salon so later webhooks resolve immediately."""
    if not page_id:
        return
    biz = await db.get(Business, business_id)
    if biz is None:
        return
    settings_map = dict(biz.settings or {})
    if settings_map.get("meta_page_id") == str(page_id):
        return
    settings_map["meta_page_id"] = str(page_id)
    biz.settings = settings_map
    await db.flush()
