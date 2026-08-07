"""WWW widget adapter — JWT/session stub."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import InvalidTokenError

from app.bot.adapters.base import ChannelAdapter
from app.config import settings
from app.models.enums import Channel
from app.schemas import InboundMessage, OutboundMessage

logger = logging.getLogger(__name__)


class WidgetAdapter(ChannelAdapter):
    def __init__(self, business_id: UUID | None = None) -> None:
        self.business_id = business_id

    def to_inbound(self, payload: dict[str, Any]) -> list[InboundMessage]:
        text = (payload.get("text") or "").strip()
        if not text:
            return []

        session = payload.get("session") or {}
        business_id = payload.get("business_id") or self.business_id
        if isinstance(business_id, str):
            business_id = UUID(business_id)

        external_user_id = str(
            session.get("sub")
            or payload.get("external_user_id")
            or session.get("session_id")
            or "anonymous"
        )
        thread_id = str(
            payload.get("external_thread_id")
            or session.get("session_id")
            or external_user_id
        )

        return [
            InboundMessage(
                channel=Channel.widget,
                business_id=business_id,
                external_user_id=external_user_id,
                external_thread_id=thread_id,
                text=text,
                raw_payload=payload,
                display_name=session.get("name"),
            )
        ]

    async def send_outbound(self, message: OutboundMessage) -> None:
        # Widget replies are returned synchronously in the HTTP response.
        logger.debug(
            "Widget outbound buffered thread=%s text=%r",
            message.external_thread_id,
            message.text,
        )

    @staticmethod
    def create_session_token(
        *,
        business_id: UUID,
        session_id: str,
        name: str | None = None,
        expires_minutes: int = 60 * 24 * 7,
    ) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": session_id,
            "business_id": str(business_id),
            "name": name,
            "iat": now,
            "exp": now + timedelta(minutes=expires_minutes),
            "typ": "widget",
        }
        return jwt.encode(payload, settings.widget_jwt_secret, algorithm="HS256")

    @staticmethod
    def decode_session_token(token: str) -> dict[str, Any]:
        try:
            return jwt.decode(
                token,
                settings.widget_jwt_secret,
                algorithms=["HS256"],
            )
        except InvalidTokenError as exc:
            raise ValueError("Invalid widget session token") from exc
