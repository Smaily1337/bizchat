from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import GUID, JSONType, str_enum
from app.models.enums import AppointmentStatus, Channel, WaitlistStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.business import Service
    from app.models.customer import Customer
    from app.models.feedback import CancellationEvent, Feedback


class Appointment(Base, TimestampMixin):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_business_start", "business_id", "start_at"),
        Index("ix_appointments_customer_id", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("businesses.id", ondelete="CASCADE")
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("customers.id", ondelete="CASCADE")
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("services.id", ondelete="RESTRICT")
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        str_enum(AppointmentStatus, "appointment_status_enum"),
        default=AppointmentStatus.pending,
    )
    channel: Mapped[Channel] = mapped_column(
        str_enum(Channel, "channel_enum"),
        default=Channel.admin,
    )
    gcal_event_id: Mapped[Optional[str]] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    customer: Mapped[Customer] = relationship(back_populates="appointments")
    service: Mapped[Service] = relationship(back_populates="appointments")
    feedback: Mapped[Optional[Feedback]] = relationship(
        back_populates="appointment", uselist=False
    )
    cancellation_event: Mapped[Optional[CancellationEvent]] = relationship(
        back_populates="appointment", uselist=False
    )


class WaitlistEntry(Base, TimestampMixin):
    __tablename__ = "waitlist_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("businesses.id", ondelete="CASCADE")
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("customers.id", ondelete="CASCADE")
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("services.id", ondelete="CASCADE")
    )
    preferred_windows: Mapped[list[Any]] = mapped_column(JSONType, default=list)
    status: Mapped[WaitlistStatus] = mapped_column(
        str_enum(WaitlistStatus, "waitlist_status_enum"),
        default=WaitlistStatus.active,
    )

    customer: Mapped[Customer] = relationship()
    service: Mapped[Service] = relationship()
