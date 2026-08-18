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
    """Pick salon for Messenger/IG/WhatsApp inbound.

    Order:
    1. ?business_id= on the webhook URL
    2. META_DEFAULT_BUSINESS_ID env
    3. Business.settings.meta_page_id matching payload page id
    4. Sole business in the database (typical single-salon Cloud Run)
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

    if page_id:
        result = await db.execute(select(Business))
        for biz in result.scalars().all():
            settings_map = biz.settings if isinstance(biz.settings, dict) else {}
            stored = str(
                settings_map.get("meta_page_id")
                or settings_map.get("facebook_page_id")
                or ""
            ).strip()
            if stored and stored == str(page_id).strip():
                return biz.id

    count = (
        await db.execute(select(func.count()).select_from(Business))
    ).scalar_one()
    if count == 1:
        sole = (await db.execute(select(Business))).scalar_one()
        logger.info(
            "Meta webhook: using sole business_id=%s (no query/env page map)",
            sole.id,
        )
        return sole.id

    logger.warning(
        "Meta webhook: cannot resolve business_id (query=%s page_id=%s businesses=%s)",
        query_business_id,
        page_id,
        count,
    )
    return None


async def remember_meta_page_id(
    db: AsyncSession, business_id: UUID, page_id: str | None
) -> None:
    """Persist Facebook page id on the salon so later webhooks resolve without query."""
    if not page_id:
        return
    biz = await db.get(Business, business_id)
    if biz is None:
        return
    settings_map = dict(biz.settings or {})
    if settings_map.get("meta_page_id") == page_id:
        return
    settings_map["meta_page_id"] = str(page_id)
    biz.settings = settings_map
    await db.flush()
