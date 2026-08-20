"""Feedback + waitlist admin/public endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentOwner, DbSession
from app.models import Appointment, Feedback, WaitlistEntry
from app.models.enums import FeedbackRoute, WaitlistStatus
from app.schemas import FeedbackCreate, FeedbackOut, WaitlistCreate, WaitlistOut
from app.services import feedback as feedback_service
from app.services import waitlist as waitlist_service

feedback_router = APIRouter(prefix="/api/feedback", tags=["feedback"])
waitlist_router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])


def _feedback_out(fb: Feedback) -> FeedbackOut:
    appt = fb.appointment
    return FeedbackOut(
        id=fb.id,
        appointment_id=fb.appointment_id,
        score=fb.score,
        comment=fb.comment,
        routed_to=fb.routed_to,
        created_at=fb.created_at,
        updated_at=fb.updated_at,
        customer_name=appt.customer.name if appt and appt.customer else None,
        service_name=appt.service.name if appt and appt.service else None,
        start_at=appt.start_at if appt else None,
    )


def _waitlist_out(entry: WaitlistEntry) -> WaitlistOut:
    return WaitlistOut(
        id=entry.id,
        business_id=entry.business_id,
        customer_id=entry.customer_id,
        service_id=entry.service_id,
        preferred_windows=entry.preferred_windows or [],
        status=entry.status,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        customer_name=entry.customer.name if entry.customer else None,
        service_name=entry.service.name if entry.service else None,
    )


@feedback_router.get("", response_model=list[FeedbackOut])
async def list_feedback(
    db: DbSession,
    owner: CurrentOwner,
    alerts_only: bool = Query(False),
) -> list[FeedbackOut]:
    stmt = (
        select(Feedback)
        .join(Appointment, Appointment.id == Feedback.appointment_id)
        .where(Appointment.business_id == owner.business_id)
        .options(
            selectinload(Feedback.appointment).selectinload(Appointment.customer),
            selectinload(Feedback.appointment).selectinload(Appointment.service),
        )
        .order_by(Feedback.created_at.desc())
    )
    if alerts_only:
        stmt = stmt.where(Feedback.routed_to == FeedbackRoute.alert)
    result = await db.execute(stmt)
    return [_feedback_out(fb) for fb in result.scalars().all()]


@feedback_router.post("", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    db: DbSession,
    owner: CurrentOwner,
    body: FeedbackCreate,
) -> FeedbackOut:
    appt = await db.get(Appointment, body.appointment_id)
    if appt is None or appt.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    try:
        fb = await feedback_service.submit_feedback(
            db,
            appointment_id=body.appointment_id,
            score=body.score,
            comment=body.comment,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    # reload with relations
    result = await db.execute(
        select(Feedback)
        .where(Feedback.id == fb.id)
        .options(
            selectinload(Feedback.appointment).selectinload(Appointment.customer),
            selectinload(Feedback.appointment).selectinload(Appointment.service),
        )
    )
    return _feedback_out(result.scalar_one())


@waitlist_router.get("", response_model=list[WaitlistOut])
async def list_waitlist(
    db: DbSession,
    owner: CurrentOwner,
    status_filter: WaitlistStatus | None = Query(None, alias="status"),
) -> list[WaitlistOut]:
    stmt = (
        select(WaitlistEntry)
        .where(WaitlistEntry.business_id == owner.business_id)
        .options(
            selectinload(WaitlistEntry.customer),
            selectinload(WaitlistEntry.service),
        )
        .order_by(WaitlistEntry.created_at)
    )
    if status_filter is not None:
        stmt = stmt.where(WaitlistEntry.status == status_filter)
    result = await db.execute(stmt)
    return [_waitlist_out(e) for e in result.scalars().all()]


@waitlist_router.post("", response_model=WaitlistOut, status_code=status.HTTP_201_CREATED)
async def add_waitlist(
    db: DbSession,
    owner: CurrentOwner,
    body: WaitlistCreate,
) -> WaitlistOut:
    entry = await waitlist_service.add_to_waitlist(
        db,
        business_id=owner.business_id,
        customer_id=body.customer_id,
        service_id=body.service_id,
        preferred_windows=body.preferred_windows,
    )
    result = await db.execute(
        select(WaitlistEntry)
        .where(WaitlistEntry.id == entry.id)
        .options(
            selectinload(WaitlistEntry.customer),
            selectinload(WaitlistEntry.service),
        )
    )
    return _waitlist_out(result.scalar_one())


@waitlist_router.post("/{entry_id}/notify", response_model=WaitlistOut)
async def notify_waitlist_entry(
    db: DbSession,
    owner: CurrentOwner,
    entry_id: UUID,
) -> WaitlistOut:
    entry = await db.get(WaitlistEntry, entry_id)
    if entry is None or entry.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    entry.status = WaitlistStatus.offered
    await db.flush()
    result = await db.execute(
        select(WaitlistEntry)
        .where(WaitlistEntry.id == entry.id)
        .options(
            selectinload(WaitlistEntry.customer),
            selectinload(WaitlistEntry.service),
        )
    )
    return _waitlist_out(result.scalar_one())


@waitlist_router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_waitlist(
    db: DbSession,
    owner: CurrentOwner,
    entry_id: UUID,
) -> Response:
    entry = await db.get(WaitlistEntry, entry_id)
    if entry is None or entry.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    entry.status = WaitlistStatus.cancelled
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
