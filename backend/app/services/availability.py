"""Availability — generate free slots from working hours minus appointments/time-off."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Appointment,
    AppointmentStatus,
    Business,
    Service,
    TimeOff,
    WorkingHours,
)
from app.schemas import AvailabilityResponse, SlotOut

ACTIVE_STATUSES = {
    AppointmentStatus.pending,
    AppointmentStatus.confirmed,
}


async def list_availability(
    db: AsyncSession,
    *,
    business_id: UUID,
    service_id: UUID,
    day: date,
    slot_step_min: int = 15,
    staff_id: UUID | None = None,
) -> AvailabilityResponse:
    business = await db.get(Business, business_id)
    if business is None:
        raise ValueError("Business not found")

    service = await db.get(Service, service_id)
    if service is None or service.business_id != business_id:
        raise ValueError("Service not found")

    tz = ZoneInfo(business.timezone or "Europe/Warsaw")
    weekday = day.weekday()  # 0=Mon

    hours_result = await db.execute(
        select(WorkingHours).where(
            WorkingHours.business_id == business_id,
            WorkingHours.weekday == weekday,
        )
    )
    working = hours_result.scalar_one_or_none()
    if working is None:
        return AvailabilityResponse(
            business_id=business_id,
            service_id=service_id,
            date=day.isoformat(),
            slots=[],
            staff_id=staff_id,
        )

    day_start = datetime.combine(day, working.start_time, tzinfo=tz)
    day_end = datetime.combine(day, working.end_time, tzinfo=tz)

    appt_stmt = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.status.in_(ACTIVE_STATUSES),
        Appointment.start_at < day_end.astimezone(timezone.utc),
        Appointment.end_at > day_start.astimezone(timezone.utc),
    )
    if staff_id is not None:
        appt_stmt = appt_stmt.where(Appointment.staff_id == staff_id)
    appointments = list((await db.execute(appt_stmt)).scalars().all())

    toff_result = await db.execute(
        select(TimeOff).where(
            TimeOff.business_id == business_id,
            TimeOff.start_at < day_end.astimezone(timezone.utc),
            TimeOff.end_at > day_start.astimezone(timezone.utc),
        )
    )
    time_offs = list(toff_result.scalars().all())

    duration = timedelta(minutes=service.duration_min)
    step = timedelta(minutes=slot_step_min)
    slots: list[SlotOut] = []
    cursor = day_start

    while cursor + duration <= day_end:
        slot_end = cursor + duration
        available = True

        for appt in appointments:
            a_start = appt.start_at.astimezone(tz)
            a_end = appt.end_at.astimezone(tz)
            if cursor < a_end and slot_end > a_start:
                available = False
                break

        if available:
            for toff in time_offs:
                t_start = toff.start_at.astimezone(tz)
                t_end = toff.end_at.astimezone(tz)
                if cursor < t_end and slot_end > t_start:
                    available = False
                    break

        slots.append(
            SlotOut(start_at=cursor, end_at=slot_end, available=available)
        )
        cursor += step

    return AvailabilityResponse(
        business_id=business_id,
        service_id=service_id,
        date=day.isoformat(),
        slots=[s for s in slots if s.available],
        staff_id=staff_id,
    )
