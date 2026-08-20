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


async def _graph_request(
    url: str,
    params: dict[str, Any] | None = None,
    token: str | None = None,
) -> dict[str, Any]:
    tok = token or settings.meta_page_access_token
    if not tok:
        raise MetaImportError(
            "Brak aktywnego tokena Meta — połącz stronę z Facebookiem przed importem.",
            code="missing_token",
        )
    query = dict(params or {})
    if "access_token" not in query and "access_token=" not in url:
        query["access_token"] = tok
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, params=query or None)
        data = resp.json() if resp.content else {}
        if resp.is_error:
            err_obj = data.get("error") or {}
            err = err_obj.get("message") or resp.text[:300]
            logger.error("Meta Graph failed url=%s err=%s", url[:120], err)
            raise MetaImportError(_friendly_graph_error(err), code=_graph_error_code(err))
        return data if isinstance(data, dict) else {}


PERMISSION_HINT = (
    "Meta wymaga uprawnienia pages_read_engagement do odczytu historii rozmów. "
    "Upewnij się, że podczas łączenia z Facebookiem zaznaczono wszystkie uprawnienia do strony."
)


def _graph_error_code(err: str) -> str:
    low = err.lower()
    if "pages_read_engagement" in low or "page public content" in low:
        return "missing_pages_read_engagement"
    if "permission" in low:
        return "missing_permission"
    return "graph_error"


def _friendly_graph_error(err: str) -> str:
    if _graph_error_code(err) == "missing_pages_read_engagement":
        return PERMISSION_HINT
    return f"Meta Graph API: {err}"


async def _page_id(token: str | None = None) -> str:
    me = await _graph_request(f"{GRAPH}/me", {"fields": "id,name"}, token=token)
    pid = str(me.get("id") or "").strip()
    if not pid:
        raise MetaImportError("Nie udało się odczytać ID strony z tokenu Meta.")
    return pid


async def _iter_conversations(
    limit_threads: int = 50,
    token: str | None = None,
    page_id: str | None = None,
) -> list[dict[str, Any]]:
    fields = (
        "id,updated_time,"
        "participants{name,email,id},"
        "messages.limit(40){id,message,from,created_time}"
    )
    pid = page_id or await _page_id(token=token)
    last_error: MetaImportError | None = None
    for root in (f"{GRAPH}/{pid}/conversations", f"{GRAPH}/me/conversations"):
        try:
            return await _paginate_conversations(root, fields, limit_threads, token=token)
        except MetaImportError as exc:
            if exc.code == "missing_pages_read_engagement":
                raise
            last_error = exc
            logger.info("Conversations via %s failed: %s", root, exc)
    if last_error:
        raise last_error
    raise MetaImportError("Nie udało się pobrać rozmów z Meta.")


async def _paginate_conversations(
    start_url: str,
    fields: str,
    limit_threads: int,
    token: str | None = None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    url = start_url
    params: dict[str, Any] | None = {
        "platform": "messenger",
        "fields": fields,
        "limit": min(25, limit_threads),
    }
    while url and len(out) < limit_threads:
        data = await _graph_request(url, params, token=token)
        batch = data.get("data") or []
        if not isinstance(batch, list):
            break
        out.extend(batch)
        next_url = (data.get("paging") or {}).get("next")
        if not next_url:
            break
        url = str(next_url)
        params = None
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
    from app.models import Business
    business = await db.get(Business, business_id)
    token = None
    configured_page_id = None
    if business and business.settings:
        token = business.settings.get("meta_page_access_token")
        configured_page_id = business.settings.get("meta_page_id")
    token = token or settings.meta_page_access_token
    if not token:
        raise MetaImportError(
            "Brak aktywnego połączenia ze stroną Facebook. Połącz fanpage z Meta przed synchronizacją historii.",
            code="missing_token",
        )

    page_id = configured_page_id or await _page_id(token=token)
    threads = await _iter_conversations(limit_threads=limit_threads, token=token, page_id=page_id)

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


def parse_psid_lines(raw: str) -> list[tuple[str, str | None]]:
    """Parse lines: `PSID`, `Name | PSID`, `PSID Name`, `name,psid`."""
    rows: list[tuple[str, str | None]] = []
    seen: set[str] = set()
    for line in (raw or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name: str | None = None
        psid = ""
        if "|" in line:
            left, right = [p.strip() for p in line.split("|", 1)]
            if left.isdigit():
                psid, name = left, right or None
            else:
                name, psid = left, right
        elif "," in line:
            left, right = [p.strip() for p in line.split(",", 1)]
            if left.isdigit():
                psid, name = left, right or None
            else:
                name, psid = left, right
        else:
            parts = line.split()
            if len(parts) == 1:
                psid = parts[0]
            elif parts[0].isdigit():
                psid = parts[0]
                name = " ".join(parts[1:]) or None
            elif parts[-1].isdigit():
                psid = parts[-1]
                name = " ".join(parts[:-1]) or None
            else:
                continue
        psid = "".join(ch for ch in psid if ch.isdigit())
        if len(psid) < 5 or psid in seen:
            continue
        seen.add(psid)
        rows.append((psid, name))
    return rows


async def import_messenger_psids(
    db: AsyncSession,
    *,
    business_id: UUID,
    entries: list[tuple[str, str | None]],
) -> dict[str, Any]:
    """Create Inbox threads for known PSIDs without reading Meta history."""
    if not entries:
        raise MetaImportError(
            "Wklej co najmniej jeden PSID (np. z logów webhooka lub Meta).",
            code="empty_psids",
        )

    created_customers = 0
    created_conversations = 0
    created_messages = 0
    imported_names: list[str] = []

    for psid, name in entries:
        display = name
        if not display and settings.meta_page_access_token:
            try:
                display = await fetch_messenger_profile_name(psid)
            except Exception:  # noqa: BLE001
                display = None

        customer, is_new_c = await _get_or_create_customer(
            db, business_id=business_id, psid=psid, name=display
        )
        if is_new_c:
            created_customers += 1

        conversation, is_new_conv = await _get_or_create_conversation(
            db, customer_id=customer.id, psid=psid
        )
        if is_new_conv:
            created_conversations += 1
            # Placeholder so the thread is visible in Inbox
            db.add(
                Message(
                    conversation_id=conversation.id,
                    role=MessageRole.customer,
                    content="[zaimportowano z PSID — napisz, by wznowić rozmowę]",
                    raw_payload={"source": "psid_import", "psid": psid},
                )
            )
            created_messages += 1
            conversation.updated_at = utc_now()
            imported_names.append(customer.name or psid)
        elif is_new_c:
            imported_names.append(customer.name or psid)

    await db.flush()
    return {
        "page_id": "",
        "threads_seen": len(entries),
        "skipped_threads": 0,
        "customers_created": created_customers,
        "conversations_created": created_conversations,
        "messages_created": created_messages,
        "imported_names": imported_names[:30],
    }
