"""Admin WebSocket — live events for toasts / inbox refresh."""

from __future__ import annotations

from uuid import UUID

import jwt
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.models import Owner
from app.services.events import hub

router = APIRouter(tags=["realtime"])


async def _owner_from_token(token: str) -> Owner | None:
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email = data.get("sub")
        if not email:
            return None
    except InvalidTokenError:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Owner).where(Owner.email == email))
        return result.scalar_one_or_none()


@router.websocket("/ws/events")
async def events_ws(websocket: WebSocket, token: str = Query(...)) -> None:
    owner = await _owner_from_token(token)
    if owner is None:
        await websocket.close(code=4401)
        return

    business_id: UUID = owner.business_id
    await hub.connect(business_id, websocket)
    try:
        await websocket.send_json(
            {
                "type": "connected",
                "title": "Połączono",
                "message": "Powiadomienia na żywo włączone",
                "payload": {"business_id": str(business_id)},
            }
        )
        while True:
            # Keep-alive / ignore client pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(business_id, websocket)
