"""Notification rendering + delivery (mock providers, real Telegram when configured)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.services.events import hub

logger = logging.getLogger(__name__)

DEFAULT_LEAD_TIMES_MIN = [1440, 120, 30]

CHANNEL_LABELS = {
    NotificationChannel.sms: "SMS",
    NotificationChannel.email: "E-mail",
    NotificationChannel.telegram: "Telegram",
    NotificationChannel.widget: "Widget",
}


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
        local = appointment.start_at.astimezone(tz)
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
) -> tuple[NotificationStatus, str, str | None]:
    """Try to deliver a message. Returns (status, provider, error)."""
    if channel == NotificationChannel.telegram and settings.telegram_bot_token:
        chat_id = (customer.external_ids or {}).get("telegram") if customer else None
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
    # SMS / e-mail / widget (and Telegram without credentials) — mock provider
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
) -> NotificationLog:
    """Render, deliver (mock or real), persist a log entry, emit a WS event."""
    context = build_context(business, customer, appointment, service)
    text = render_template(body, context)

    status, provider, error = await _deliver(channel, customer, text)

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
            message=f"{CHANNEL_LABELS[channel]} do {who}",
        )
    return log
