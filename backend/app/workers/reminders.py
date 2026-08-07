"""Background loop that sends automatic appointment reminders.

Runs inside the FastAPI process (started from the app lifespan). Every tick it
looks for upcoming appointments that entered one of the configured lead-time
windows (e.g. 24h / 2h / 30min before start) and sends a reminder — unless one
was already sent for that window or the per-appointment cap is reached.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models import (
    Appointment,
    AppointmentStatus,
    Business,
    Customer,
    NotificationKind,
    NotificationLog,
    NotificationSettings,
    NotificationTemplate,
    Service,
)
from app.services.notifications import (
    channel_from_booking,
    get_or_create_settings,
    send_notification,
)

logger = logging.getLogger(__name__)

TICK_SECONDS = 60

FALLBACK_REMINDER_BODY = (
    "Cześć {{klient}}! Przypominamy o wizycie ({{usluga}}) "
    "w {{firma}} dnia {{data}} o {{godzina}}. Do zobaczenia!"
)


async def process_reminders_once() -> int:
    """Single pass over all businesses; returns number of reminders sent."""
    sent_count = 0
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        businesses = (await db.execute(select(Business))).scalars().all()

        for business in businesses:
            cfg: NotificationSettings = await get_or_create_settings(db, business.id)
            if not cfg.reminders_enabled or not cfg.lead_times_min:
                continue

            max_lead = max(int(m) for m in cfg.lead_times_min)
            result = await db.execute(
                select(Appointment)
                .where(
                    Appointment.business_id == business.id,
                    Appointment.status.in_(
                        [AppointmentStatus.pending, AppointmentStatus.confirmed]
                    ),
                    Appointment.start_at > now,
                    Appointment.start_at <= now + timedelta(minutes=max_lead),
                )
            )
            appointments = result.scalars().all()
            if not appointments:
                continue

            template = (
                await db.execute(
                    select(NotificationTemplate)
                    .where(
                        NotificationTemplate.business_id == business.id,
                        NotificationTemplate.kind == NotificationKind.reminder,
                    )
                    .order_by(NotificationTemplate.is_default.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            body = template.body if template else FALLBACK_REMINDER_BODY

            for appt in appointments:
                reminders_sent = (
                    await db.execute(
                        select(func.count())
                        .select_from(NotificationLog)
                        .where(
                            NotificationLog.appointment_id == appt.id,
                            NotificationLog.kind == NotificationKind.reminder,
                        )
                    )
                ).scalar_one()
                if reminders_sent >= cfg.max_per_appointment:
                    continue

                # Only the closest (smallest) matching window counts; windows
                # that were already crossed when the appointment was created
                # never fire retroactively.
                minutes_to_start = (appt.start_at - now).total_seconds() / 60
                current_lead = next(
                    (
                        lead
                        for lead in sorted(int(m) for m in cfg.lead_times_min)
                        if minutes_to_start <= lead
                    ),
                    None,
                )
                if current_lead is None:
                    continue

                already = (
                    await db.execute(
                        select(func.count())
                        .select_from(NotificationLog)
                        .where(
                            NotificationLog.appointment_id == appt.id,
                            NotificationLog.kind == NotificationKind.reminder,
                            NotificationLog.lead_time_min <= current_lead,
                        )
                    )
                ).scalar_one()
                if already:
                    continue

                customer = await db.get(Customer, appt.customer_id)
                service = await db.get(Service, appt.service_id)
                await send_notification(
                    db,
                    business,
                    customer=customer,
                    appointment=appt,
                    service=service,
                    channel=channel_from_booking(
                        appt.channel, cfg.default_channel
                    ),
                    kind=NotificationKind.reminder,
                    body=body,
                    lead_time_min=current_lead,
                )
                sent_count += 1

        await db.commit()
    return sent_count


async def reminder_loop() -> None:
    logger.info("Reminder worker started (tick=%ss)", TICK_SECONDS)
    while True:
        try:
            sent = await process_reminders_once()
            if sent:
                logger.info("Reminder worker sent %s notification(s)", sent)
        except asyncio.CancelledError:
            logger.info("Reminder worker stopped")
            raise
        except Exception:
            logger.exception("Reminder worker tick failed")
        await asyncio.sleep(TICK_SECONDS)
