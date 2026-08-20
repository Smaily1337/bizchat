from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import GUID, str_enum
from app.models.enums import FeedbackRoute
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.appointment import Appointment


class Feedback(Base, TimestampMixin):
    __tablename__ = "feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        unique=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    routed_to: Mapped[FeedbackRoute] = mapped_column(
        str_enum(FeedbackRoute, "feedback_route_enum"),
        default=FeedbackRoute.none,
    )

    appointment: Mapped[Appointment] = relationship(back_populates="feedback")


class CancellationEvent(Base):
    __tablename__ = "cancellation_events"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        unique=True,
    )
    reason: Mapped[Optional[str]] = mapped_column(String(500))
    cancelled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    lead_time_hours: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))

    appointment: Mapped[Appointment] = relationship(
        back_populates="cancellation_event"
    )
