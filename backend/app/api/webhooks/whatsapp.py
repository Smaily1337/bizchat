"""WhatsApp Cloud API webhooks."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.api.deps import DbSession
from app.bot.adapters.whatsapp import WhatsAppAdapter
from app.bot.engine import CoreBotEngine
from app.config import settings
from app.services import appointment_actions

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
    resolved = business_id
    if resolved is None and settings.meta_default_business_id:
        try:
            resolved = UUID(settings.meta_default_business_id)
        except ValueError:
            resolved = None

    adapter = WhatsAppAdapter(business_id=resolved)
    engine = CoreBotEngine(db, adapter)
    inbound_list = adapter.to_inbound(payload)
    handled = 0
    for inbound in inbound_list:
        if await appointment_actions.try_handle_payload(db, inbound.text, inbound):
            handled += 1
            continue
        await engine.handle(inbound)
        handled += 1
    return {"ok": True, "handled": handled}
