"""Stripe Checkout deposits (mock when STRIPE_SECRET_KEY empty)."""

from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Appointment, Business
from app.models.enums import AppointmentStatus, DepositStatus
from app.services.events import hub

logger = logging.getLogger(__name__)


async def create_checkout_session(
    db: AsyncSession,
    *,
    business: Business,
    appointment: Appointment,
    amount: Decimal,
) -> str:
    """Return a Stripe Checkout URL or a mock pay URL."""
    success = (
        f"{settings.public_frontend_url.rstrip('/')}/book/"
        f"{business.public_slug or business.id}?paid=1"
    )
    cancel = (
        f"{settings.public_frontend_url.rstrip('/')}/book/"
        f"{business.public_slug or business.id}?paid=0"
    )
    amount_cents = int(amount * 100)
    if amount_cents < 1:
        appointment.deposit_status = DepositStatus.waived.value
        return ""

    if not settings.stripe_secret_key:
        session_id = f"mock_{appointment.id}"
        appointment.stripe_checkout_session_id = session_id
        mock_url = (
            f"{settings.public_api_url.rstrip('/')}/api/payments/mock-pay"
            f"?session_id={session_id}"
        )
        logger.info("Stripe mock checkout → %s amount=%s", mock_url, amount)
        return mock_url

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
            data={
                "mode": "payment",
                "success_url": success,
                "cancel_url": cancel,
                "line_items[0][price_data][currency]": settings.stripe_currency,
                "line_items[0][price_data][product_data][name]": (
                    f"Zaliczka — {business.name}"
                ),
                "line_items[0][price_data][unit_amount]": str(amount_cents),
                "line_items[0][quantity]": "1",
                "metadata[appointment_id]": str(appointment.id),
                "metadata[business_id]": str(business.id),
            },
        )
        if resp.is_error:
            logger.error("Stripe session failed: %s", resp.text[:400])
            raise RuntimeError("Stripe niedostępny")
        data = resp.json()
        appointment.stripe_checkout_session_id = data.get("id")
        return data.get("url") or ""


async def mark_paid(db: AsyncSession, appointment: Appointment) -> None:
    appointment.deposit_status = DepositStatus.paid.value
    if appointment.status == AppointmentStatus.pending:
        appointment.status = AppointmentStatus.confirmed
    await db.flush()
    await hub.publish(
        appointment.business_id,
        "appointment.deposit_paid",
        {"id": str(appointment.id)},
        title="Zaliczka opłacona",
        message=str(appointment.id),
    )


async def find_by_session(
    db: AsyncSession, session_id: str
) -> Appointment | None:
    result = await db.execute(
        select(Appointment).where(
            Appointment.stripe_checkout_session_id == session_id
        )
    )
    return result.scalar_one_or_none()


async def find_by_id(db: AsyncSession, appointment_id: str) -> Appointment | None:
    try:
        return await db.get(Appointment, UUID(appointment_id))
    except ValueError:
        return None
