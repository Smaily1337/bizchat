"""Dashboard stub — basic business summary + analytics for charts."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import CurrentOwner, DbSession
from app.models import Appointment, AppointmentStatus, Customer, Feedback
from app.models.enums import Channel, FeedbackRoute

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _as_utc(dt: datetime) -> datetime:
    """Normalize DB datetimes (SQLite often naive) to UTC-aware for comparisons."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class DashboardSummary(BaseModel):
    business_id: str
    appointments_today: int
    customers_total: int
    pending_count: int
    cancelled_7d: int = 0
    no_show_7d: int = 0
    alerts_open: int = 0
    avg_score: float | None = None


class DayBucket(BaseModel):
    day: str
    confirmed: int
    cancelled: int
    no_show: int
    completed: int


class ChannelBucket(BaseModel):
    channel: str
    count: int


class DashboardAnalytics(BaseModel):
    days: list[DayBucket]
    by_channel: list[ChannelBucket]
    gaps_today: int
    feedback_avg: float | None
    visits: int = 0
    no_show_rate: float | None = None
    cancel_rate: float | None = None


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(db: DbSession, owner: CurrentOwner) -> DashboardSummary:
    today = datetime.now(timezone.utc).date()
    day_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    week_ago = day_start - timedelta(days=7)

    today_count = await db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.business_id == owner.business_id,
            Appointment.start_at >= day_start,
            Appointment.start_at <= day_end,
        )
    )
    customers_total = await db.scalar(
        select(func.count())
        .select_from(Customer)
        .where(Customer.business_id == owner.business_id)
    )
    pending_count = await db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.business_id == owner.business_id,
            Appointment.status == AppointmentStatus.pending,
        )
    )
    cancelled_7d = await db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.business_id == owner.business_id,
            Appointment.status == AppointmentStatus.cancelled,
            Appointment.updated_at >= week_ago,
        )
    )
    no_show_7d = await db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.business_id == owner.business_id,
            Appointment.status == AppointmentStatus.no_show,
            Appointment.start_at >= week_ago,
        )
    )
    alerts_open = await db.scalar(
        select(func.count())
        .select_from(Feedback)
        .join(Appointment, Appointment.id == Feedback.appointment_id)
        .where(
            Appointment.business_id == owner.business_id,
            Feedback.routed_to == FeedbackRoute.alert,
        )
    )
    avg_score = await db.scalar(
        select(func.avg(Feedback.score))
        .select_from(Feedback)
        .join(Appointment, Appointment.id == Feedback.appointment_id)
        .where(Appointment.business_id == owner.business_id)
    )

    return DashboardSummary(
        business_id=str(owner.business_id),
        appointments_today=today_count or 0,
        customers_total=customers_total or 0,
        pending_count=pending_count or 0,
        cancelled_7d=cancelled_7d or 0,
        no_show_7d=no_show_7d or 0,
        alerts_open=alerts_open or 0,
        avg_score=round(float(avg_score), 2) if avg_score is not None else None,
    )


@router.get("/analytics", response_model=DashboardAnalytics)
async def dashboard_analytics(
    db: DbSession,
    owner: CurrentOwner,
    days: int = Query(7, ge=3, le=90),
) -> DashboardAnalytics:
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=days - 1)
    range_start = datetime.combine(start_day, datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    range_end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)

    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.business_id == owner.business_id,
            Appointment.start_at >= range_start,
            Appointment.start_at <= range_end,
        )
    )
    appts = list(result.scalars().all())

    buckets: dict[date, dict[str, int]] = defaultdict(
        lambda: {"confirmed": 0, "cancelled": 0, "no_show": 0, "completed": 0}
    )
    channels: dict[str, int] = defaultdict(int)

    for a in appts:
        d = _as_utc(a.start_at).date()
        if a.status == AppointmentStatus.cancelled:
            buckets[d]["cancelled"] += 1
        elif a.status == AppointmentStatus.no_show:
            buckets[d]["no_show"] += 1
        elif a.status == AppointmentStatus.completed:
            buckets[d]["completed"] += 1
        else:
            buckets[d]["confirmed"] += 1
        channels[a.channel.value if hasattr(a.channel, "value") else str(a.channel)] += 1

    day_list: list[DayBucket] = []
    for i in range(days):
        d = start_day + timedelta(days=i)
        b = buckets[d]
        day_list.append(
            DayBucket(
                day=d.isoformat(),
                confirmed=b["confirmed"],
                cancelled=b["cancelled"],
                no_show=b["no_show"],
                completed=b["completed"],
            )
        )

    # Heuristic gaps: open hours 9–17 minus booked confirmed slots today
    day_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    today_busy = sum(
        1
        for a in appts
        if day_start <= _as_utc(a.start_at) <= day_end
        and a.status
        in {
            AppointmentStatus.pending,
            AppointmentStatus.confirmed,
            AppointmentStatus.completed,
        }
    )
    gaps_today = max(0, 8 - today_busy)

    avg_score = await db.scalar(
        select(func.avg(Feedback.score))
        .select_from(Feedback)
        .join(Appointment, Appointment.id == Feedback.appointment_id)
        .where(Appointment.business_id == owner.business_id)
    )

    total = len(appts)
    no_shows = sum(1 for a in appts if a.status == AppointmentStatus.no_show)
    cancelled = sum(1 for a in appts if a.status == AppointmentStatus.cancelled)
    visits = sum(
        1
        for a in appts
        if a.status
        in {
            AppointmentStatus.completed,
            AppointmentStatus.confirmed,
            AppointmentStatus.no_show,
        }
    )

    return DashboardAnalytics(
        days=day_list,
        by_channel=[
            ChannelBucket(channel=ch, count=cnt)
            for ch, cnt in sorted(channels.items(), key=lambda x: -x[1])
        ]
        or [ChannelBucket(channel=c.value, count=0) for c in Channel],
        gaps_today=gaps_today,
        feedback_avg=round(float(avg_score), 2) if avg_score is not None else None,
        visits=visits,
        no_show_rate=round(100 * no_shows / total, 1) if total else None,
        cancel_rate=round(100 * cancelled / total, 1) if total else None,
    )
