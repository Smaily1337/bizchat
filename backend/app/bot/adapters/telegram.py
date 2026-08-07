"""Telegram Bot API adapter."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import httpx

from app.bot.adapters.base import ChannelAdapter
from app.config import settings
from app.models.enums import Channel
from app.schemas import InboundMessage, OutboundMessage

logger = logging.getLogger(__name__)


class TelegramAdapter(ChannelAdapter):
    def __init__(self, business_id: UUID | None = None) -> None:
        self.business_id = business_id

    def to_inbound(self, payload: dict[str, Any]) -> list[InboundMessage]:
        message = payload.get("message") or payload.get("edited_message")
        if not message:
            return []

        chat = message.get("chat") or {}
        from_user = message.get("from") or {}
        text = message.get("text") or message.get("caption") or ""
        if not text:
            return []

        chat_id = str(chat.get("id", ""))
        user_id = str(from_user.get("id", chat_id))
        name_parts = [
            from_user.get("first_name") or "",
            from_user.get("last_name") or "",
        ]
        display_name = " ".join(p for p in name_parts if p).strip() or None

        return [
            InboundMessage(
                channel=Channel.telegram,
                business_id=self.business_id,
                external_user_id=user_id,
                external_thread_id=chat_id,
                text=text,
                raw_payload=payload,
                display_name=display_name,
            )
        ]

    async def send_outbound(self, message: OutboundMessage) -> bool:
        token = settings.telegram_bot_token
        if not token:
            logger.info(
                "Telegram stub send → chat=%s text=%r",
                message.external_thread_id,
                message.text,
            )
            return False

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                json={
                    "chat_id": message.external_thread_id,
                    "text": message.text,
                },
            )
            if resp.is_error:
                logger.error("Telegram send failed: %s", resp.text[:300])
                return False
            return True
