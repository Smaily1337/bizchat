"""Working hours + time off management."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import CurrentOwner, DbSession, RequireOwnerOrAdmin
from app.models import TimeOff, WorkingHours
from app.schemas import (
    TimeOffCreate,
    TimeOffOut,
    WorkingHoursBulkUpdate,
    WorkingHoursOut,
)

router = APIRouter(tags=["hours"])


@router.get("/api/working-hours", response_model=list[WorkingHoursOut])
async def list_working_hours(db: DbSession, owner: CurrentOwner) -> list[WorkingHours]:
    result = await db.execute(
        select(WorkingHours)
        .where(WorkingHours.business_id == owner.business_id)
        .order_by(WorkingHours.weekday)
    )
    return list(result.scalars().all())


@router.put("/api/working-hours", response_model=list[WorkingHoursOut])
async def replace_working_hours(
    db: DbSession,
    owner: RequireOwnerOrAdmin,
    body: WorkingHoursBulkUpdate,
) -> list[WorkingHours]:
    existing = await db.execute(
        select(WorkingHours).where(WorkingHours.business_id == owner.business_id)
    )
    for row in existing.scalars().all():
        await db.delete(row)
    await db.flush()

    created: list[WorkingHours] = []
    for day in body.days:
        if day.closed:
            continue
        if day.end_time <= day.start_time:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid hours for weekday {day.weekday}",
            )
        row = WorkingHours(
            business_id=owner.business_id,
            weekday=day.weekday,
            start_time=day.start_time,
            end_time=day.end_time,
        )
        db.add(row)
        created.append(row)
    await db.flush()
    return created


@router.get("/api/time-off", response_model=list[TimeOffOut])
async def list_time_off(db: DbSession, owner: CurrentOwner) -> list[TimeOff]:
    result = await db.execute(
        select(TimeOff)
        .where(TimeOff.business_id == owner.business_id)
        .order_by(TimeOff.start_at.desc())
    )
    return list(result.scalars().all())


@router.post("/api/time-off", response_model=TimeOffOut, status_code=status.HTTP_201_CREATED)
async def create_time_off(
    db: DbSession,
    owner: CurrentOwner,
    body: TimeOffCreate,
) -> TimeOff:
    if body.end_at <= body.start_at:
        raise HTTPException(status_code=400, detail="end_at must be after start_at")
    row = TimeOff(
        business_id=owner.business_id,
        start_at=body.start_at,
        end_at=body.end_at,
        reason=body.reason,
    )
    db.add(row)
    await db.flush()
    return row


@router.delete("/api/time-off/{time_off_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_off(
    db: DbSession,
    owner: CurrentOwner,
    time_off_id: UUID,
) -> Response:
    row = await db.get(TimeOff, time_off_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Time off not found")
    await db.delete(row)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
