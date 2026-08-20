"""Starter content for newly registered salons so the bot/calendar aren't empty."""

from __future__ import annotations

from datetime import time
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import KnowledgeItem, Service, WorkingHours


async def seed_starter_salon(db: AsyncSession, business_id: UUID) -> None:
    """Add one service, Mon–Fri hours, and FAQ rows."""
    db.add(
        Service(
            id=uuid4(),
            business_id=business_id,
            name="Konsultacja / wizyta",
            duration_min=30,
            price=Decimal("0"),
            description="Usługa startowa — edytuj w Ustawieniach.",
        )
    )
    for weekday in range(5):  # Mon–Fri
        db.add(
            WorkingHours(
                id=uuid4(),
                business_id=business_id,
                weekday=weekday,
                start_time=time(9, 0),
                end_time=time(17, 0),
            )
        )
    db.add(
        KnowledgeItem(
            id=uuid4(),
            business_id=business_id,
            category="faq",
            question="Jak umówić wizytę?",
            answer=(
                "Napisz do nas na Messengerze / Telegramie albo skorzystaj z widgetu "
                "na stronie — bot pomoże wybrać termin."
            ),
        )
    )
    db.add(
        KnowledgeItem(
            id=uuid4(),
            business_id=business_id,
            category="faq",
            question="Czy mogę odwołać wizytę?",
            answer=(
                "Tak — napisz do nas lub kliknij Odwołuję w przypomnieniu przed wizytą."
            ),
        )
    )
    await db.flush()
