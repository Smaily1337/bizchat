"""Telegram webhook."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, status

from app.api.deps import DbSession
from app.bot.adapters.telegram import TelegramAdapter
from app.bot.engine import CoreBotEngine
from app.config import settings
from app.services.webhook_business import resolve_meta_business_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/telegram", tags=["webhooks"])


@router.post("")
async def telegram_webhook(
    request: Request,
    db: DbSession,
    business_id: UUID | None = Query(None),
    x_telegram_bot_api_secret_token: str | None = Header(None),
) -> dict:
    if settings.telegram_webhook_secret:
        if x_telegram_bot_api_secret_token != settings.telegram_webhook_secret:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Telegram webhook secret",
            )

    resolved = await resolve_meta_business_id(
        db,
        query_business_id=business_id,
        page_id=None,
    )
    if resolved is None and settings.meta_default_business_id:
        try:
            resolved = UUID(settings.meta_default_business_id)
        except ValueError:
            resolved = None
    if resolved is None:
        logger.error("Telegram webhook dropped: no business_id")
        return {
            "ok": False,
            "error": "business_id_missing",
            "hint": "Add ?business_id=<salon-uuid> to the Telegram webhook URL",
        }

    payload = await request.json()
    adapter = TelegramAdapter(business_id=resolved)
    engine = CoreBotEngine(db, adapter)

    inbound_list = adapter.to_inbound(payload)
    replies = []
    for inbound in inbound_list:
        try:
            outbound = await engine.handle(inbound)
            replies.append(outbound.text)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Telegram inbound failed user=%s",
                inbound.external_user_id,
            )

    return {
        "ok": True,
        "handled": len(replies),
        "replies": replies,
        "business_id": str(resolved),
    }
