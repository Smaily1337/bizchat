from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import GUID, JSONType, str_enum
from app.models.enums import NotificationChannel, NotificationKind, NotificationStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.customer import Customer


class NotificationTemplate(Base, TimestampMixin):
    """Editable message template with {{placeholders}}."""

    __tablename__ = "notification_templates"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("businesses.id", ondelete="CASCADE")
    )
    kind: Mapped[NotificationKind] = mapped_column(
        str_enum(NotificationKind, "notification_kind_enum"),
        default=NotificationKind.custom,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


class NotificationSettings(Base, TimestampMixin):
    """Per-business automatic reminder rules (one row per business)."""

    __tablename__ = "notification_settings"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        unique=True,
    )
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Minutes before appointment start, e.g. [1440, 120, 30]
    lead_times_min: Mapped[list[Any]] = mapped_column(JSONType, default=list)
    max_per_appointment: Mapped[int] = mapped_column(Integer, default=3)
    default_channel: Mapped[NotificationChannel] = mapped_column(
        str_enum(NotificationChannel, "notification_channel_enum"),
        default=NotificationChannel.sms,
    )


class NotificationLog(Base, TimestampMixin):
    __tablename__ = "notification_logs"
    __table_args__ = (
        Index("ix_notification_logs_business_created", "business_id", "created_at"),
        Index(
            "ix_notification_logs_appointment_kind",
            "appointment_id",
            "kind",
            "lead_time_min",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("businesses.id", ondelete="CASCADE")
    )
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("appointments.id", ondelete="SET NULL")
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID, ForeignKey("customers.id", ondelete="SET NULL")
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        str_enum(NotificationChannel, "notification_channel_enum"),
        default=NotificationChannel.sms,
    )
    kind: Mapped[NotificationKind] = mapped_column(
        str_enum(NotificationKind, "notification_kind_enum"),
        default=NotificationKind.custom,
    )
    status: Mapped[NotificationStatus] = mapped_column(
        str_enum(NotificationStatus, "notification_status_enum"),
        default=NotificationStatus.sent,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(String(500))
    provider: Mapped[str] = mapped_column(String(64), default="mock")
    # Which reminder window produced this log (minutes), None for manual sends
    lead_time_min: Mapped[Optional[int]] = mapped_column(Integer)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    appointment: Mapped[Optional[Appointment]] = relationship()
    customer: Mapped[Optional[Customer]] = relationship()
