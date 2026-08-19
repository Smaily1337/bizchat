"""
Verify Clerk session JWTs in FastAPI.

Install:
  pip install fastapi uvicorn PyJWT[crypto] httpx

Env:
  CLERK_JWKS_URL=https://<your-clerk-frontend-api>/.well-known/jwks.json
  # Or derive from publishable key instance — Dashboard → API Keys → JWT / JWKS
  CLERK_ISSUER=https://<your-clerk-frontend-api>
  CLERK_AUTHORIZED_PARTIES=http://localhost:3000,https://your-app.com

Frontend sends:
  Authorization: Bearer <clerk_session_jwt>
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx
import jwt
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

app = FastAPI(title="Clerk + FastAPI example")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLERK_JWKS_URL = os.environ["CLERK_JWKS_URL"]
CLERK_ISSUER = os.environ["CLERK_ISSUER"]
AUTHORIZED_PARTIES = [
    p.strip()
    for p in os.getenv("CLERK_AUTHORIZED_PARTIES", "http://localhost:3000").split(",")
    if p.strip()
]

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
                "verify_aud": False,  # Clerk session tokens often omit aud
            },
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc

    # Optional azp (authorized party) check — recommended for SPAs
    azp = payload.get("azp")
    if azp and AUTHORIZED_PARTIES and azp not in AUTHORIZED_PARTIES:
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
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me")
async def me(claims: dict[str, Any] = Depends(require_clerk_user)) -> dict[str, Any]:
    """Protected route — mirrors what the Next.js dashboard demo calls."""
    return {
        "sub": claims.get("sub"),
        "sid": claims.get("sid"),
        "azp": claims.get("azp"),
        "claims": {k: claims[k] for k in ("sub", "sid", "azp", "exp") if k in claims},
    }


# Optional: fetch rich user profile from Clerk Backend API with the secret key
async def fetch_clerk_user(user_id: str) -> dict[str, Any]:
    secret = os.environ["CLERK_SECRET_KEY"]
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret}"},
        )
        res.raise_for_status()
        return res.json()
