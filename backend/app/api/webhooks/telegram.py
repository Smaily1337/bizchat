"""Telegram webhook."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, status

from app.api.deps import DbSession
from app.bot.adapters.telegram import TelegramAdapter
from app.bot.engine import CoreBotEngine
from app.config import settings

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

    payload = await request.json()
    adapter = TelegramAdapter(business_id=business_id)
    engine = CoreBotEngine(db, adapter)

    inbound_list = adapter.to_inbound(payload)
    replies = []
    for inbound in inbound_list:
        outbound = await engine.handle(inbound)
        replies.append(outbound.text)

    return {"ok": True, "handled": len(inbound_list), "replies": replies}
