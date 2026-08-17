"""Confirm / cancel appointment from Messenger/WhatsApp quick-reply payloads."""

from __future__ import annotations

import logging
import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment
from app.models.enums import AppointmentStatus
from app.schemas import InboundMessage
from app.services import booking
from app.services.events import hub

logger = logging.getLogger(__name__)

CONFIRM_RE = re.compile(r"^(?:CONFIRM|POTWIERDZ)[:_\s-]?([0-9a-fA-F-]{36})$", re.I)
CANCEL_RE = re.compile(r"^(?:CANCEL|ODWOLAJ|ODWOŁAJ)[:_\s-]?([0-9a-fA-F-]{36})$", re.I)


def reminder_quick_replies(appointment_id: UUID) -> list[dict[str, str]]:
    return [
        {"title": "Potwierdzam", "payload": f"CONFIRM:{appointment_id}"},
        {"title": "Odwołuję", "payload": f"CANCEL:{appointment_id}"},
    ]


async def try_handle_payload(
    db: AsyncSession,
    text: str,
    inbound: InboundMessage | None = None,
) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False

    m = CONFIRM_RE.match(raw)
    if m:
        appt = await db.get(Appointment, UUID(m.group(1)))
        if appt is None:
            return True
        if appt.status in {AppointmentStatus.pending, AppointmentStatus.confirmed}:
            appt.status = AppointmentStatus.confirmed
            await db.flush()
            await hub.publish(
                appt.business_id,
                "appointment.confirmed",
                {"id": str(appt.id)},
                title="Klient potwierdził wizytę",
                message=str(appt.id),
            )
        return True

    m = CANCEL_RE.match(raw)
    if m:
        appt = await db.get(Appointment, UUID(m.group(1)))
        if appt is None:
            return True
        if appt.status not in {AppointmentStatus.cancelled, AppointmentStatus.completed}:
            await booking.cancel_appointment(db, appt, reason="Klient przez Messenger/WhatsApp")
            await hub.publish(
                appt.business_id,
                "appointment.cancelled",
                {"id": str(appt.id)},
                title="Klient odwołał wizytę",
                message=str(appt.id),
            )
        return True

    return False
