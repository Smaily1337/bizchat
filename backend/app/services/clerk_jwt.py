"""Verify Clerk session JWTs (JWKS) and load user profile via Clerk Backend API."""

from __future__ import annotations

import base64
import logging
from functools import lru_cache
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

from app.config import settings

logger = logging.getLogger(__name__)


def clerk_configured() -> bool:
    return bool(
        (settings.clerk_secret_key or "").strip()
        and (
            (settings.clerk_issuer or "").strip()
            or (settings.clerk_publishable_key or "").strip()
        )
    )


def _issuer_from_publishable_key(pk: str) -> str | None:
    if not pk or "_" not in pk:
        return None
    raw = pk.split("_", 2)[-1]
    pad = "=" * (-len(raw) % 4)
    try:
        host = base64.b64decode(raw + pad).decode("utf-8", errors="ignore").strip()
    except Exception:
        return None
    host = host.rstrip("$").strip()
    if not host:
        return None
    if host.startswith("http"):
        return host.rstrip("/")
    return f"https://{host}"


def resolve_issuer() -> str:
    issuer = (settings.clerk_issuer or "").rstrip("/")
    if issuer:
        return issuer
    inferred = _issuer_from_publishable_key(settings.clerk_publishable_key or "")
    if not inferred:
        raise ValueError("CLERK_ISSUER or CLERK_PUBLISHABLE_KEY required")
    return inferred


def resolve_jwks_url() -> str:
    if settings.clerk_jwks_url:
        return settings.clerk_jwks_url.strip()
    return f"{resolve_issuer()}/.well-known/jwks.json"


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(resolve_jwks_url(), cache_keys=True)


def verify_clerk_session_token(token: str) -> dict[str, Any]:
    """Validate Clerk session JWT; returns claims (sub, sid, azp, …)."""
    try:
        key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            issuer=resolve_issuer(),
            options={"require": ["exp", "iss", "sub"], "verify_aud": False},
        )
    except InvalidTokenError as exc:
        raise ValueError(f"Invalid Clerk token: {exc}") from exc


async def fetch_clerk_user(user_id: str) -> dict[str, Any]:
    secret = (settings.clerk_secret_key or "").strip()
    if not secret:
        raise ValueError("CLERK_SECRET_KEY not set")
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret}"},
        )
        if res.status_code == 404:
            raise ValueError("Clerk user not found")
        res.raise_for_status()
        return res.json()


def primary_email_from_clerk_user(user: dict[str, Any]) -> str | None:
    primary_id = user.get("primary_email_address_id")
    emails = user.get("email_addresses") or []
    for item in emails:
        if primary_id and item.get("id") == primary_id:
            addr = (item.get("email_address") or "").strip().lower()
            if addr:
                return addr
    for item in emails:
        addr = (item.get("email_address") or "").strip().lower()
        if addr:
            return addr
    return None


def display_name_from_clerk_user(user: dict[str, Any]) -> str | None:
    first = (user.get("first_name") or "").strip()
    last = (user.get("last_name") or "").strip()
    name = f"{first} {last}".strip()
    if name:
        return name
    username = (user.get("username") or "").strip()
    return username or None
