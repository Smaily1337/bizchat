"""Booking service — create / update / cancel appointments."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Appointment, AppointmentStatus, CancellationEvent, Customer, Service
from app.models.enums import Channel
from app.schemas import AppointmentOut
from app.services import google_calendar
from app.services import waitlist as waitlist_service
from app.services.events import hub


class BookingError(Exception):
    pass


ACTIVE_STATUSES = {
    AppointmentStatus.pending,
    AppointmentStatus.confirmed,
}


def to_appointment_out(appt: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=appt.id,
        business_id=appt.business_id,
        customer_id=appt.customer_id,
        service_id=appt.service_id,
        start_at=appt.start_at,
        end_at=appt.end_at,
        status=appt.status,
        channel=appt.channel,
        gcal_event_id=appt.gcal_event_id,
        notes=appt.notes,
        created_at=appt.created_at,
        updated_at=appt.updated_at,
        customer_name=appt.customer.name if appt.customer else None,
        service_name=appt.service.name if appt.service else None,
    )


async def _load_appointment(
    db: AsyncSession, appointment_id: UUID
) -> Appointment | None:
    result = await db.execute(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(
            selectinload(Appointment.customer),
            selectinload(Appointment.service),
        )
    )
    return result.scalar_one_or_none()


async def _assert_no_overlap(
    db: AsyncSession,
    *,
    business_id: UUID,
    start_at: datetime,
    end_at: datetime,
    exclude_id: UUID | None = None,
) -> None:
    stmt = select(Appointment).where(
        Appointment.business_id == business_id,
        Appointment.status.in_(ACTIVE_STATUSES),
        Appointment.start_at < end_at,
        Appointment.end_at > start_at,
    )
    if exclude_id is not None:
        stmt = stmt.where(Appointment.id != exclude_id)
    conflict = (await db.execute(stmt)).scalars().first()
    if conflict is not None:
        raise BookingError("Termin koliduje z inną wizytą")


async def create_appointment(
    db: AsyncSession,
    *,
    business_id: UUID,
    customer_id: UUID,
    service_id: UUID,
    start_at: datetime,
    end_at: datetime | None = None,
    status: AppointmentStatus = AppointmentStatus.pending,
    channel: Channel = Channel.admin,
    notes: str | None = None,
) -> Appointment:
    service = await db.get(Service, service_id)
    if service is None or service.business_id != business_id:
        raise BookingError("Service not found for this business")

    customer = await db.get(Customer, customer_id)
    if customer is None or customer.business_id != business_id:
        raise BookingError("Customer not found for this business")

    if end_at is None:
        end_at = start_at + timedelta(minutes=service.duration_min)
    if end_at <= start_at:
        raise BookingError("end_at must be after start_at")

    await _assert_no_overlap(
        db, business_id=business_id, start_at=start_at, end_at=end_at
    )

    appointment = Appointment(
        business_id=business_id,
        customer_id=customer_id,
        service_id=service_id,
        start_at=start_at,
        end_at=end_at,
        status=status,
        channel=channel,
        notes=notes,
    )
    db.add(appointment)
    await db.flush()

    event_id = await google_calendar.create_event(appointment)
    if event_id:
        appointment.gcal_event_id = event_id
        await db.flush()

    loaded = await _load_appointment(db, appointment.id)
    appt = loaded or appointment
    when = appt.start_at.strftime("%d.%m %H:%M")
    await hub.publish(
        business_id,
        "appointment.created",
        {
            "id": str(appt.id),
            "customer_name": appt.customer.name if appt.customer else None,
            "service_name": appt.service.name if appt.service else None,
            "start_at": appt.start_at.isoformat(),
            "channel": appt.channel.value if hasattr(appt.channel, "value") else str(appt.channel),
        },
        title="Nowa rezerwacja",
        message=f"{appt.customer.name or 'Klient'} · {appt.service.name if appt.service else 'usługa'} · {when}",
    )
    return appt


async def update_appointment(
    db: AsyncSession,
    appointment: Appointment,
    *,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    status: AppointmentStatus | None = None,
    notes: str | None = None,
    service_id: UUID | None = None,
) -> Appointment:
    if service_id is not None:
        service = await db.get(Service, service_id)
        if service is None or service.business_id != appointment.business_id:
            raise BookingError("Service not found for this business")
        appointment.service_id = service_id

    new_start = start_at if start_at is not None else appointment.start_at
    new_end = end_at if end_at is not None else appointment.end_at
    if new_end <= new_start:
        raise BookingError("end_at must be after start_at")

    if start_at is not None or end_at is not None:
        await _assert_no_overlap(
            db,
            business_id=appointment.business_id,
            start_at=new_start,
            end_at=new_end,
            exclude_id=appointment.id,
        )

    if start_at is not None:
        appointment.start_at = start_at
    if end_at is not None:
        appointment.end_at = end_at
    if status is not None:
        appointment.status = status
    if notes is not None:
        appointment.notes = notes

    await db.flush()
    await google_calendar.update_event(appointment)
    loaded = await _load_appointment(db, appointment.id)
    return loaded or appointment


async def cancel_appointment(
    db: AsyncSession,
    appointment: Appointment,
    *,
    reason: str | None = None,
) -> Appointment:
    now = datetime.now(timezone.utc)
    lead_hours = (appointment.start_at - now).total_seconds() / 3600.0

    appointment.status = AppointmentStatus.cancelled
    event = CancellationEvent(
        appointment_id=appointment.id,
        reason=reason,
        cancelled_at=now,
        lead_time_hours=round(lead_hours, 2),
    )
    db.add(event)
    await db.flush()
    await google_calendar.delete_event(appointment)

    offered = await waitlist_service.notify_next_on_cancellation(
        db,
        business_id=appointment.business_id,
        service_id=appointment.service_id,
    )
    if offered is not None:
        await hub.publish(
            appointment.business_id,
            "waitlist.offered",
            {
                "waitlist_id": str(offered.id),
                "customer_id": str(offered.customer_id),
                "service_id": str(offered.service_id),
            },
            title="Zwolniony termin",
            message="Kolejka oczekujących: zaproponowano slot kolejnemu klientowi",
        )

    loaded = await _load_appointment(db, appointment.id)
    return loaded or appointment


async def get_appointment(db: AsyncSession, appointment_id: UUID) -> Appointment | None:
    return await _load_appointment(db, appointment_id)


async def list_appointments(
    db: AsyncSession,
    business_id: UUID,
    *,
    status: AppointmentStatus | None = None,
    from_at: datetime | None = None,
    to_at: datetime | None = None,
) -> list[Appointment]:
    stmt = (
        select(Appointment)
        .where(Appointment.business_id == business_id)
        .options(
            selectinload(Appointment.customer),
            selectinload(Appointment.service),
        )
    )
    if status is not None:
        stmt = stmt.where(Appointment.status == status)
    if from_at is not None:
        stmt = stmt.where(Appointment.start_at >= from_at)
    if to_at is not None:
        stmt = stmt.where(Appointment.start_at < to_at)
    stmt = stmt.order_by(Appointment.start_at)
    result = await db.execute(stmt)
    return list(result.scalars().all())
