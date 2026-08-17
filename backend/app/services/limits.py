"""Licensing + usage limits for tenant businesses."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Business, Conversation, Customer, Message, Owner
from app.models.enums import Channel, MessageRole

PLAN_FREE = "free"
PLAN_STARTER = "starter"
PLAN_PRO = "pro"
PLAN_ENTERPRISE = "enterprise"

LICENSE_TRIAL = "trial"
LICENSE_ACTIVE = "active"
LICENSE_SUSPENDED = "suspended"
LICENSE_EXPIRED = "expired"

ALL_CHAT_CHANNELS = [
    Channel.widget.value,
    Channel.telegram.value,
    Channel.messenger.value,
    Channel.instagram.value,
    Channel.admin.value,
]

PLAN_DEFAULTS: dict[str, dict[str, Any]] = {
    PLAN_FREE: {
        "max_appointments_month": 30,
        "max_messages_month": 200,
        "max_seats": 2,
        "enabled_channels": [Channel.widget.value, Channel.admin.value],
        "trial_days": 14,
    },
    PLAN_STARTER: {
        "max_appointments_month": 150,
        "max_messages_month": 2000,
        "max_seats": 5,
        "enabled_channels": list(ALL_CHAT_CHANNELS),
        "trial_days": 0,
    },
    PLAN_PRO: {
        "max_appointments_month": None,
        "max_messages_month": None,
        "max_seats": 20,
        "enabled_channels": list(ALL_CHAT_CHANNELS),
        "trial_days": 0,
    },
    PLAN_ENTERPRISE: {
        "max_appointments_month": None,
        "max_messages_month": None,
        "max_seats": None,
        "enabled_channels": list(ALL_CHAT_CHANNELS),
        "trial_days": 0,
    },
}


class LimitExceededError(Exception):
    """Raised when a plan / license limit blocks an action."""

    def __init__(self, message: str, *, code: str = "limit_exceeded") -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.user_message = message


def month_window_utc(now: datetime | None = None) -> tuple[datetime, datetime]:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def apply_plan_defaults(
    business: Business,
    plan: str = PLAN_FREE,
    *,
    start_trial: bool = True,
) -> Business:
    """Set plan + default limits on a Business (in-memory)."""
    key = plan if plan in PLAN_DEFAULTS else PLAN_FREE
    defaults = PLAN_DEFAULTS[key]
    business.plan = key
    business.max_appointments_month = defaults["max_appointments_month"]
    business.max_messages_month = defaults["max_messages_month"]
    business.max_seats = defaults["max_seats"]
    business.enabled_channels = list(defaults["enabled_channels"])
    trial_days = int(defaults.get("trial_days") or 0)
    if start_trial and trial_days > 0:
        business.license_status = LICENSE_TRIAL
        business.license_expires_at = datetime.now(timezone.utc) + timedelta(
            days=trial_days
        )
    else:
        business.license_status = LICENSE_ACTIVE
        if business.license_expires_at is None and key == PLAN_FREE:
            # free without trial still active until manually suspended
            pass
    return business


def effective_channels(business: Business) -> list[str]:
    raw = business.enabled_channels
    if raw is None:
        defaults = PLAN_DEFAULTS.get(business.plan or PLAN_FREE, PLAN_DEFAULTS[PLAN_FREE])
        return list(defaults["enabled_channels"])
    return [str(c) for c in raw]


def is_license_usable(business: Business, *, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    status = (business.license_status or LICENSE_ACTIVE).lower()
    if status in {LICENSE_SUSPENDED, LICENSE_EXPIRED}:
        return False
    expires = business.license_expires_at
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            return False
    return status in {LICENSE_ACTIVE, LICENSE_TRIAL}


def assert_license_active(business: Business) -> None:
    now = datetime.now(timezone.utc)
    status = (business.license_status or LICENSE_ACTIVE).lower()
    if status == LICENSE_SUSPENDED:
        raise LimitExceededError(
            "Licencja salonu jest zawieszona. Skontaktuj się z BizChat.",
            code="license_suspended",
        )
    expires = business.license_expires_at
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            raise LimitExceededError(
                "Licencja wygasła. Odnów plan, aby dalej przyjmować rezerwacje.",
                code="license_expired",
            )
    if status == LICENSE_EXPIRED:
        raise LimitExceededError(
            "Licencja wygasła. Odnów plan, aby dalej przyjmować rezerwacje.",
            code="license_expired",
        )
    if status not in {LICENSE_ACTIVE, LICENSE_TRIAL}:
        raise LimitExceededError(
            "Licencja salonu jest nieaktywna.",
            code="license_inactive",
        )


async def count_appointments_month(
    db: AsyncSession, business_id: UUID, *, now: datetime | None = None
) -> int:
    start, end = month_window_utc(now)
    result = await db.execute(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.business_id == business_id,
            Appointment.created_at >= start,
            Appointment.created_at < end,
        )
    )
    return int(result.scalar_one())


async def count_messages_month(
    db: AsyncSession, business_id: UUID, *, now: datetime | None = None
) -> int:
    """Customer inbound messages this calendar month (UTC)."""
    start, end = month_window_utc(now)
    result = await db.execute(
        select(func.count())
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(Customer, Conversation.customer_id == Customer.id)
        .where(
            Customer.business_id == business_id,
            Message.role == MessageRole.customer,
            Message.created_at >= start,
            Message.created_at < end,
        )
    )
    return int(result.scalar_one())


async def count_seats(db: AsyncSession, business_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Owner)
        .where(Owner.business_id == business_id, Owner.is_active.is_(True))
    )
    return int(result.scalar_one())


async def assert_can_book(db: AsyncSession, business: Business) -> None:
    assert_license_active(business)
    limit = business.max_appointments_month
    if limit is None:
        return
    used = await count_appointments_month(db, business.id)
    if used >= limit:
        raise LimitExceededError(
            f"Limit rezerwacji w tym miesiącu wyczerpany ({used}/{limit}). "
            "Ulepsz plan lub poczekaj do kolejnego miesiąca.",
            code="appointments_limit",
        )


async def assert_can_receive_message(
    db: AsyncSession,
    business: Business,
    channel: Channel | str,
) -> None:
    assert_license_active(business)
    ch = channel.value if isinstance(channel, Channel) else str(channel)
    allowed = effective_channels(business)
    if ch != Channel.admin.value and ch not in allowed:
        raise LimitExceededError(
            f"Kanał „{ch}” nie jest włączony w planie tego salonu.",
            code="channel_not_allowed",
        )
    limit = business.max_messages_month
    if limit is None:
        return
    used = await count_messages_month(db, business.id)
    if used >= limit:
        raise LimitExceededError(
            f"Limit wiadomości w tym miesiącu wyczerpany ({used}/{limit}). "
            "Salon wróci do odpowiedzi po odnowieniu limitu.",
            code="messages_limit",
        )


async def assert_can_add_seat(db: AsyncSession, business: Business) -> None:
    assert_license_active(business)
    limit = business.max_seats
    if limit is None:
        return
    used = await count_seats(db, business.id)
    if used >= limit:
        raise LimitExceededError(
            f"Limit użytkowników panelu wyczerpany ({used}/{limit}). "
            "Ulepsz plan, aby dodać więcej kont.",
            code="seats_limit",
        )


@dataclass
class UsageSnapshot:
    plan: str
    license_status: str
    license_expires_at: Optional[datetime]
    is_active: bool
    appointments_month: int
    max_appointments_month: Optional[int]
    messages_month: int
    max_messages_month: Optional[int]
    seats: int
    max_seats: Optional[int]
    enabled_channels: list[str]
    period_start: datetime
    period_end: datetime


async def usage_snapshot(db: AsyncSession, business: Business) -> UsageSnapshot:
    start, end = month_window_utc()
    return UsageSnapshot(
        plan=business.plan or PLAN_FREE,
        license_status=business.license_status or LICENSE_ACTIVE,
        license_expires_at=business.license_expires_at,
        is_active=is_license_usable(business),
        appointments_month=await count_appointments_month(db, business.id),
        max_appointments_month=business.max_appointments_month,
        messages_month=await count_messages_month(db, business.id),
        max_messages_month=business.max_messages_month,
        seats=await count_seats(db, business.id),
        max_seats=business.max_seats,
        enabled_channels=effective_channels(business),
        period_start=start,
        period_end=end,
    )


def plans_catalog() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for plan_id, defaults in PLAN_DEFAULTS.items():
        out.append(
            {
                "id": plan_id,
                "max_appointments_month": defaults["max_appointments_month"],
                "max_messages_month": defaults["max_messages_month"],
                "max_seats": defaults["max_seats"],
                "enabled_channels": list(defaults["enabled_channels"]),
                "trial_days": defaults.get("trial_days", 0),
            }
        )
    return out
