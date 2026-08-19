"""Public booking API — no auth required."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_, select

from app.api.deps import DbSession
from app.config import settings
from app.models import Business, Customer, Service, Staff
from app.models.enums import AppointmentStatus, Channel, DepositStatus
from app.schemas import AvailabilityResponse
from app.services import availability as availability_service
from app.services import booking
from app.services.booking import BookingError
from app.services import payments as payments_service

router = APIRouter(prefix="/api/public", tags=["public"])


class PublicBusinessOut(BaseModel):
    id: UUID
    name: str
    timezone: str
    public_slug: str | None = None
    deposit_percent: int = 0
    booking_url: str | None = None


class PublicServiceOut(BaseModel):
    id: UUID
    name: str
    duration_min: int
    price: Decimal
    description: str | None = None


class PublicStaffOut(BaseModel):
    id: UUID
    name: str
    color: str | None = None


class PublicBookIn(BaseModel):
    service_id: UUID
    start_at: datetime
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = None
    email: EmailStr | None = None
    staff_id: UUID | None = None
    notes: str | None = None


class PublicBookOut(BaseModel):
    appointment_id: UUID
    status: str
    deposit_status: str
    deposit_amount: Decimal | None = None
    checkout_url: str | None = None
    message: str


async def _resolve_business(db: DbSession, key: str) -> Business:
    biz: Business | None = None
    try:
        biz = await db.get(Business, UUID(key))
    except ValueError:
        biz = None
    if biz is None:
        result = await db.execute(
            select(Business).where(Business.public_slug == key.lower())
        )
        biz = result.scalar_one_or_none()
    if biz is None:
        raise HTTPException(status_code=404, detail="Salon nie znaleziony")
    return biz


@router.get("/{key}", response_model=PublicBusinessOut)
async def public_business(key: str, db: DbSession) -> PublicBusinessOut:
    biz = await _resolve_business(db, key)
    slug = biz.public_slug or str(biz.id)
    return PublicBusinessOut(
        id=biz.id,
        name=biz.name,
        timezone=biz.timezone,
        public_slug=biz.public_slug,
        deposit_percent=int(biz.deposit_percent or 0),
        booking_url=f"{settings.public_frontend_url.rstrip('/')}/book/{slug}",
    )


@router.get("/{key}/services", response_model=list[PublicServiceOut])
async def public_services(key: str, db: DbSession) -> list[PublicServiceOut]:
    biz = await _resolve_business(db, key)
    result = await db.execute(
        select(Service).where(Service.business_id == biz.id).order_by(Service.name)
    )
    return [
        PublicServiceOut(
            id=s.id,
            name=s.name,
            duration_min=s.duration_min,
            price=s.price,
            description=s.description,
        )
        for s in result.scalars().all()
    ]


@router.get("/{key}/staff", response_model=list[PublicStaffOut])
async def public_staff(key: str, db: DbSession) -> list[PublicStaffOut]:
    biz = await _resolve_business(db, key)
    result = await db.execute(
        select(Staff)
        .where(Staff.business_id == biz.id, Staff.is_active.is_(True))
        .order_by(Staff.sort_order, Staff.name)
    )
    return [
        PublicStaffOut(id=s.id, name=s.name, color=s.color)
        for s in result.scalars().all()
    ]


@router.get("/{key}/availability", response_model=AvailabilityResponse)
async def public_availability(
    key: str,
    db: DbSession,
    service_id: UUID,
    day: date = Query(...),
    staff_id: UUID | None = None,
) -> AvailabilityResponse:
    biz = await _resolve_business(db, key)
    try:
        return await availability_service.list_availability(
            db,
            business_id=biz.id,
            service_id=service_id,
            day=day,
            staff_id=staff_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{key}/book", response_model=PublicBookOut)
async def public_book(key: str, db: DbSession, body: PublicBookIn) -> PublicBookOut:
    biz = await _resolve_business(db, key)
    if not body.phone and not body.email:
        raise HTTPException(status_code=400, detail="Podaj telefon lub e-mail")

    # Upsert customer by phone or email
    clauses = []
    if body.phone:
        clauses.append(Customer.phone == body.phone.strip())
    if body.email:
        clauses.append(Customer.email == str(body.email).lower())
    existing = (
        await db.execute(
            select(Customer).where(
                Customer.business_id == biz.id,
                or_(*clauses),
            )
        )
    ).scalars().first()
    if existing:
        customer = existing
        if body.name and not customer.name:
            customer.name = body.name.strip()
        if body.phone and not customer.phone:
            customer.phone = body.phone.strip()
        if body.email and not customer.email:
            customer.email = str(body.email).lower()
    else:
        customer = Customer(
            business_id=biz.id,
            name=body.name.strip(),
            phone=body.phone.strip() if body.phone else None,
            email=str(body.email).lower() if body.email else None,
            external_ids={},
        )
        db.add(customer)
        await db.flush()

    deposit_pct = int(biz.deposit_percent or 0)
    status = (
        AppointmentStatus.pending if deposit_pct > 0 else AppointmentStatus.confirmed
    )
    try:
        appt = await booking.create_appointment(
            db,
            business_id=biz.id,
            customer_id=customer.id,
            service_id=body.service_id,
            start_at=body.start_at,
            status=status,
            channel=Channel.widget,
            notes=body.notes,
            staff_id=body.staff_id,
        )
    except BookingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    checkout_url = None
    deposit_amount = None
    deposit_status = DepositStatus.none.value
    if deposit_pct > 0 and appt.service:
        deposit_amount = (
            Decimal(appt.service.price) * Decimal(deposit_pct) / Decimal(100)
        ).quantize(Decimal("0.01"))
        appt.deposit_amount = deposit_amount
        appt.deposit_status = DepositStatus.pending.value
        checkout_url = await payments_service.create_checkout_session(
            db, business=biz, appointment=appt, amount=deposit_amount
        )
        deposit_status = appt.deposit_status or DepositStatus.pending.value
        await db.flush()

    msg = (
        "Rezerwacja utworzona. Opłać zaliczkę, aby potwierdzić termin."
        if checkout_url
        else "Rezerwacja potwierdzona. Do zobaczenia!"
    )
    return PublicBookOut(
        appointment_id=appt.id,
        status=appt.status.value,
        deposit_status=deposit_status,
        deposit_amount=deposit_amount,
        checkout_url=checkout_url,
        message=msg,
    )
