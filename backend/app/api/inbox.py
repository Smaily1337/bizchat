"""Inbox — list conversations, messages, owner reply."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentOwner, DbSession
from app.bot.adapters.meta import MetaAdapter
from app.bot.adapters.telegram import TelegramAdapter
from app.bot.adapters.widget import WidgetAdapter
from app.models import Conversation, Customer, Message
from app.models.enums import Channel, ConversationState, MessageRole
from app.models.mixins import utc_now
from app.schemas import ORMModel, OutboundMessage
from app.services.events import hub

router = APIRouter(prefix="/api/inbox", tags=["inbox"])


class ConversationOut(ORMModel):
    id: UUID
    customer_id: UUID
    customer_name: str | None = None
    channel: Channel
    state: ConversationState
    external_thread_id: str
    updated_at: datetime
    last_message: str | None = None
    last_role: MessageRole | None = None


class MessageOut(ORMModel):
    id: UUID
    conversation_id: UUID
    role: MessageRole
    content: str
    created_at: datetime


class ReplyIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


def _last_msg(conv: Conversation) -> Message | None:
    if not conv.messages:
        return None
    return conv.messages[-1]


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(db: DbSession, owner: CurrentOwner) -> list[ConversationOut]:
    result = await db.execute(
        select(Conversation)
        .join(Customer, Customer.id == Conversation.customer_id)
        .where(Customer.business_id == owner.business_id)
        .options(
            selectinload(Conversation.customer),
            selectinload(Conversation.messages),
        )
        .order_by(Conversation.updated_at.desc())
        .limit(100)
    )
    out: list[ConversationOut] = []
    for conv in result.scalars().unique().all():
        last = _last_msg(conv)
        out.append(
            ConversationOut(
                id=conv.id,
                customer_id=conv.customer_id,
                customer_name=conv.customer.name if conv.customer else None,
                channel=conv.channel,
                state=conv.state,
                external_thread_id=conv.external_thread_id,
                updated_at=conv.updated_at,
                last_message=last.content if last else None,
                last_role=last.role if last else None,
            )
        )
    return out


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: UUID,
    db: DbSession,
    owner: CurrentOwner,
) -> list[MessageOut]:
    conv = await _get_owned_conversation(db, owner.business_id, conversation_id)
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    )
    return [
        MessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            created_at=m.created_at,
        )
        for m in result.scalars().all()
    ]


@router.post(
    "/conversations/{conversation_id}/reply",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def reply_as_owner(
    conversation_id: UUID,
    body: ReplyIn,
    db: DbSession,
    owner: CurrentOwner,
) -> MessageOut:
    conv = await _get_owned_conversation(db, owner.business_id, conversation_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Pusta wiadomość")

    msg = Message(
        conversation_id=conv.id,
        role=MessageRole.owner,
        content=text,
        raw_payload={"source": "admin_inbox"},
    )
    db.add(msg)
    conv.updated_at = utc_now()
    await db.flush()
    await db.refresh(msg)

    # Deliver owner reply to the customer on the original channel
    outbound = OutboundMessage(
        channel=conv.channel,
        external_thread_id=conv.external_thread_id,
        text=text,
    )
    if conv.channel in {Channel.messenger, Channel.instagram}:
        await MetaAdapter(business_id=owner.business_id).send_outbound(outbound)
    elif conv.channel == Channel.telegram:
        await TelegramAdapter(business_id=owner.business_id).send_outbound(outbound)
    elif conv.channel == Channel.widget:
        await WidgetAdapter(business_id=owner.business_id).send_outbound(outbound)

    await hub.publish(
        owner.business_id,
        "chat.message",
        {
            "conversation_id": str(conv.id),
            "role": "owner",
            "channel": conv.channel.value,
        },
        title="Odpowiedź wysłana",
        message=text[:120],
    )
    return MessageOut(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at,
    )


async def _get_owned_conversation(
    db: DbSession, business_id: UUID, conversation_id: UUID
) -> Conversation:
    result = await db.execute(
        select(Conversation)
        .join(Customer, Customer.id == Conversation.customer_id)
        .where(
            Conversation.id == conversation_id,
            Customer.business_id == business_id,
        )
        .options(selectinload(Conversation.customer))
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv
