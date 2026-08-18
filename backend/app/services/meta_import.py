"""Import historical Messenger threads from Meta Graph API into Inbox."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.bot.adapters.meta import fetch_messenger_profile_name
from app.config import settings
from app.models import Conversation, Customer, Message
from app.models.enums import Channel, ConversationState, MessageRole
from app.models.mixins import utc_now

logger = logging.getLogger(__name__)

GRAPH = "https://graph.facebook.com/v21.0"


class MetaImportError(Exception):
    def __init__(self, message: str, *, code: str = "meta_import_failed") -> None:
        super().__init__(message)
        self.code = code


def _parse_ts(raw: str | None) -> datetime:
    if not raw:
        return utc_now()
    try:
        fixed = raw.replace("+0000", "+00:00")
        dt = datetime.fromisoformat(fixed)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return utc_now()


async def _graph_request(url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    token = settings.meta_page_access_token
    if not token:
        raise MetaImportError(
            "Brak META_PAGE_ACCESS_TOKEN na API — ustaw token strony i zredeployuj.",
            code="missing_token",
        )
    query = dict(params or {})
    if "access_token" not in query and "access_token=" not in url:
        query["access_token"] = token
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, params=query or None)
        data = resp.json() if resp.content else {}
        if resp.is_error:
            err = (data.get("error") or {}).get("message") or resp.text[:300]
            logger.error("Meta Graph failed url=%s err=%s", url[:120], err)
            raise MetaImportError(f"Meta Graph API: {err}", code="graph_error")
        return data if isinstance(data, dict) else {}


async def _page_id() -> str:
    me = await _graph_request(f"{GRAPH}/me", {"fields": "id,name"})
    pid = str(me.get("id") or "").strip()
    if not pid:
        raise MetaImportError("Nie udało się odczytać ID strony z tokenu Meta.")
    return pid


async def _iter_conversations(limit_threads: int = 50) -> list[dict[str, Any]]:
    fields = (
        "id,updated_time,"
        "participants{name,email,id},"
        "messages.limit(40){id,message,from,created_time}"
    )
    out: list[dict[str, Any]] = []
    url = f"{GRAPH}/me/conversations"
    params: dict[str, Any] | None = {
        "platform": "messenger",
        "fields": fields,
        "limit": min(25, limit_threads),
    }
    while url and len(out) < limit_threads:
        data = await _graph_request(url, params)
        batch = data.get("data") or []
        if not isinstance(batch, list):
            break
        out.extend(batch)
        next_url = (data.get("paging") or {}).get("next")
        if not next_url:
            break
        url = str(next_url)
        params = None  # next URL already has query string
    return out[:limit_threads]


async def _find_customer_by_psid(
    db: AsyncSession, business_id: UUID, psid: str
) -> Customer | None:
    result = await db.execute(
        select(Customer).where(Customer.business_id == business_id)
    )
    for customer in result.scalars().all():
        ext = customer.external_ids or {}
        if ext.get("messenger") == psid:
            return customer
    return None


async def _get_or_create_customer(
    db: AsyncSession,
    *,
    business_id: UUID,
    psid: str,
    name: str | None,
) -> tuple[Customer, bool]:
    existing = await _find_customer_by_psid(db, business_id, psid)
    if existing:
        if name and (
            not existing.name
            or existing.name.strip().lower()
            in {"klient", "client", "user", "messenger"}
        ):
            existing.name = name
        return existing, False

    display = name
    if not display:
        display = await fetch_messenger_profile_name(psid)

    customer = Customer(
        business_id=business_id,
        name=display or f"Messenger {psid[-6:]}",
        external_ids={"messenger": psid},
    )
    db.add(customer)
    await db.flush()
    return customer, True


async def _get_or_create_conversation(
    db: AsyncSession, *, customer_id: UUID, psid: str
) -> tuple[Conversation, bool]:
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.customer_id == customer_id,
            Conversation.channel == Channel.messenger,
            Conversation.external_thread_id == psid,
        )
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if conv:
        return conv, False
    conv = Conversation(
        customer_id=customer_id,
        channel=Channel.messenger,
        external_thread_id=psid,
        state=ConversationState.idle,
        context={},
    )
    db.add(conv)
    await db.flush()
    # ensure messages collection
    result2 = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv.id)
        .options(selectinload(Conversation.messages))
    )
    return result2.scalar_one(), True


def _existing_meta_ids(conversation: Conversation) -> set[str]:
    ids: set[str] = set()
    for msg in conversation.messages or []:
        raw = msg.raw_payload or {}
        mid = raw.get("meta_message_id")
        if mid:
            ids.add(str(mid))
    return ids


async def import_messenger_conversations(
    db: AsyncSession,
    *,
    business_id: UUID,
    limit_threads: int = 50,
) -> dict[str, Any]:
    """Pull Page conversations from Meta and upsert into Inbox."""
    page_id = await _page_id()
    threads = await _iter_conversations(limit_threads=limit_threads)

    created_customers = 0
    created_conversations = 0
    created_messages = 0
    skipped_threads = 0
    imported_names: list[str] = []

    for thread in threads:
        participants = ((thread.get("participants") or {}).get("data")) or []
        user: dict[str, Any] | None = None
        for p in participants:
            pid = str(p.get("id") or "")
            if pid and pid != page_id:
                user = p
                break
        if not user:
            skipped_threads += 1
            continue

        psid = str(user.get("id") or "").strip()
        if not psid:
            skipped_threads += 1
            continue

        name = (user.get("name") or "").strip() or None
        customer, is_new_c = await _get_or_create_customer(
            db, business_id=business_id, psid=psid, name=name
        )
        if is_new_c:
            created_customers += 1
            imported_names.append(customer.name or psid)

        conversation, is_new_conv = await _get_or_create_conversation(
            db, customer_id=customer.id, psid=psid
        )
        if is_new_conv:
            created_conversations += 1
            if not is_new_c:
                imported_names.append(customer.name or psid)

        known = _existing_meta_ids(conversation)
        msg_data = ((thread.get("messages") or {}).get("data")) or []
        ordered = list(reversed(msg_data))
        latest_at: datetime | None = None
        for m in ordered:
            mid = str(m.get("id") or "").strip()
            if mid and mid in known:
                continue
            text = (m.get("message") or "").strip()
            if not text:
                text = "[załącznik / sticker]"
            from_id = str((m.get("from") or {}).get("id") or "")
            role = (
                MessageRole.customer
                if from_id and from_id != page_id
                else MessageRole.bot
            )
            created = _parse_ts(m.get("created_time"))
            msg = Message(
                conversation_id=conversation.id,
                role=role,
                content=text,
                raw_payload={
                    "source": "meta_import",
                    "meta_message_id": mid or None,
                    "from": m.get("from"),
                    "created_time": m.get("created_time"),
                },
            )
            msg.created_at = created
            db.add(msg)
            created_messages += 1
            if mid:
                known.add(mid)
            if latest_at is None or created > latest_at:
                latest_at = created

        if latest_at:
            conversation.updated_at = latest_at
        elif is_new_conv:
            conversation.updated_at = utc_now()

    await db.flush()
    return {
        "page_id": page_id,
        "threads_seen": len(threads),
        "skipped_threads": skipped_threads,
        "customers_created": created_customers,
        "conversations_created": created_conversations,
        "messages_created": created_messages,
        "imported_names": imported_names[:30],
    }
