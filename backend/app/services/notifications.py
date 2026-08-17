"""Notification rendering + delivery (mock providers, real Telegram when configured)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bot.adapters.meta import MetaAdapter
from app.config import settings
from app.models import (
    Appointment,
    Business,
    Customer,
    NotificationChannel,
    NotificationKind,
    NotificationLog,
    NotificationSettings,
    NotificationStatus,
    Service,
)
from app.models.enums import Channel
from app.schemas import OutboundMessage
from app.services.events import hub

logger = logging.getLogger(__name__)

DEFAULT_LEAD_TIMES_MIN = [1440, 120, 30]

CHANNEL_LABELS = {
    NotificationChannel.sms: "SMS",
    NotificationChannel.email: "E-mail",
    NotificationChannel.telegram: "Telegram",
    NotificationChannel.messenger: "Messenger",
    NotificationChannel.instagram: "Instagram",
    NotificationChannel.whatsapp: "WhatsApp",
    NotificationChannel.widget: "Widget",
}


def channel_from_booking(
    booking_channel: Channel | str | None,
    fallback: NotificationChannel = NotificationChannel.sms,
) -> NotificationChannel:
    """Map appointment booking channel → notification delivery channel."""
    if booking_channel is None:
        return fallback
    value = (
        booking_channel.value
        if hasattr(booking_channel, "value")
        else str(booking_channel)
    )
    mapping = {
        Channel.telegram.value: NotificationChannel.telegram,
        Channel.messenger.value: NotificationChannel.messenger,
        Channel.instagram.value: NotificationChannel.instagram,
        Channel.whatsapp.value: NotificationChannel.whatsapp,
        Channel.widget.value: NotificationChannel.widget,
        Channel.admin.value: fallback,
    }
    return mapping.get(value, fallback)


async def get_or_create_settings(
    db: AsyncSession, business_id: UUID
) -> NotificationSettings:
    result = await db.execute(
        select(NotificationSettings).where(
            NotificationSettings.business_id == business_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = NotificationSettings(
            business_id=business_id,
            reminders_enabled=True,
            lead_times_min=list(DEFAULT_LEAD_TIMES_MIN),
            max_per_appointment=3,
            default_channel=NotificationChannel.sms,
        )
        db.add(row)
        await db.flush()
    return row


def build_context(
    business: Business,
    customer: Customer | None = None,
    appointment: Appointment | None = None,
    service: Service | None = None,
) -> dict[str, str]:
    tz = ZoneInfo(business.timezone or "Europe/Warsaw")
    ctx = {
        "firma": business.name,
        "klient": (customer.name if customer and customer.name else "Kliencie"),
        "usluga": service.name if service else "wizyta",
        "data": "",
        "godzina": "",
        "cena": f"{service.price} PLN" if service else "",
    }
    if appointment is not None:
        start = appointment.start_at
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        local = start.astimezone(tz)
        ctx["data"] = local.strftime("%d.%m.%Y")
        ctx["godzina"] = local.strftime("%H:%M")
    return ctx


def render_template(body: str, context: dict[str, str]) -> str:
    rendered = body
    for key, value in context.items():
        rendered = rendered.replace("{{" + key + "}}", value)
    return rendered


async def _deliver(
    channel: NotificationChannel,
    customer: Customer | None,
    text: str,
    *,
    quick_replies: list[dict[str, str]] | None = None,
) -> tuple[NotificationStatus, str, str | None]:
    """Try to deliver a message. Returns (status, provider, error)."""
    ext = (customer.external_ids or {}) if customer else {}

    if channel == NotificationChannel.telegram and settings.telegram_bot_token:
        chat_id = ext.get("telegram")
        if chat_id:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                        json={"chat_id": chat_id, "text": text},
                    )
                    resp.raise_for_status()
                return NotificationStatus.sent, "telegram", None
            except Exception as exc:  # network/API failure → log, do not crash
                logger.warning("Telegram send failed: %s", exc)
                return NotificationStatus.failed, "telegram", str(exc)[:490]
        return (
            NotificationStatus.failed,
            "telegram",
            "Brak telegram ID klienta — nie da się wysłać na Telegram.",
        )

    if channel in {NotificationChannel.messenger, NotificationChannel.instagram}:
        if not settings.meta_page_access_token:
            return (
                NotificationStatus.failed,
                "meta",
                "Brak META_PAGE_ACCESS_TOKEN — nie da się wysłać na Messengera.",
            )
        psid = ext.get("messenger") or ext.get("instagram")
        if not psid:
            return (
                NotificationStatus.failed,
                "meta",
                "Brak ID klienta z Messengera/Instagrama.",
            )
        try:
            meta = {
                "quick_replies": quick_replies or [],
            }
            ok = await MetaAdapter().send_outbound(
                OutboundMessage(
                    channel=Channel.messenger
                    if channel == NotificationChannel.messenger
                    else Channel.instagram,
                    external_thread_id=str(psid),
                    text=text,
                    metadata=meta,
                )
            )
            if ok:
                return NotificationStatus.sent, "meta", None
            return (
                NotificationStatus.failed,
                "meta",
                "Meta API odrzuciło wiadomość (sprawdź token / okno 24h).",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Meta notify failed: %s", exc)
            return NotificationStatus.failed, "meta", str(exc)[:490]

    if channel == NotificationChannel.whatsapp:
        from app.bot.adapters.whatsapp import WhatsAppAdapter

        wa_id = ext.get("whatsapp")
        if not wa_id:
            return (
                NotificationStatus.failed,
                "whatsapp",
                "Brak numeru WhatsApp klienta (external_ids.whatsapp).",
            )
        try:
            ok = await WhatsAppAdapter().send_outbound(
                OutboundMessage(
                    channel=Channel.whatsapp,
                    external_thread_id=str(wa_id),
                    text=text,
                    metadata={"quick_replies": quick_replies or []},
                )
            )
            if ok:
                return NotificationStatus.sent, "whatsapp", None
            return NotificationStatus.failed, "whatsapp", "WhatsApp API odrzuciło wiadomość"
        except Exception as exc:  # noqa: BLE001
            logger.warning("WhatsApp notify failed: %s", exc)
            return NotificationStatus.failed, "whatsapp", str(exc)[:490]

    if channel == NotificationChannel.email:
        email = (customer.email if customer else None) or None
        if not email:
            return (
                NotificationStatus.failed,
                "email",
                "Klient nie ma adresu e-mail.",
            )
        logger.info("[email→%s] %s", email, text)
        return NotificationStatus.sent, "mock-email", None

    # SMS / widget without live provider — mock (logged)
    logger.info("[mock:%s] %s", channel.value, text)
    return NotificationStatus.sent, "mock", None


async def send_notification(
    db: AsyncSession,
    business: Business,
    *,
    customer: Customer | None,
    appointment: Appointment | None,
    service: Service | None,
    channel: NotificationChannel,
    kind: NotificationKind,
    body: str,
    lead_time_min: int | None = None,
    publish_event: bool = True,
    with_confirm_buttons: bool = False,
) -> NotificationLog:
    """Render, deliver (mock or real), persist a log entry, emit a WS event."""
    from app.services.appointment_actions import reminder_quick_replies

    context = build_context(business, customer, appointment, service)
    text = render_template(body, context)
    quick = None
    if (
        with_confirm_buttons
        and appointment is not None
        and kind == NotificationKind.reminder
    ):
        quick = reminder_quick_replies(appointment.id)
        text = f"{text}\n\nOdpowiedz przyciskiem poniżej."

    status, provider, error = await _deliver(
        channel, customer, text, quick_replies=quick
    )

    log = NotificationLog(
        business_id=business.id,
        appointment_id=appointment.id if appointment else None,
        customer_id=customer.id if customer else None,
        channel=channel,
        kind=kind,
        status=status,
        body=text,
        error=error,
        provider=provider,
        lead_time_min=lead_time_min,
        sent_at=datetime.now(timezone.utc) if status == NotificationStatus.sent else None,
    )
    db.add(log)
    await db.flush()

    if publish_event:
        who = customer.name if customer and customer.name else "klienta"
        await hub.publish(
            business.id,
            "notification.sent",
            {
                "log_id": str(log.id),
                "channel": channel.value,
                "kind": kind.value,
                "status": status.value,
            },
            title="Powiadomienie wysłane",
            message=f"{CHANNEL_LABELS.get(channel, channel.value)} do {who}",
        )
    return log
