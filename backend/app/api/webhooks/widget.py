"""WWW widget webhook — session/JWT stub."""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import DbSession
from app.bot.adapters.widget import WidgetAdapter
from app.bot.engine import CoreBotEngine
from app.schemas import WidgetMessageRequest, WidgetMessageResponse

router = APIRouter(prefix="/webhooks/widget", tags=["webhooks"])


class WidgetSessionRequest(BaseModel):
    business_id: UUID
    name: str | None = None


class WidgetSessionResponse(BaseModel):
    session_token: str
    session_id: str


@router.post("/session", response_model=WidgetSessionResponse)
async def create_widget_session(
    body: WidgetSessionRequest, db: DbSession
) -> WidgetSessionResponse:
    from app.models import Business

    biz = await db.get(Business, body.business_id)
    if biz is None:
        raise HTTPException(status_code=404, detail="Salon nie znaleziony")
    session_id = str(uuid4())
    token = WidgetAdapter.create_session_token(
        business_id=body.business_id,
        session_id=session_id,
        name=body.name,
    )
    return WidgetSessionResponse(session_token=token, session_id=session_id)


@router.post("", response_model=WidgetMessageResponse)
async def widget_message(
    db: DbSession,
    body: WidgetMessageRequest,
) -> WidgetMessageResponse:
    try:
        session = WidgetAdapter.decode_session_token(body.session_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    token_business = session.get("business_id")
    if token_business and str(body.business_id) != str(token_business):
        raise HTTPException(status_code=403, detail="business_id mismatch")

    adapter = WidgetAdapter(business_id=body.business_id)
    payload = {
        "text": body.text,
        "business_id": str(body.business_id),
        "session": session,
        "external_thread_id": session.get("sub"),
    }
    inbound_list = adapter.to_inbound(payload)
    if not inbound_list:
        raise HTTPException(status_code=400, detail="Empty message")

    engine = CoreBotEngine(db, adapter)
    outbound = await engine.handle(inbound_list[0])
    return WidgetMessageResponse(
        reply=outbound.text,
        session_token=body.session_token,
    )
