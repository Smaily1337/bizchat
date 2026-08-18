from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import GUID, str_enum
from app.models.enums import TaskMailStatus, TaskPriority, TaskStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.business import Business, Owner


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("owners.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    priority: Mapped[TaskPriority] = mapped_column(
        str_enum(TaskPriority, "task_priority_enum"),
        default=TaskPriority.normal,
        nullable=False,
    )
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[TaskStatus] = mapped_column(
        str_enum(TaskStatus, "task_status_enum"),
        default=TaskStatus.open,
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    business: Mapped[Business] = relationship()
    created_by: Mapped[Optional[Owner]] = relationship(foreign_keys=[created_by_id])
    assignees: Mapped[list[TaskAssignee]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    attachments: Mapped[list[TaskAttachment]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TaskAssignee(Base, TimestampMixin):
    __tablename__ = "task_assignees"
    __table_args__ = (
        UniqueConstraint("task_id", "owner_id", name="uq_task_assignees_task_owner"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False
    )
    mail_status: Mapped[TaskMailStatus] = mapped_column(
        str_enum(TaskMailStatus, "task_mail_status_enum"),
        default=TaskMailStatus.pending,
        nullable=False,
    )
    mail_error: Mapped[Optional[str]] = mapped_column(String(500))

    task: Mapped[Task] = relationship(back_populates="assignees")
    owner: Mapped[Owner] = relationship()


class TaskAttachment(Base, TimestampMixin):
    __tablename__ = "task_attachments"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(128), default="application/octet-stream", nullable=False
    )
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    task: Mapped[Task] = relationship(back_populates="attachments")
