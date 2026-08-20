from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import GUID, JSONType
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.business import Business
    from app.models.conversation import Conversation
    from app.models.tag import Tag


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"
    __table_args__ = (Index("ix_customers_business_id", "business_id"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("businesses.id", ondelete="CASCADE")
    )
    name: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(64))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    external_ids: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)

    business: Mapped[Business] = relationship(back_populates="customers")
    conversations: Mapped[list[Conversation]] = relationship(
        back_populates="customer"
    )
    appointments: Mapped[list[Appointment]] = relationship(
        back_populates="customer"
    )
    tags: Mapped[list["Tag"]] = relationship(
        secondary="customer_tags",
        back_populates="customers",
    )
