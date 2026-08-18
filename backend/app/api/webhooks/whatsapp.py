"""WhatsApp Cloud API webhooks."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.api.deps import DbSession
from app.bot.adapters.whatsapp import WhatsAppAdapter
from app.bot.engine import CoreBotEngine
from app.config import settings
from app.services import appointment_actions
from app.services.webhook_business import resolve_meta_business_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"])


@router.get("")
async def whatsapp_verify(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
) -> Response:
    expected = settings.whatsapp_verify_token or settings.meta_verify_token
    if hub_mode == "subscribe" and hub_verify_token == expected and hub_challenge:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("")
async def whatsapp_webhook(
    request: Request,
    db: DbSession,
    business_id: UUID | None = Query(None),
) -> dict:
    payload = await request.json()
    resolved = await resolve_meta_business_id(
        db,
        query_business_id=business_id,
        page_id=None,
    )
    if resolved is None:
        logger.error("WhatsApp webhook dropped: no business_id")
        return {
            "ok": False,
            "error": "business_id_missing",
            "hint": "Add ?business_id=<salon-uuid> to the WhatsApp callback URL",
        }

    adapter = WhatsAppAdapter(business_id=resolved)
    engine = CoreBotEngine(db, adapter)
    inbound_list = adapter.to_inbound(payload)
    handled = 0
    for inbound in inbound_list:
        try:
            if await appointment_actions.try_handle_payload(db, inbound.text, inbound):
                await engine.persist_inbound_only(inbound)
                handled += 1
                continue
            await engine.handle(inbound)
            handled += 1
        except Exception:  # noqa: BLE001
            logger.exception(
                "WhatsApp inbound failed user=%s",
                inbound.external_user_id,
            )
    return {"ok": True, "handled": handled, "business_id": str(resolved)}
