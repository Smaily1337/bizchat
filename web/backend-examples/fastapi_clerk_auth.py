"""
Verify Clerk session JWTs in FastAPI.

Install:
  pip install fastapi uvicorn "PyJWT[crypto]" httpx python-dotenv

Run (from web/):
  ./start-api.sh
  # or:
  # source .env.local && uvicorn backend-examples.fastapi_clerk_auth:app --reload --host 0.0.0.0 --port 8000

Frontend sends:
  Authorization: Bearer <clerk_session_jwt>
"""

from __future__ import annotations

import base64
import os
import time
from pathlib import Path
from typing import Any

import httpx
import jwt
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

# Load web/.env.local when started from repo (does not override existing env)
_env_local = Path(__file__).resolve().parents[1] / ".env.local"
if _env_local.is_file():
    try:
        from dotenv import load_dotenv

        load_dotenv(_env_local, override=False)
    except ImportError:
        for line in _env_local.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def _issuer_from_publishable_key(pk: str) -> str | None:
    """Decode Frontend API host from pk_test_… / pk_live_… (Clerk convention)."""
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


def _resolve_clerk_urls() -> tuple[str, str]:
    issuer = (os.getenv("CLERK_ISSUER") or "").rstrip("/")
    jwks = (os.getenv("CLERK_JWKS_URL") or "").strip()
    if not issuer:
        inferred = _issuer_from_publishable_key(
            os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "")
            or os.getenv("CLERK_PUBLISHABLE_KEY", "")
        )
        if inferred:
            issuer = inferred
    if issuer and not jwks:
        jwks = f"{issuer}/.well-known/jwks.json"
    if not issuer or not jwks:
        raise RuntimeError(
            "Set CLERK_ISSUER + CLERK_JWKS_URL, or provide NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY "
            "in web/.env.local so issuer can be inferred."
        )
    return issuer, jwks


CLERK_ISSUER, CLERK_JWKS_URL = _resolve_clerk_urls()

AUTHORIZED_PARTIES = [
    p.strip()
    for p in os.getenv(
        "CLERK_AUTHORIZED_PARTIES",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if p.strip()
]

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]

app = FastAPI(title="Clerk + FastAPI example")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_jwks_client = PyJWKClient(CLERK_JWKS_URL, cache_keys=True)
_bearer = HTTPBearer(auto_error=True)


def verify_clerk_token(token: str) -> dict[str, Any]:
    """Validate Clerk JWT signature + claims via JWKS."""
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={
                "require": ["exp", "iss", "sub"],
                "verify_aud": False,
            },
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc

    azp = payload.get("azp")
    if azp and AUTHORIZED_PARTIES and azp not in AUTHORIZED_PARTIES:
        # Also accept any localhost / 127.0.0.1 port for local Next.js
        if not (
            azp.startswith("http://localhost:")
            or azp.startswith("http://127.0.0.1:")
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized party",
            )

    if payload.get("exp", 0) < time.time():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )

    return payload


async def require_clerk_user(
    creds: HTTPAuthorizationCredentials = Security(_bearer),
) -> dict[str, Any]:
    return verify_clerk_token(creds.credentials)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "clerk_issuer": CLERK_ISSUER,
    }


@app.get("/api/me")
async def me(claims: dict[str, Any] = Depends(require_clerk_user)) -> dict[str, Any]:
    """Protected route — mirrors what the Next.js dashboard demo calls."""
    return {
        "sub": claims.get("sub"),
        "sid": claims.get("sid"),
        "azp": claims.get("azp"),
        "claims": {k: claims[k] for k in ("sub", "sid", "azp", "exp") if k in claims},
    }


async def fetch_clerk_user(user_id: str) -> dict[str, Any]:
    secret = os.environ["CLERK_SECRET_KEY"]
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret}"},
        )
        res.raise_for_status()
        return res.json()
