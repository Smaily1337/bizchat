"""Public analytics endpoints (landing pageviews)."""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict
from threading import Lock

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DbSession
from app.models import PageView

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Simple in-memory rate limit: max N hits per IP per window.
_RATE_LIMIT = 60
_RATE_WINDOW_SEC = 60
_hits: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


class PageViewIn(BaseModel):
    path: str = Field(default="/", max_length=512)
    referrer: str | None = Field(default=None, max_length=1024)
    session_id: str | None = Field(default=None, max_length=64)


class PageViewAck(BaseModel):
    ok: bool = True


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    with _lock:
        bucket = _hits[ip]
        cutoff = now - _RATE_WINDOW_SEC
        _hits[ip] = [t for t in bucket if t >= cutoff]
        if len(_hits[ip]) >= _RATE_LIMIT:
            return True
        _hits[ip].append(now)
        return False


@router.post(
    "/pageview",
    response_model=PageViewAck,
    status_code=status.HTTP_202_ACCEPTED,
)
async def record_pageview(
    body: PageViewIn,
    request: Request,
    db: DbSession,
) -> PageViewAck:
    ip = _client_ip(request)
    if _rate_limited(ip):
        # Soft-ack to avoid leaking rate-limit details to scrapers
        return PageViewAck(ok=True)

    path = (body.path or "/").strip()[:512] or "/"
    referrer = (body.referrer or "").strip()[:1024] or None
    session_id = (body.session_id or "").strip()[:64] or None
    ua = (request.headers.get("user-agent") or "")[:512] or None
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:32]

    try:
        db.add(
            PageView(
                path=path,
                referrer=referrer,
                user_agent=ua,
                session_id=session_id,
                ip_hash=ip_hash,
            )
        )
        await db.flush()
    except SQLAlchemyError:
        # Never break the landing UX
        return PageViewAck(ok=True)

    return PageViewAck(ok=True)
