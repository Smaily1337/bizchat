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


async def fetch_messenger_profile_name(psid: str) -> str | None:
    """Resolve Facebook/Messenger display name for a Page-Scoped ID."""
    token = settings.meta_page_access_token
    if not token or not psid:
        return None
    url = f"https://graph.facebook.com/v21.0/{psid}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                url,
                params={
                    "fields": "name,first_name,last_name",
                    "access_token": token,
                },
            )
            if resp.is_error:
                logger.info(
                    "Meta profile fetch failed psid=%s status=%s body=%s",
                    psid,
                    resp.status_code,
                    resp.text[:200],
                )
                return None
            data = resp.json()
            name = (data.get("name") or "").strip()
            if name:
                return name
            parts = [data.get("first_name") or "", data.get("last_name") or ""]
            joined = " ".join(p for p in parts if p).strip()
            return joined or None
    except Exception as exc:  # noqa: BLE001
        logger.info("Meta profile fetch error psid=%s: %s", psid, exc)
        return None


class MetaAdapter(ChannelAdapter):
    def __init__(self, business_id: UUID | None = None) -> None:
        self.business_id = business_id

    def to_inbound(self, payload: dict[str, Any]) -> list[InboundMessage]:
        messages: list[InboundMessage] = []
        for entry in payload.get("entry") or []:
            for event in entry.get("messaging") or []:
                inbound = self._parse_messaging_event(event, Channel.messenger)
                if inbound:
                    messages.append(inbound)

            for event in entry.get("standby") or []:
                inbound = self._parse_messaging_event(event, Channel.messenger)
                if inbound:
                    messages.append(inbound)

            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                for ig_msg in value.get("messages") or []:
                    text = (ig_msg.get("text") or {}).get("body") or ig_msg.get("text")
                    if isinstance(text, dict):
                        text = text.get("body")
                    if not text:
                        continue
                    sender = value.get("sender") or {}
                    sender_id = str(sender.get("id") or ig_msg.get("from") or "")
                    messages.append(
                        InboundMessage(
                            channel=Channel.instagram,
                            business_id=self.business_id,
                            external_user_id=sender_id,
                            external_thread_id=sender_id,
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

        # Quick reply / postback buttons (confirm / cancel)
        postback = event.get("postback") or {}
        if postback.get("payload"):
            return InboundMessage(
                channel=channel,
                business_id=self.business_id,
                external_user_id=sender_id,
                external_thread_id=sender_id,
                text=str(postback["payload"]),
                raw_payload=event,
            )

        msg = event.get("message")
        if not msg or msg.get("is_echo"):
            return None
        quick = msg.get("quick_reply") or {}
        if quick.get("payload"):
            return InboundMessage(
                channel=channel,
                business_id=self.business_id,
                external_user_id=sender_id,
                external_thread_id=sender_id,
                text=str(quick["payload"]),
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
            else:
                return None
        return InboundMessage(
            channel=channel,
            business_id=self.business_id,
            external_user_id=sender_id,
            external_thread_id=sender_id,
            text=text,
            raw_payload=event,
        )

    async def send_outbound(
        self,
        message: OutboundMessage,
        *,
        messaging_type: str = "RESPONSE",
        tag: str | None = None,
    ) -> bool:
        """Send a Messenger/IG message. Returns True on success.

        For panel outreach outside the standard reply window, pass
        messaging_type=\"MESSAGE_TAG\" and tag=\"HUMAN_AGENT\".
        Optional metadata.quick_replies: [{title, payload}, ...]
        """
        token = settings.meta_page_access_token
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
