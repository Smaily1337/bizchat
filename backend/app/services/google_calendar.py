"""Google Calendar sync — real when credentials present, otherwise clear stub."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

import httpx

from app.config import settings

if TYPE_CHECKING:
    from app.models import Appointment

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"


def _credentials_ready() -> bool:
    if not settings.google_calendar_enabled:
        return False
    if settings.google_service_account_json and Path(settings.google_service_account_json).exists():
        return True
    if settings.google_refresh_token and settings.google_client_id and settings.google_client_secret:
        return True
    return False


async def _access_token() -> str | None:
    """OAuth refresh-token flow (recommended for single-salon installs)."""
    if not (
        settings.google_refresh_token
        and settings.google_client_id
        and settings.google_client_secret
    ):
        return None
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": settings.google_refresh_token,
                "grant_type": "refresh_token",
            },
        )
        if resp.status_code >= 400:
            logger.warning("GCal token refresh failed: %s", resp.text[:200])
            return None
        return resp.json().get("access_token")


def _service_account_jwt_bearer() -> str | None:
    """Optional service-account path via google-auth if installed; else skip."""
    path = settings.google_service_account_json
    if not path or not Path(path).exists():
        return None
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account

        creds = service_account.Credentials.from_service_account_file(
            path,
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        creds.refresh(Request())
        return creds.token
    except Exception as exc:  # noqa: BLE001
        logger.warning("GCal service account unavailable: %s", exc)
        return None


async def _auth_headers() -> dict[str, str] | None:
    token = await _access_token()
    if not token:
        token = _service_account_jwt_bearer()
    if not token:
        return None
    return {"Authorization": f"Bearer {token}"}


def _event_body(appointment: Appointment) -> dict[str, Any]:
    summary = f"BizChat wizyta {appointment.id}"
    return {
        "summary": summary,
        "description": appointment.notes or "",
        "start": {"dateTime": appointment.start_at.isoformat()},
        "end": {"dateTime": appointment.end_at.isoformat()},
    }


def _calendar_id(appointment: Appointment) -> str:
    return settings.google_calendar_id or "primary"


async def create_event(appointment: Appointment) -> str | None:
    if not settings.google_calendar_enabled:
        logger.debug("GCal disabled: skip create for %s", appointment.id)
        return None
    if not _credentials_ready():
        logger.info(
            "GCal enabled but credentials missing — stub id for %s. "
            "Set GOOGLE_REFRESH_TOKEN (+ client id/secret) or GOOGLE_SERVICE_ACCOUNT_JSON.",
            appointment.id,
        )
        return f"stub-gcal-{appointment.id}"

    headers = await _auth_headers()
    if not headers:
        return f"stub-gcal-{appointment.id}"

    cal = _calendar_id(appointment)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GOOGLE_EVENTS_URL.format(calendar_id=cal),
            headers=headers,
            json=_event_body(appointment),
        )
        if resp.status_code >= 400:
            logger.warning("GCal create failed: %s", resp.text[:300])
            return None
        return resp.json().get("id")


async def update_event(appointment: Appointment) -> None:
    if not settings.google_calendar_enabled or not appointment.gcal_event_id:
        return
    if appointment.gcal_event_id.startswith("stub-gcal-"):
        return
    if not _credentials_ready():
        return
    headers = await _auth_headers()
    if not headers:
        return
    cal = _calendar_id(appointment)
    url = GOOGLE_EVENTS_URL.format(calendar_id=cal) + f"/{appointment.gcal_event_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.patch(url, headers=headers, json=_event_body(appointment))
        if resp.status_code >= 400:
            logger.warning("GCal update failed: %s", resp.text[:300])


async def delete_event(appointment: Appointment) -> None:
    if not settings.google_calendar_enabled or not appointment.gcal_event_id:
        return
    if appointment.gcal_event_id.startswith("stub-gcal-"):
        return
    if not _credentials_ready():
        return
    headers = await _auth_headers()
    if not headers:
        return
    cal = _calendar_id(appointment)
    url = GOOGLE_EVENTS_URL.format(calendar_id=cal) + f"/{appointment.gcal_event_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.delete(url, headers=headers)
        if resp.status_code >= 400 and resp.status_code != 404:
            logger.warning("GCal delete failed: %s", resp.text[:300])
