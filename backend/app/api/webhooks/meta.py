"""Meta (Messenger / Instagram) webhooks."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response

from app.api.deps import DbSession
from app.bot.adapters.meta import MetaAdapter, fetch_messenger_profile_name
from app.bot.engine import CoreBotEngine
from app.config import settings
from app.services import appointment_actions
from app.services.webhook_business import remember_meta_page_id, resolve_meta_business_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/meta", tags=["webhooks"])


def _first_page_id(payload: dict) -> str | None:
    for entry in payload.get("entry") or []:
        pid = entry.get("id")
        if pid:
            return str(pid)
    return None


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
    elif settings.environment.lower() in {"production", "prod"}:
        raise HTTPException(
            status_code=403,
            detail="META_APP_SECRET required in production",
        )

    payload = json.loads(body)
    page_id = _first_page_id(payload)
    resolved_business_id = await resolve_meta_business_id(
        db,
        query_business_id=business_id,
        page_id=page_id,
    )
    if resolved_business_id is None:
        logger.error(
            "Meta webhook dropped: no business_id. "
            "Set callback URL with ?business_id=<uuid> or META_DEFAULT_BUSINESS_ID. "
            "page_id=%s",
            page_id,
        )
        # 200 so Meta does not disable the subscription while we fix config
        return {
            "ok": False,
            "error": "business_id_missing",
            "hint": "Add ?business_id=<salon-uuid> to the Meta callback URL",
        }

    await remember_meta_page_id(db, resolved_business_id, page_id)

    adapter = MetaAdapter(business_id=resolved_business_id)
    engine = CoreBotEngine(db, adapter)

    inbound_list = adapter.to_inbound(payload)
    if not inbound_list:
        logger.info(
            "Meta webhook: no inbound messages parsed (echo/delivery/read?). page_id=%s",
            page_id,
        )
        return {"ok": True, "handled": 0}

    handled = 0
    for inbound in inbound_list:
        try:
            if not inbound.display_name and inbound.external_user_id:
                inbound.display_name = await fetch_messenger_profile_name(
                    inbound.external_user_id, await adapter._get_page_token()
                )
            if await appointment_actions.try_handle_payload(db, inbound.text, inbound):
                # Still show confirm/cancel taps in Inbox
                await engine.persist_inbound_only(inbound)
                handled += 1
                continue
            await engine.handle(inbound)
            handled += 1
        except Exception:  # noqa: BLE001
            logger.exception(
                "Meta inbound failed user=%s text=%r",
                inbound.external_user_id,
                (inbound.text or "")[:80],
            )

    return {"ok": True, "handled": handled, "business_id": str(resolved_business_id)}
