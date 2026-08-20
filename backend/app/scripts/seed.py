"""Seed a demo business + owner + sample data for local development.

Usage (from backend/ with venv active and DB migrated):
  python -m app.scripts.seed
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.api.deps import hash_password
from app.config import settings
from app.db.session import AsyncSessionLocal
from app.models import (
    Appointment,
    Business,
    Customer,
    KnowledgeItem,
    NotificationLog,
    NotificationSettings,
    NotificationTemplate,
    Owner,
    Service,
    WorkingHours,
)
from app.models.enums import (
    AppointmentStatus,
    Channel,
    NotificationChannel,
    NotificationKind,
    NotificationStatus,
    UserRole,
)
from app.services.limits import (
    LICENSE_ACTIVE,
    PLAN_PRO,
    apply_plan_defaults,
)


def _default_templates(business_id: uuid.UUID) -> list[NotificationTemplate]:
    return [
        NotificationTemplate(
            business_id=business_id,
            kind=NotificationKind.reminder,
            name="Przypomnienie o wizycie",
            body=(
                "Cześć {{klient}}! Przypominamy o wizycie ({{usluga}}) "
                "w {{firma}} dnia {{data}} o {{godzina}}. Do zobaczenia!"
            ),
            is_default=True,
        ),
        NotificationTemplate(
            business_id=business_id,
            kind=NotificationKind.waitlist,
            name="Zwolnił się termin",
            body=(
                "Dzień dobry {{klient}}! Zwolnił się termin na {{usluga}} "
                "dnia {{data}} o {{godzina}}. Odpowiedz TAK, aby zarezerwować."
            ),
            is_default=True,
        ),
        NotificationTemplate(
            business_id=business_id,
            kind=NotificationKind.feedback,
            name="Prośba o opinię",
            body=(
                "Dziękujemy za wizytę w {{firma}}, {{klient}}! "
                "Jak oceniasz usługę {{usluga}}? Odpowiedz oceną 1–5."
            ),
            is_default=True,
        ),
        NotificationTemplate(
            business_id=business_id,
            kind=NotificationKind.custom,
            name="Wiadomość od salonu",
            body="Dzień dobry {{klient}}, tu {{firma}}. ",
            is_default=False,
        ),
    ]


async def _ensure_license_defaults(session, business: Business) -> bool:
    """Ensure demo / existing businesses have usable license fields."""
    changed = False
    if not getattr(business, "plan", None):
        apply_plan_defaults(business, PLAN_PRO, start_trial=False)
        business.license_status = LICENSE_ACTIVE
        business.license_expires_at = None
        return True
    # Demo salon: keep generous pro limits so local/cloud testing isn't blocked
    if business.name == "Demo Salon" and business.plan != PLAN_PRO:
        apply_plan_defaults(business, PLAN_PRO, start_trial=False)
        business.license_status = LICENSE_ACTIVE
        business.license_expires_at = None
        changed = True
    elif business.max_appointments_month is None and business.max_messages_month is None:
        # Newly migrated row without defaults applied — leave unlimited only if pro+
        if business.plan in {"free", "starter"} and business.max_seats is None:
            apply_plan_defaults(business, business.plan or "free", start_trial=False)
            changed = True
    return changed


async def _ensure_notification_defaults(session, business_id: uuid.UUID) -> bool:
    """Top-up for already-seeded databases; returns True if anything was added."""
    added = False
    has_settings = (
        await session.execute(
            select(NotificationSettings).where(
                NotificationSettings.business_id == business_id
            )
        )
    ).scalar_one_or_none()
    if has_settings is None:
        session.add(
            NotificationSettings(
                business_id=business_id,
                reminders_enabled=True,
                lead_times_min=[1440, 120, 30],
                max_per_appointment=3,
                default_channel=NotificationChannel.sms,
            )
        )
        added = True

    has_templates = (
        await session.execute(
            select(NotificationTemplate).where(
                NotificationTemplate.business_id == business_id
            )
        )
    ).scalars().first()
    if has_templates is None:
        session.add_all(_default_templates(business_id))
        added = True
    return added


async def _ensure_platform_admin(session, business_id: uuid.UUID) -> bool:
    """Idempotent: seed platform superadmin admin@bizchat.local."""
    existing = await session.execute(
        select(Owner).where(Owner.email == "admin@bizchat.local")
    )
    admin = existing.scalar_one_or_none()
    if admin:
        changed = False
        if not admin.is_platform_admin:
            admin.is_platform_admin = True
            changed = True
        if not admin.is_active:
            admin.is_active = True
            changed = True
        return changed

    session.add(
        Owner(
            email="admin@bizchat.local",
            password_hash=hash_password("changeme"),
            name="Platform Admin",
            role=UserRole.owner,
            email_verified=True,
            is_active=True,
            is_platform_admin=True,
            business_id=business_id,
        )
    )
    return True


async def seed() -> None:
    if settings.environment.lower() in {"production", "prod"}:
        # Never auto-create weak demo accounts in production.
        logger = __import__("logging").getLogger(__name__)
        logger.warning("AUTO_SEED skipped in production environment")
        return

    async with AsyncSessionLocal() as session:
        existing = await session.execute(
            select(Owner).where(Owner.email == "owner@bizchat.local")
        )
        existing_owner = existing.scalar_one_or_none()
        if existing_owner:
            biz = await session.get(Business, existing_owner.business_id)
            topped = False
            if biz is not None:
                topped = await _ensure_license_defaults(session, biz) or topped
            topped = await _ensure_notification_defaults(
                session, existing_owner.business_id
            ) or topped
            topped = await _ensure_platform_admin(
                session, existing_owner.business_id
            ) or topped
            if topped:
                await session.commit()
                print(
                    "Seed top-up: license / notification defaults / platform admin "
                    "(admin@bizchat.local / changeme)"
                )
            else:
                print("Seed already applied (owner@bizchat.local exists)")
            return

        business = Business(
            id=uuid.uuid4(),
            name="Demo Salon",
            timezone="Europe/Warsaw",
            settings={"locale": "pl", "currency": "PLN"},
        )
        apply_plan_defaults(business, PLAN_PRO, start_trial=False)
        business.license_status = LICENSE_ACTIVE
        business.license_expires_at = None
        session.add(business)
        await session.flush()

        owner = Owner(
            email="owner@bizchat.local",
            password_hash=hash_password("changeme"),
            name="Demo Owner",
            role=UserRole.owner,
            email_verified=True,
            is_active=True,
            business_id=business.id,
        )
        session.add(owner)
        await _ensure_platform_admin(session, business.id)

        services = [
            Service(
                business_id=business.id,
                name="Strzyżenie",
                duration_min=45,
                price=Decimal("80.00"),
                description="Klasyczne strzyżenie",
            ),
            Service(
                business_id=business.id,
                name="Koloryzacja",
                duration_min=90,
                price=Decimal("220.00"),
                description="Farbowanie + pielęgnacja",
            ),
            Service(
                business_id=business.id,
                name="Manicure",
                duration_min=60,
                price=Decimal("110.00"),
                description="Manicure hybrydowy",
            ),
        ]
        session.add_all(services)
        await session.flush()

        for weekday in range(5):  # Mon–Fri
            session.add(
                WorkingHours(
                    business_id=business.id,
                    weekday=weekday,
                    start_time=time(9, 0),
                    end_time=time(17, 0),
                )
            )

        customers = [
            Customer(
                business_id=business.id,
                name="Anna Kowalska",
                phone="+48123123123",
                email="anna.kowalska@example.com",
                external_ids={},
            ),
            Customer(
                business_id=business.id,
                name="Marta Nowak",
                phone="+48456456456",
                email="marta.nowak@example.com",
                external_ids={},
            ),
            Customer(
                business_id=business.id,
                name="Jakub Wiśniewski",
                phone="+48789789789",
                email="jakub.wisniewski@example.com",
                external_ids={},
            ),
        ]
        session.add_all(customers)
        await session.flush()

        now = datetime.now(timezone.utc)
        # Next Monday 09:00-ish relative to today for demo calendar
        monday = now.date() - timedelta(days=now.weekday())
        base = datetime.combine(monday, time(9, 0), tzinfo=timezone.utc)

        session.add_all(
            [
                Appointment(
                    business_id=business.id,
                    customer_id=customers[0].id,
                    service_id=services[0].id,
                    start_at=base + timedelta(hours=0),
                    end_at=base + timedelta(minutes=45),
                    status=AppointmentStatus.confirmed,
                    channel=Channel.admin,
                    notes="Stała klientka",
                ),
                Appointment(
                    business_id=business.id,
                    customer_id=customers[1].id,
                    service_id=services[1].id,
                    start_at=base + timedelta(hours=4),
                    end_at=base + timedelta(hours=5, minutes=30),
                    status=AppointmentStatus.pending,
                    channel=Channel.widget,
                ),
                Appointment(
                    business_id=business.id,
                    customer_id=customers[2].id,
                    service_id=services[2].id,
                    start_at=base + timedelta(days=2, hours=1),
                    end_at=base + timedelta(days=2, hours=2),
                    status=AppointmentStatus.confirmed,
                    channel=Channel.telegram,
                ),
            ]
        )

        session.add(
            KnowledgeItem(
                business_id=business.id,
                category="hours",
                question="Jakie są godziny otwarcia?",
                answer="Jesteśmy otwarci od poniedziałku do piątku w godzinach 9:00–17:00.",
            )
        )
        session.add(
            KnowledgeItem(
                business_id=business.id,
                category="location",
                question="Gdzie jesteście?",
                answer="Znajdujemy się w centrum — dokładny adres podamy w wiadomości po rezerwacji.",
            )
        )
        session.add(
            KnowledgeItem(
                business_id=business.id,
                category="parking",
                question="Czy jest parking?",
                answer="Tak, parking dla klientów znajduje się za budynkiem.",
            )
        )

        session.add(
            NotificationSettings(
                business_id=business.id,
                reminders_enabled=True,
                lead_times_min=[1440, 120, 30],
                max_per_appointment=3,
                default_channel=NotificationChannel.sms,
            )
        )
        session.add_all(_default_templates(business.id))

        session.add(
            NotificationLog(
                business_id=business.id,
                customer_id=customers[0].id,
                channel=NotificationChannel.sms,
                kind=NotificationKind.reminder,
                status=NotificationStatus.sent,
                body=(
                    "Cześć Anna Kowalska! Przypominamy o wizycie (Strzyżenie) "
                    "w Demo Salon. Do zobaczenia!"
                ),
                provider="mock",
                lead_time_min=1440,
                sent_at=now,
            )
        )

        await session.commit()
        print(f"Seeded business={business.id}")
        print("Login (salon): owner@bizchat.local / changeme")
        print("Login (platform admin): admin@bizchat.local / changeme")


if __name__ == "__main__":
    asyncio.run(seed())
