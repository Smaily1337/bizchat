"""In-memory realtime event bus for admin WebSocket clients."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class EventHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, business_id: UUID | str, ws: WebSocket) -> None:
        key = str(business_id)
        await ws.accept()
        async with self._lock:
            self._rooms.setdefault(key, set()).add(ws)
        logger.debug("WS connected business=%s clients=%s", key, len(self._rooms[key]))

    async def disconnect(self, business_id: UUID | str, ws: WebSocket) -> None:
        key = str(business_id)
        async with self._lock:
            clients = self._rooms.get(key)
            if not clients:
                return
            clients.discard(ws)
            if not clients:
                self._rooms.pop(key, None)

    async def publish(
        self,
        business_id: UUID | str,
        event_type: str,
        payload: dict[str, Any] | None = None,
        *,
        title: str | None = None,
        message: str | None = None,
    ) -> None:
        key = str(business_id)
        event = {
            "type": event_type,
            "title": title or event_type,
            "message": message or "",
            "payload": payload or {},
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        raw = json.dumps(event, default=str)
        async with self._lock:
            clients = list(self._rooms.get(key, set()))
        dead: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(key, ws)


hub = EventHub()
