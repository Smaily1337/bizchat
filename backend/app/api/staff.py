"""Staff CRUD and performance analytics for multi-person scheduling."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import CurrentOwner, DbSession
from app.models import Appointment, Business, Customer, Service, Staff
from app.schemas import ORMModel

router = APIRouter(prefix="/api/staff", tags=["staff"])


class StaffOut(ORMModel):
    id: UUID
    business_id: UUID
    name: str
    avatar_url: str | None = None
    color: str | None = None
    is_active: bool
    sort_order: int


class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    avatar_url: str | None = None
    color: str | None = None
    sort_order: int = 0


class StaffUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None
    color: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class StaffAppointmentItem(BaseModel):
    id: UUID
    start_at: datetime
    end_at: datetime
    service_name: str
    service_price: float
    service_duration_min: int
    customer_name: str
    customer_phone: str | None = None
    customer_email: str | None = None
    status: str
    notes: str | None = None
    channel: str


class StaffServiceStat(BaseModel):
    service_name: str
    count: int
    total_revenue: float
    avg_price: float


class StaffStatsOut(BaseModel):
    staff_id: UUID
    name: str
    avatar_url: str | None = None
    color: str | None = None
    is_active: bool
    period_days: int | None = None
    total_appointments: int
    completed_count: int
    confirmed_count: int
    cancelled_count: int
    no_show_count: int
    total_revenue: float
    avg_ticket: float
    total_hours_worked: float
    unique_customers_count: int
    no_show_rate: float
    cancellation_rate: float
    services_breakdown: list[StaffServiceStat]
    appointments: list[StaffAppointmentItem]


class StaffLeaderboardItem(BaseModel):
    staff_id: UUID
    name: str
    avatar_url: str | None = None
    color: str | None = None
    is_active: bool
    appointments_count: int
    total_revenue: float
    rank: int


@router.get("", response_model=list[StaffOut])
async def list_staff(db: DbSession, owner: CurrentOwner) -> list[Staff]:
    result = await db.execute(
        select(Staff)
        .where(Staff.business_id == owner.business_id)
        .order_by(Staff.sort_order, Staff.name)
    )
    return list(result.scalars().all())


@router.get("/overview-stats", response_model=list[StaffLeaderboardItem])
async def staff_overview_stats(
    db: DbSession,
    owner: CurrentOwner,
    days: int = Query(default=30, ge=1, le=365),
) -> list[StaffLeaderboardItem]:
    """Returns a leaderboard and KPI overview for all staff members."""
    staff_res = await db.execute(
        select(Staff)
        .where(Staff.business_id == owner.business_id)
        .order_by(Staff.sort_order, Staff.name)
    )
    staff_list = list(staff_res.scalars().all())
    if not staff_list:
        return []

    cutoff_utc = datetime.now(timezone.utc) - timedelta(days=days)

    # Fetch active appointments in period
    appts_res = await db.execute(
        select(Appointment)
        .where(
            Appointment.business_id == owner.business_id,
            Appointment.start_at >= cutoff_utc,
            Appointment.status != "cancelled",
        )
    )
    appts = list(appts_res.scalars().all())

    # Pre-fetch services
    svc_res = await db.execute(
        select(Service).where(Service.business_id == owner.business_id)
    )
    services_map = {s.id: s for s in svc_res.scalars().all()}

    staff_metrics: dict[UUID, dict[str, Any]] = {}
    for st in staff_list:
        staff_metrics[st.id] = {
            "appointments_count": 0,
            "total_revenue": Decimal("0.00"),
        }

    for a in appts:
        if a.staff_id and a.staff_id in staff_metrics:
            svc = services_map.get(a.service_id) if a.service_id else None
            price = Decimal(str(svc.price)) if svc and svc.price else Decimal("0.00")
            staff_metrics[a.staff_id]["appointments_count"] += 1
            staff_metrics[a.staff_id]["total_revenue"] += price

    leaderboard: list[StaffLeaderboardItem] = []
    for st in staff_list:
        m = staff_metrics[st.id]
        leaderboard.append(
            StaffLeaderboardItem(
                staff_id=st.id,
                name=st.name,
                avatar_url=st.avatar_url,
                color=st.color,
                is_active=st.is_active,
                appointments_count=m["appointments_count"],
                total_revenue=float(m["total_revenue"]),
                rank=0,
            )
        )

    # Sort by revenue desc
    leaderboard.sort(key=lambda x: x.total_revenue, reverse=True)
    for idx, item in enumerate(leaderboard, start=1):
        item.rank = idx

    return leaderboard


@router.get("/{staff_id}/stats", response_model=StaffStatsOut)
async def get_staff_stats(
    db: DbSession,
    owner: CurrentOwner,
    staff_id: UUID,
    days: int | None = Query(default=30),
) -> StaffStatsOut:
    """Returns detailed KPIs, service breakdown, and appointment history for a single staff member."""
    staff_row = await db.get(Staff, staff_id)
    if staff_row is None or staff_row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Staff member not found")

    # Fetch appointments
    query = (
        select(Appointment)
        .where(
            Appointment.business_id == owner.business_id,
            Appointment.staff_id == staff_id,
        )
        .order_by(Appointment.start_at.desc())
    )

    if days is not None and days > 0:
        cutoff_utc = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(Appointment.start_at >= cutoff_utc)

    result = await db.execute(query)
    appts = list(result.scalars().all())

    # Pre-fetch services and customers for this business
    svc_res = await db.execute(
        select(Service).where(Service.business_id == owner.business_id)
    )
    services_map = {s.id: s for s in svc_res.scalars().all()}

    cust_res = await db.execute(
        select(Customer).where(Customer.business_id == owner.business_id)
    )
    customers_map = {c.id: c for c in cust_res.scalars().all()}

    total_appts = len(appts)
    completed_count = sum(1 for a in appts if a.status == "completed")
    confirmed_count = sum(1 for a in appts if a.status == "confirmed")
    cancelled_count = sum(1 for a in appts if a.status == "cancelled")
    no_show_count = sum(1 for a in appts if a.status == "no_show")

    active_appts = [a for a in appts if a.status != "cancelled"]
    total_revenue = Decimal("0.00")
    total_duration_minutes = 0
    unique_customer_ids = set()

    service_stats_map: dict[str, dict[str, Any]] = {}
    appt_items: list[StaffAppointmentItem] = []

    for a in appts:
        svc = services_map.get(a.service_id) if a.service_id else None
        svc_name = svc.name if svc else "Wizyta"
        svc_price = float(svc.price) if svc and svc.price else 0.0
        svc_dur = svc.duration_min if svc and svc.duration_min else 30

        cust = customers_map.get(a.customer_id) if a.customer_id else None
        cust_name = cust.name if (cust and cust.name) else "Klient"
        cust_phone = cust.phone if cust else None
        cust_email = cust.email if cust else None

        if a.customer_id:
            unique_customer_ids.add(a.customer_id)

        if a.status != "cancelled":
            total_revenue += Decimal(str(svc_price))
            # Calculate actual duration or default from service
            diff_min = int((a.end_at - a.start_at).total_seconds() / 60)
            dur = max(15, diff_min if diff_min > 0 else svc_dur)
            total_duration_minutes += dur

            if svc_name not in service_stats_map:
                service_stats_map[svc_name] = {
                    "count": 0,
                    "revenue": Decimal("0.00"),
                }
            service_stats_map[svc_name]["count"] += 1
            service_stats_map[svc_name]["revenue"] += Decimal(str(svc_price))

        ch_str = a.channel.value if hasattr(a.channel, "value") else str(a.channel or "admin")

        appt_items.append(
            StaffAppointmentItem(
                id=a.id,
                start_at=a.start_at,
                end_at=a.end_at,
                service_name=svc_name,
                service_price=svc_price,
                service_duration_min=svc_dur,
                customer_name=cust_name,
                customer_phone=cust_phone,
                customer_email=cust_email,
                status=a.status.value if hasattr(a.status, "value") else str(a.status),
                notes=a.notes,
                channel=ch_str,
            )
        )

    avg_ticket = float(total_revenue / len(active_appts)) if active_appts else 0.0
    total_hours = round(total_duration_minutes / 60.0, 1)
    no_show_rate = round((no_show_count / total_appts * 100), 1) if total_appts > 0 else 0.0
    cancellation_rate = round((cancelled_count / total_appts * 100), 1) if total_appts > 0 else 0.0

    services_breakdown: list[StaffServiceStat] = []
    for s_name, s_data in service_stats_map.items():
        cnt = s_data["count"]
        rev = float(s_data["revenue"])
        services_breakdown.append(
            StaffServiceStat(
                service_name=s_name,
                count=cnt,
                total_revenue=rev,
                avg_price=round(rev / cnt, 2) if cnt > 0 else 0.0,
            )
        )
    services_breakdown.sort(key=lambda x: x.count, reverse=True)

    return StaffStatsOut(
        staff_id=staff_row.id,
        name=staff_row.name,
        avatar_url=staff_row.avatar_url,
        color=staff_row.color,
        is_active=staff_row.is_active,
        period_days=days,
        total_appointments=total_appts,
        completed_count=completed_count,
        confirmed_count=confirmed_count,
        cancelled_count=cancelled_count,
        no_show_count=no_show_count,
        total_revenue=float(total_revenue),
        avg_ticket=avg_ticket,
        total_hours_worked=total_hours,
        unique_customers_count=len(unique_customer_ids),
        no_show_rate=no_show_rate,
        cancellation_rate=cancellation_rate,
        services_breakdown=services_breakdown,
        appointments=appt_items,
    )


@router.post("", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
async def create_staff(
    db: DbSession, owner: CurrentOwner, body: StaffCreate
) -> Staff:
    row = Staff(
        business_id=owner.business_id,
        name=body.name.strip(),
        avatar_url=body.avatar_url,
        color=body.color,
        sort_order=body.sort_order,
        is_active=True,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{staff_id}", response_model=StaffOut)
async def update_staff(
    db: DbSession, owner: CurrentOwner, staff_id: UUID, body: StaffUpdate
) -> Staff:
    row = await db.get(Staff, staff_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Staff not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for k, v in data.items():
        setattr(row, k, v)
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(
    db: DbSession, owner: CurrentOwner, staff_id: UUID
) -> Response:
    row = await db.get(Staff, staff_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Staff not found")
    row.is_active = False
    await db.flush()
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

