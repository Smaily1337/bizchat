"""Services CRUD (admin)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select

from app.api.deps import CurrentOwner, DbSession
from app.models import Service
from app.models.appointment import Appointment, WaitlistEntry
from app.schemas import ServiceCreate, ServiceOut, ServiceUpdate

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=list[ServiceOut])
async def list_services(db: DbSession, owner: CurrentOwner) -> list[Service]:
    result = await db.execute(
        select(Service)
        .where(Service.business_id == owner.business_id)
        .order_by(Service.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
async def create_service(
    db: DbSession,
    owner: CurrentOwner,
    body: ServiceCreate,
) -> Service:
    service = Service(
        business_id=owner.business_id,
        name=body.name,
        duration_min=body.duration_min,
        price=body.price,
        description=body.description,
    )
    db.add(service)
    await db.flush()
    return service


@router.patch("/{service_id}", response_model=ServiceOut)
async def update_service(
    db: DbSession,
    owner: CurrentOwner,
    service_id: UUID,
    body: ServiceUpdate,
) -> Service:
    service = await db.get(Service, service_id)
    if service is None or service.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Service not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(service, key, value)
    await db.flush()
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    db: DbSession,
    owner: CurrentOwner,
    service_id: UUID,
) -> Response:
    service = await db.get(Service, service_id)
    if service is None or service.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Service not found")

    appt_count = await db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(Appointment.service_id == service_id)
    )
    if appt_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete service with existing appointments",
        )

    waitlist_rows = await db.execute(
        select(WaitlistEntry).where(WaitlistEntry.service_id == service_id)
    )
    for entry in waitlist_rows.scalars().all():
        await db.delete(entry)

    await db.delete(service)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
