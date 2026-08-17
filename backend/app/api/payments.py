"""Payment HTTP endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.api.deps import DbSession
from app.services import payments as payments_service

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/mock-pay")
async def mock_pay(session_id: str, db: DbSession) -> dict:
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
async def stripe_webhook(request: Request, db: DbSession) -> dict:
    payload = await request.json()
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
