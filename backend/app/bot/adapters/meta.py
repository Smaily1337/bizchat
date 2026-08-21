"""Meta Messenger / Instagram adapter."""

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


async def fetch_messenger_profile_name(psid: str, token: str | None = None) -> str | None:
    """Resolve Facebook/Messenger display name for a Page-Scoped ID with fast timeout."""
    token = token or settings.meta_page_access_token
    if not token or not psid:
        return None
    url = f"https://graph.facebook.com/v21.0/{psid}"
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(
                url,
                params={
                    "fields": "name,first_name,last_name",
                    "access_token": token,
                },
            )
            if resp.is_error:
                return None
            data = resp.json()
            name = (data.get("name") or "").strip()
            if name:
                return name
            parts = [data.get("first_name") or "", data.get("last_name") or ""]
            joined = " ".join(p for p in parts if p).strip()
            return joined or None
    except Exception:  # noqa: BLE001
        return None


class MetaAdapter(ChannelAdapter):
    def __init__(self, business_id: UUID | None = None) -> None:
        self.business_id = business_id

    def to_inbound(self, payload: dict[str, Any]) -> list[InboundMessage]:
        messages: list[InboundMessage] = []
        is_instagram_obj = payload.get("object") in {"instagram", "instagram_business_account"}
        default_channel = Channel.instagram if is_instagram_obj else Channel.messenger

        for entry in payload.get("entry") or []:
            for event in entry.get("messaging") or []:
                inbound = self._parse_messaging_event(event, default_channel)
                if inbound:
                    messages.append(inbound)

            for event in entry.get("standby") or []:
                inbound = self._parse_messaging_event(event, default_channel)
                if inbound:
                    messages.append(inbound)

            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                # 1. Array of messages
                raw_msgs = value.get("messages") or []
                # 2. Single message object or string
                if not raw_msgs and value.get("message"):
                    raw_msgs = [value.get("message")]

                for ig_msg in raw_msgs:
                    text = None
                    if isinstance(ig_msg, dict):
                        text = (ig_msg.get("text") or {}).get("body") or ig_msg.get("text") or ig_msg.get("body")
                        if isinstance(text, dict):
                            text = text.get("body")
                    elif isinstance(ig_msg, str):
                        text = ig_msg

                    if not text:
                        if isinstance(ig_msg, dict) and ig_msg.get("attachments"):
                            text = "[załącznik / zdjęcie]"
                        else:
                            continue

                    sender = value.get("sender") or value.get("from") or {}
                    sender_id = str(
                        (sender.get("id") if isinstance(sender, dict) else sender)
                        or (ig_msg.get("from") if isinstance(ig_msg, dict) else "")
                        or ""
                    )
                    if not sender_id:
                        sender_id = "instagram_user"

                    sender_name = None
                    if isinstance(sender, dict):
                        sender_name = sender.get("username") or sender.get("name")

                    messages.append(
                        InboundMessage(
                            channel=Channel.instagram,
                            business_id=self.business_id,
                            external_user_id=sender_id,
                            external_thread_id=sender_id,
                            display_name=sender_name,
                            text=str(text),
                            raw_payload={"entry": entry, "message": ig_msg},
                        )
                    )
        return messages

    def _parse_messaging_event(
        self, event: dict[str, Any], channel: Channel
    ) -> InboundMessage | None:
        sender = event.get("sender") or {}
        sender_id = str(sender.get("id", ""))
        if not sender_id:
            return None

        # Quick reply / postback buttons (confirm / cancel)
        postback = event.get("postback") or {}
        if postback:
            pb_text = postback.get("payload") or postback.get("title") or "Kliknięto przycisk"
            return InboundMessage(
                channel=channel,
                business_id=self.business_id,
                external_user_id=sender_id,
                external_thread_id=sender_id,
                text=str(pb_text),
                raw_payload=event,
            )

        msg = event.get("message")
        if not msg or msg.get("is_echo"):
            return None

        quick = msg.get("quick_reply") or {}
        if quick:
            qr_text = quick.get("payload") or quick.get("title") or msg.get("text")
            if qr_text:
                return InboundMessage(
                    channel=channel,
                    business_id=self.business_id,
                    external_user_id=sender_id,
                    external_thread_id=sender_id,
                    text=str(qr_text),
                    raw_payload=event,
                )

        text = msg.get("text")
        if not text:
            # Stickers / images / voice — still open an Inbox thread
            if msg.get("attachments"):
                kinds = []
                for att in msg.get("attachments") or []:
                    kinds.append(str(att.get("type") or "plik"))
                text = f"[załącznik: {', '.join(kinds) or 'media'}]"
            elif msg.get("sticker_id"):
                text = "[naklejka]"
            else:
                return None

        return InboundMessage(
            channel=channel,
            business_id=self.business_id,
            external_user_id=sender_id,
            external_thread_id=sender_id,
            text=str(text),
            raw_payload=event,
        )

    async def _get_page_token(self) -> str | None:
        from app.config import settings
        if self.business_id:
            from app.db.session import AsyncSessionLocal
            from app.models import Business
            async with AsyncSessionLocal() as db:
                biz = await db.get(Business, self.business_id)
                if biz and isinstance(biz.settings, dict):
                    t = biz.settings.get("meta_page_access_token")
                    if t:
                        return str(t)
        return settings.meta_page_access_token

    async def send_outbound(
        self,
        message: OutboundMessage,
        *,
        messaging_type: str = "RESPONSE",
        tag: str | None = None,
    ) -> bool:
        """Send a Messenger/IG message. Returns True on success.

        For panel outreach outside the standard reply window, pass
        messaging_type="MESSAGE_TAG" and tag="HUMAN_AGENT".
        Optional metadata.quick_replies: [{title, payload}, ...]
        """
        token = await self._get_page_token()
        quick = message.metadata.get("quick_replies") or []
        msg_body: dict[str, Any] = {"text": message.text}
        if quick:
            msg_body["quick_replies"] = [
                {
                    "content_type": "text",
                    "title": str(item.get("title"))[:20],
                    "payload": str(item.get("payload") or item.get("title"))[:1000],
                }
                for item in quick[:13]
            ]

        if not token:
            logger.info(
                "Meta stub send → recipient=%s text=%r type=%s tag=%s qr=%s",
                message.external_thread_id,
                message.text,
                messaging_type,
                tag,
                bool(quick),
            )
            return False

        url = "https://graph.facebook.com/v21.0/me/messages"
        payload: dict[str, Any] = {
            "recipient": {"id": message.external_thread_id},
            "message": msg_body,
            "messaging_type": messaging_type,
        }
        if tag:
            payload["tag"] = tag

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                params={"access_token": token},
                json=payload,
            )
            if (
                resp.is_error
                and messaging_type == "RESPONSE"
                and tag is None
            ):
                logger.info(
                    "Meta RESPONSE failed — retry HUMAN_AGENT recipient=%s body=%s",
                    message.external_thread_id,
                    resp.text[:300],
                )
                retry_payload = {
                    "recipient": {"id": message.external_thread_id},
                    "message": msg_body,
                    "messaging_type": "MESSAGE_TAG",
                    "tag": "HUMAN_AGENT",
                }
                resp = await client.post(
                    url,
                    params={"access_token": token},
                    json=retry_payload,
                )
            if resp.is_error:
                logger.error(
                    "Meta send failed recipient=%s status=%s body=%s",
                    message.external_thread_id,
                    resp.status_code,
                    resp.text[:500],
                )
                message.metadata["meta_error"] = resp.text[:500]
                message.metadata["meta_status"] = resp.status_code
                return False
            return True

    async def send_proactive(self, message: OutboundMessage) -> bool:
        """Owner-initiated outreach (no prior inbound in this session)."""
        return await self.send_outbound(
            message,
            messaging_type="MESSAGE_TAG",
            tag="HUMAN_AGENT",
        )
