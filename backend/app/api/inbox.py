"""Inbox — list conversations, messages, owner reply."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
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
from app.services.meta_import import (
    MetaImportError,
    import_messenger_conversations,
    import_messenger_psids,
    parse_psid_lines,
)

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


class StartConversationIn(BaseModel):
    customer_id: UUID
    text: str = Field(min_length=1, max_length=4000)
    channel: Channel = Channel.messenger


class StartConversationOut(BaseModel):
    conversation: ConversationOut
    message: MessageOut
    delivered: bool
    detail: str | None = None


class MessengerImportOut(BaseModel):
    page_id: str
    threads_seen: int
    skipped_threads: int
    customers_created: int
    conversations_created: int
    messages_created: int
    imported_names: list[str]


class MessengerPsidImportIn(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=20000,
        description="Linie: PSID albo „Imię | PSID”",
    )


@router.post("/import-messenger", response_model=MessengerImportOut)
async def import_messenger(
    db: DbSession,
    owner: CurrentOwner,
    limit: int = Query(50, ge=1, le=100),
) -> MessengerImportOut:
    """Ściągnij historyczne rozmowy Page Inbox z Meta Graph → Wiadomości."""
    try:
        result = await import_messenger_conversations(
            db,
            business_id=owner.business_id,
            limit_threads=max(1, min(limit, 100)),
        )
    except MetaImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    await hub.publish(
        owner.business_id,
        "chat.message",
        {"imported": True},
        title="Import Messenger",
        message=(
            f"Zaimportowano {result['conversations_created']} rozmów, "
            f"{result['messages_created']} wiadomości"
        ),
    )
    return MessengerImportOut(**result)


@router.post("/import-messenger-psids", response_model=MessengerImportOut)
async def import_messenger_psids_endpoint(
    body: MessengerPsidImportIn,
    db: DbSession,
    owner: CurrentOwner,
) -> MessengerImportOut:
    """Import bez pages_read_engagement — wklej PSID osób, które pisały do strony."""
    entries = parse_psid_lines(body.text)
    try:
        result = await import_messenger_psids(
            db,
            business_id=owner.business_id,
            entries=entries,
        )
    except MetaImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    await hub.publish(
        owner.business_id,
        "chat.message",
        {"imported": True, "mode": "psid"},
        title="Import PSID",
        message=f"Dodano {result['conversations_created']} rozmów z PSID",
    )
    return MessengerImportOut(**result)


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
    "/start",
    response_model=StartConversationOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_conversation(
    body: StartConversationIn,
    db: DbSession,
    owner: CurrentOwner,
) -> StartConversationOut:
    """Start (or reuse) a thread and send an owner message — no prior chat required.

    For Messenger/Instagram the customer must have a PSID in external_ids
    (from a previous page interaction or entered manually).
    """
    if body.channel not in {
        Channel.messenger,
        Channel.instagram,
        Channel.telegram,
        Channel.widget,
    }:
        raise HTTPException(
            status_code=400,
            detail="Kanał nieobsługiwany do ręcznego startu rozmowy",
        )

    customer = await db.get(Customer, body.customer_id)
    if customer is None or customer.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Klient nie znaleziony")

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Pusta wiadomość")

    ext = dict(customer.external_ids or {})
    thread_id = str(ext.get(body.channel.value) or "").strip()
    if not thread_id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Brak ID kanału „{body.channel.value}” u klienta. "
                "Dodaj Messenger PSID (lub ID Instagrama/Telegrama) w karcie klienta."
            ),
        )

    # Reuse existing conversation for this customer+channel+thread if present
    existing = await db.execute(
        select(Conversation)
        .where(
            Conversation.customer_id == customer.id,
            Conversation.channel == body.channel,
            Conversation.external_thread_id == thread_id,
        )
        .options(
            selectinload(Conversation.customer),
            selectinload(Conversation.messages),
        )
    )
    conv = existing.scalar_one_or_none()
    if conv is None:
        conv = Conversation(
            customer_id=customer.id,
            channel=body.channel,
            external_thread_id=thread_id,
            state=ConversationState.idle,
            context={},
        )
        db.add(conv)
        await db.flush()
        await db.refresh(conv)

    msg = Message(
        conversation_id=conv.id,
        role=MessageRole.owner,
        content=text,
        raw_payload={"source": "admin_outreach"},
    )
    db.add(msg)
    conv.updated_at = utc_now()
    await db.flush()
    await db.refresh(msg)

    outbound = OutboundMessage(
        channel=body.channel,
        external_thread_id=thread_id,
        text=text,
        metadata={"proactive": True},
    )
    delivered = False
    detail: str | None = None
    if body.channel in {Channel.messenger, Channel.instagram}:
        adapter = MetaAdapter(business_id=owner.business_id)
        delivered = await adapter.send_proactive(outbound)
        if not delivered:
            detail = (
                outbound.metadata.get("meta_error")
                or "Meta nie przyjęła wiadomości (sprawdź PSID, token strony "
                "i okno wiadomości HUMAN_AGENT — klient musiał kiedyś napisać do fanpage)."
            )
    elif body.channel == Channel.telegram:
        delivered = await TelegramAdapter(
            business_id=owner.business_id
        ).send_outbound(outbound)
        if not delivered:
            detail = "Nie udało się wysłać na Telegram"
    elif body.channel == Channel.widget:
        delivered = await WidgetAdapter(
            business_id=owner.business_id
        ).send_outbound(outbound)
        if not delivered:
            detail = "Widget nie jest podłączony do aktywnej sesji"

    await hub.publish(
        owner.business_id,
        "chat.message",
        {
            "conversation_id": str(conv.id),
            "role": "owner",
            "channel": body.channel.value,
            "proactive": True,
        },
        title="Wiadomość do klienta",
        message=text[:120],
    )

    # Reload conversation with customer for response shape
    conv = await _get_owned_conversation(db, owner.business_id, conv.id)
    last = msg
    conversation_out = ConversationOut(
        id=conv.id,
        customer_id=conv.customer_id,
        customer_name=conv.customer.name if conv.customer else None,
        channel=conv.channel,
        state=conv.state,
        external_thread_id=conv.external_thread_id,
        updated_at=conv.updated_at,
        last_message=last.content,
        last_role=last.role,
    )
    return StartConversationOut(
        conversation=conversation_out,
        message=MessageOut(
            id=msg.id,
            conversation_id=msg.conversation_id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at,
        ),
        delivered=delivered,
        detail=detail,
    )


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
