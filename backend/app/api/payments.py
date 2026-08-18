"""Payment HTTP endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Request

from app.api.deps import DbSession
from app.config import settings
from app.services import payments as payments_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/mock-pay")
async def mock_pay(session_id: str, db: DbSession) -> dict:
    if settings.environment.lower() in {"production", "prod"} and not settings.debug:
        raise HTTPException(
            status_code=404,
            detail="Mock pay wyłączony w produkcji",
        )
    if not session_id.startswith("mock_"):
        raise HTTPException(status_code=400, detail="Nieprawidłowa sesja mock")
    appt = await payments_service.find_by_session(db, session_id)
    if appt is None:
        raise HTTPException(status_code=404, detail="Sesja nieznana")
    await payments_service.mark_paid(db, appt)
    return {
        "ok": True,
        "appointment_id": str(appt.id),
        "status": appt.status.value,
        "deposit_status": appt.deposit_status,
        "message": "Zaliczka (mock) oznaczona jako opłacona.",
    }


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    db: DbSession,
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
) -> dict:
    body = await request.body()
    secret = (settings.stripe_webhook_secret or "").strip()
    if secret:
        # Prefer stripe lib when installed; otherwise require presence of signature header
        try:
            import stripe  # type: ignore

            stripe.Webhook.construct_event(body, stripe_signature or "", secret)
        except ImportError:
            if not stripe_signature:
                raise HTTPException(status_code=400, detail="Missing Stripe-Signature")
            logger.warning(
                "stripe package missing — accepting webhook with signature header present"
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Stripe signature verify failed: %s", exc)
            raise HTTPException(status_code=400, detail="Invalid Stripe signature") from exc

    import json

    payload = json.loads(body.decode() or "{}")
    event_type = payload.get("type")
    if event_type != "checkout.session.completed":
        return {"ok": True, "ignored": event_type}
    session = payload.get("data", {}).get("object") or {}
    appt_id = (session.get("metadata") or {}).get("appointment_id")
    session_id = session.get("id")
    appt = None
    if appt_id:
        appt = await payments_service.find_by_id(db, appt_id)
    if appt is None and session_id:
        appt = await payments_service.find_by_session(db, session_id)
    if appt is None:
        return {"ok": False, "detail": "appointment not found"}
    await payments_service.mark_paid(db, appt)
    return {"ok": True}
