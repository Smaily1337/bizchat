"""Channel health for the panel — Meta / Telegram / WhatsApp / widget readiness."""

from __future__ import annotations

from pydantic import BaseModel

from fastapi import APIRouter

from app.api.deps import CurrentOwner
from app.config import settings

router = APIRouter(prefix="/api/channels", tags=["channels"])


class ChannelStatus(BaseModel):
    id: str
    name: str
    configured: bool
    detail: str


class ChannelsStatusOut(BaseModel):
    channels: list[ChannelStatus]
    meta_default_business_id_set: bool
    meta_verify_token: str


@router.get("/status", response_model=ChannelsStatusOut)
async def channels_status(_owner: CurrentOwner) -> ChannelsStatusOut:
    meta_token = bool(settings.meta_page_access_token.strip())
    meta_secret = bool(settings.meta_app_secret.strip())
    telegram = bool(settings.telegram_bot_token.strip())
    whatsapp = bool(
        settings.whatsapp_access_token.strip()
        or settings.whatsapp_phone_number_id.strip()
    )

    channels = [
        ChannelStatus(
            id="messenger",
            name="Messenger / Instagram",
            configured=meta_token,
            detail=(
                "Token strony OK"
                if meta_token
                else "Brak META_PAGE_ACCESS_TOKEN — bot nie odpowie, ale wiadomości mogą się zapisywać"
            )
            + ("" if meta_secret else " · brak META_APP_SECRET (wymagany w produkcji)"),
        ),
        ChannelStatus(
            id="telegram",
            name="Telegram",
            configured=telegram,
            detail="Bot token OK" if telegram else "Brak TELEGRAM_BOT_TOKEN",
        ),
        ChannelStatus(
            id="whatsapp",
            name="WhatsApp",
            configured=whatsapp,
            detail="Skonfigurowany" if whatsapp else "Opcjonalnie — nie ustawiony",
        ),
        ChannelStatus(
            id="widget",
            name="Widget WWW",
            configured=True,
            detail="Dostępny (snippet w Kanałach)",
        ),
    ]
    return ChannelsStatusOut(
        channels=channels,
        meta_default_business_id_set=bool(
            settings.meta_default_business_id.strip()
        ),
        meta_verify_token=settings.meta_verify_token or "bizchat-verify",
    )
