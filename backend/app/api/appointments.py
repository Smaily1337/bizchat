"""Appointments CRUD (admin)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentOwner, DbSession
from app.models.enums import AppointmentStatus
from app.schemas import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services import booking
from app.services.booking import BookingError, to_appointment_out

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    db: DbSession,
    owner: CurrentOwner,
    status_filter: AppointmentStatus | None = Query(None, alias="status"),
    from_at: datetime | None = None,
    to_at: datetime | None = None,
) -> list[AppointmentOut]:
    items = await booking.list_appointments(
        db,
        owner.business_id,
        status=status_filter,
        from_at=from_at,
        to_at=to_at,
    )
    return [to_appointment_out(a) for a in items]


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    db: DbSession,
    owner: CurrentOwner,
    body: AppointmentCreate,
) -> AppointmentOut:
    try:
        appt = await booking.create_appointment(
            db,
            business_id=owner.business_id,
            customer_id=body.customer_id,
            service_id=body.service_id,
            start_at=body.start_at,
            end_at=body.end_at,
            status=body.status,
            channel=body.channel,
            notes=body.notes,
            staff_id=body.staff_id,
        )
    except BookingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_appointment_out(appt)


@router.get("/{appointment_id}", response_model=AppointmentOut)
async def get_appointment(
    db: DbSession,
    owner: CurrentOwner,
    appointment_id: UUID,
) -> AppointmentOut:
    appt = await booking.get_appointment(db, appointment_id)
    if appt is None or appt.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return to_appointment_out(appt)


@router.patch("/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    db: DbSession,
    owner: CurrentOwner,
    appointment_id: UUID,
    body: AppointmentUpdate,
) -> AppointmentOut:
    appt = await booking.get_appointment(db, appointment_id)
    if appt is None or appt.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    try:
        updated = await booking.update_appointment(
            db,
            appt,
            start_at=body.start_at,
            end_at=body.end_at,
            status=body.status,
            notes=body.notes,
            service_id=body.service_id,
            staff_id=body.staff_id,
        )
    except BookingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_appointment_out(updated)


@router.delete("/{appointment_id}", response_model=AppointmentOut)
async def cancel_appointment(
    db: DbSession,
    owner: CurrentOwner,
    appointment_id: UUID,
    reason: str | None = Query(None),
) -> AppointmentOut:
    appt = await booking.get_appointment(db, appointment_id)
    if appt is None or appt.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    cancelled = await booking.cancel_appointment(db, appt, reason=reason)
    return to_appointment_out(cancelled)
