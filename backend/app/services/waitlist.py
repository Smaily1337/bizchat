"""Waitlist service — stub without predictive scoring."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import WaitlistEntry
from app.models.enums import WaitlistStatus


async def add_to_waitlist(
    db: AsyncSession,
    *,
    business_id: UUID,
    customer_id: UUID,
    service_id: UUID,
    preferred_windows: list[Any] | None = None,
) -> WaitlistEntry:
    entry = WaitlistEntry(
        business_id=business_id,
        customer_id=customer_id,
        service_id=service_id,
        preferred_windows=preferred_windows or [],
        status=WaitlistStatus.active,
    )
    db.add(entry)
    await db.flush()
    return entry


async def list_waitlist(
    db: AsyncSession,
    business_id: UUID,
    *,
    status: WaitlistStatus = WaitlistStatus.active,
) -> list[WaitlistEntry]:
    result = await db.execute(
        select(WaitlistEntry)
        .where(
            WaitlistEntry.business_id == business_id,
            WaitlistEntry.status == status,
        )
        .order_by(WaitlistEntry.created_at)
    )
    return list(result.scalars().all())


async def notify_next_on_cancellation(
    db: AsyncSession,
    *,
    business_id: UUID,
    service_id: UUID,
) -> WaitlistEntry | None:
    """Stub: return first active entry — no prediction / scoring."""
    result = await db.execute(
        select(WaitlistEntry)
        .where(
            WaitlistEntry.business_id == business_id,
            WaitlistEntry.service_id == service_id,
            WaitlistEntry.status == WaitlistStatus.active,
        )
        .order_by(WaitlistEntry.created_at)
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None
    entry.status = WaitlistStatus.offered
    await db.flush()
    return entry
