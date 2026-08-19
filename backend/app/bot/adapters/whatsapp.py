"""WhatsApp Cloud API (Meta) adapter."""

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


class WhatsAppAdapter(ChannelAdapter):
    def __init__(self, business_id: UUID | None = None) -> None:
        self.business_id = business_id

    def to_inbound(self, payload: dict[str, Any]) -> list[InboundMessage]:
        messages: list[InboundMessage] = []
        for entry in payload.get("entry") or []:
            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                for msg in value.get("messages") or []:
                    text = ""
                    if msg.get("type") == "text":
                        text = (msg.get("text") or {}).get("body") or ""
                    elif msg.get("type") == "button":
                        text = (msg.get("button") or {}).get("text") or ""
                    elif msg.get("type") == "interactive":
                        interactive = msg.get("interactive") or {}
                        btn = interactive.get("button_reply") or interactive.get(
                            "list_reply"
                        ) or {}
                        text = btn.get("id") or btn.get("title") or ""
                    if not text:
                        continue
                    sender = str(msg.get("from") or "")
                    messages.append(
                        InboundMessage(
                            channel=Channel.whatsapp,
                            business_id=self.business_id,
                            external_user_id=sender,
                            external_thread_id=sender,
                            text=str(text),
                            raw_payload=msg,
                        )
                    )
        return messages

    async def send_outbound(self, message: OutboundMessage) -> bool:
        phone_id = settings.whatsapp_phone_number_id
        token = settings.whatsapp_access_token or settings.meta_page_access_token
        if not phone_id or not token:
            logger.info(
                "WhatsApp stub send → to=%s text=%r",
                message.external_thread_id,
                message.text,
            )
            return False

        url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
        body: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": message.external_thread_id,
            "type": "text",
            "text": {"body": message.text},
        }
        buttons = message.metadata.get("quick_replies") or []
        if buttons:
            body = {
                "messaging_product": "whatsapp",
                "to": message.external_thread_id,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": message.text[:1024]},
                    "action": {
                        "buttons": [
                            {
                                "type": "reply",
                                "reply": {
                                    "id": str(b.get("payload") or b.get("title"))[:256],
                                    "title": str(b.get("title"))[:20],
                                },
                            }
                            for b in buttons[:3]
                        ]
                    },
                },
            }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json=body,
            )
            if resp.is_error:
                logger.error(
                    "WhatsApp send failed to=%s status=%s body=%s",
                    message.external_thread_id,
                    resp.status_code,
                    resp.text[:500],
                )
                message.metadata["whatsapp_error"] = resp.text[:500]
                return False
            return True
