"""Meta (Messenger / Instagram) webhooks."""

from __future__ import annotations

import hashlib
import hmac
import json
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response

from app.api.deps import DbSession
from app.bot.adapters.meta import MetaAdapter
from app.bot.engine import CoreBotEngine
from app.config import settings

router = APIRouter(prefix="/webhooks/meta", tags=["webhooks"])


@router.get("")
async def meta_verify(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
) -> Response:
    if (
        hub_mode == "subscribe"
        and hub_verify_token == settings.meta_verify_token
        and hub_challenge is not None
    ):
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("")
async def meta_webhook(
    request: Request,
    db: DbSession,
    business_id: UUID | None = Query(None),
    x_hub_signature_256: str | None = Header(None),
) -> dict:
    body = await request.body()

    if settings.meta_app_secret:
        if not x_hub_signature_256 or not x_hub_signature_256.startswith("sha256="):
            raise HTTPException(status_code=403, detail="Missing signature")
        expected = hmac.new(
            settings.meta_app_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(f"sha256={expected}", x_hub_signature_256):
            raise HTTPException(status_code=403, detail="Invalid signature")

    payload = json.loads(body)
    adapter = MetaAdapter(business_id=business_id)
    engine = CoreBotEngine(db, adapter)

    inbound_list = adapter.to_inbound(payload)
    for inbound in inbound_list:
        await engine.handle(inbound)

    return {"ok": True, "handled": len(inbound_list)}
