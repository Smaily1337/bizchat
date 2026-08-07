from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import Channel, ConversationState, MessageRole
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.customer import Customer


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"
    __table_args__ = (
        Index("ix_conversations_channel_thread", "channel", "external_thread_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE")
    )
    channel: Mapped[Channel] = mapped_column(
        Enum(Channel, name="channel_enum", native_enum=True, create_type=False),
        nullable=False,
    )
    external_thread_id: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[ConversationState] = mapped_column(
        Enum(ConversationState, name="conversation_state_enum", native_enum=True),
        default=ConversationState.idle,
    )
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    customer: Mapped[Customer] = relationship(back_populates="conversations")
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation",
        order_by="Message.created_at",
    )


class Message(Base, TimestampMixin):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_id", "conversation_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE")
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role_enum", native_enum=True),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    raw_payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
