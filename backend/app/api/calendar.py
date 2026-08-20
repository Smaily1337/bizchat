"""Availability / calendar listing."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentOwner, DbSession
from app.schemas import AvailabilityResponse
from app.services import availability

router = APIRouter(prefix="/api/availability", tags=["availability"])


@router.get("", response_model=AvailabilityResponse)
async def get_availability(
    db: DbSession,
    owner: CurrentOwner,
    service_id: UUID = Query(...),
    day: date = Query(..., description="YYYY-MM-DD"),
    staff_id: UUID | None = Query(None),
) -> AvailabilityResponse:
    try:
        return await availability.list_availability(
            db,
            business_id=owner.business_id,
            service_id=service_id,
            day=day,
            staff_id=staff_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
