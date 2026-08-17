from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, ForeignKey, Index, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import GUID
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.customer import Customer


customer_tags = Table(
    "customer_tags",
    Base.metadata,
    Column(
        "customer_id",
        GUID,
        ForeignKey("customers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        GUID,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Tag(Base, TimestampMixin):
    """Custom label created by the salon for segmenting customers."""

    __tablename__ = "tags"
    __table_args__ = (
        Index("ix_tags_business_id", "business_id"),
        UniqueConstraint("business_id", "name", name="uq_tags_business_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("businesses.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(32))

    business: Mapped[Business] = relationship(back_populates="tags")
    customers: Mapped[list[Customer]] = relationship(
        secondary=customer_tags,
        back_populates="tags",
    )
