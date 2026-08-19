"""Auth — login, rejestracja, weryfikacja e-mail, Google OAuth."""

from __future__ import annotations

import secrets
from typing import Annotated
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select

from app.api.deps import (
    CurrentOwner,
    DbSession,
    create_access_token,
    hash_password,
    verify_password,
)
from app.config import settings
from app.models import Business, Owner, UserRole
from app.schemas import LoginRequest, OwnerOut, TokenResponse
from app.services.mailer import send_verification_email
from app.services import clerk_jwt as clerk_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ValueError("Nieprawidłowy adres e-mail")
    return email


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)
    name: str | None = None
    business_name: str = Field(min_length=2, max_length=255)

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        return normalize_email(v)


class AuthConfigOut(BaseModel):
    google_oauth_enabled: bool
    clerk_enabled: bool = False
    registration_enabled: bool = True


class MessageOut(BaseModel):
    message: str


@router.get("/config", response_model=AuthConfigOut)
async def auth_config() -> AuthConfigOut:
    return AuthConfigOut(
        google_oauth_enabled=settings.google_oauth_configured,
        clerk_enabled=settings.clerk_configured,
    )


@router.post("/clerk", response_model=TokenResponse)
async def login_with_clerk(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> TokenResponse:
    """Exchange a Clerk session JWT for a BizChat access token.

    Frontend: Authorization: Bearer <clerk_jwt> after Clerk sign-in.
    """
    if not settings.clerk_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk nie jest skonfigurowany na API",
        )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Brak tokena Clerk",
        )
    raw = authorization.split(" ", 1)[1].strip()
    try:
        claims = clerk_service.verify_clerk_session_token(raw)
        clerk_user_id = str(claims.get("sub") or "")
        if not clerk_user_id:
            raise ValueError("missing sub")
        user = await clerk_service.fetch_clerk_user(clerk_user_id)
        email = clerk_service.primary_email_from_clerk_user(user)
        if not email:
            raise ValueError("Clerk user has no email")
        name = clerk_service.display_name_from_clerk_user(user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001 — surface Clerk API failures cleanly
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Nie udało się zweryfikować Clerka: {exc}",
        ) from exc

    result = await db.execute(select(Owner).where(Owner.email == email))
    owner = result.scalar_one_or_none()
    if owner is None:
        business = Business(
            id=uuid4(),
            name=(name or email.split("@")[0] or "Mój salon")[:255],
            timezone="Europe/Warsaw",
            settings={"locale": "pl", "currency": "PLN", "auth": "clerk"},
        )
        db.add(business)
        await db.flush()
        owner = Owner(
            email=email,
            password_hash="",
            name=name,
            role=UserRole.owner,
            email_verified=True,
            google_sub=f"clerk:{clerk_user_id}",
            business_id=business.id,
            is_active=True,
        )
        db.add(owner)
        await db.flush()
    elif not owner.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto jest nieaktywne",
        )
    else:
        # Link Clerk id if not set
        if not owner.google_sub:
            owner.google_sub = f"clerk:{clerk_user_id}"
        if not owner.email_verified:
            owner.email_verified = True
        if name and not owner.name:
            owner.name = name
        await db.flush()

    access = create_access_token(
        subject=owner.email, business_id=owner.business_id, role=owner.role
    )
    return TokenResponse(access_token=access)


@router.post("/login", response_model=TokenResponse)
async def login_form(
    db: DbSession,
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> TokenResponse:
    return await _authenticate(db, form_data.username, form_data.password)


@router.post("/login/json", response_model=TokenResponse)
async def login_json(db: DbSession, body: LoginRequest) -> TokenResponse:
    return await _authenticate(db, body.email, body.password)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(db: DbSession, body: RegisterRequest) -> TokenResponse:
    existing = await db.execute(select(Owner).where(Owner.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto z tym e-mailem już istnieje",
        )

    business = Business(
        id=uuid4(),
        name=body.business_name.strip(),
        timezone="Europe/Warsaw",
        settings={"locale": "pl", "currency": "PLN"},
    )
    db.add(business)
    await db.flush()

    token = secrets.token_urlsafe(32)
    owner = Owner(
        email=body.email.lower().strip(),
        password_hash=hash_password(body.password),
        name=(body.name or "").strip() or None,
        role=UserRole.owner,
        email_verified=False,
        email_verification_token=token,
        business_id=business.id,
        is_active=True,
    )
    db.add(owner)
    await db.flush()

    send_verification_email(to=owner.email, token=token)

    access = create_access_token(
        subject=owner.email, business_id=owner.business_id, role=owner.role
    )
    return TokenResponse(access_token=access)


@router.post("/verify-email", response_model=MessageOut)
async def verify_email(
    db: DbSession, token: str = Query(..., min_length=8)
) -> MessageOut:
    result = await db.execute(
        select(Owner).where(Owner.email_verification_token == token)
    )
    owner = result.scalar_one_or_none()
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy lub wygasły token weryfikacji",
        )
    owner.email_verified = True
    owner.email_verification_token = None
    await db.flush()
    return MessageOut(message="E-mail został potwierdzony")


@router.post("/resend-verification", response_model=MessageOut)
async def resend_verification(db: DbSession, owner: CurrentOwner) -> MessageOut:
    if owner.email_verified:
        return MessageOut(message="E-mail jest już potwierdzony")
    token = secrets.token_urlsafe(32)
    owner.email_verification_token = token
    await db.flush()
    send_verification_email(to=owner.email, token=token)
    return MessageOut(message="Wysłano ponownie link weryfikacyjny")


@router.get("/me", response_model=OwnerOut)
async def me(owner: CurrentOwner) -> Owner:
    return owner


@router.get("/google/start")
async def google_oauth_start() -> RedirectResponse:
    if not settings.google_oauth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth nie jest skonfigurowany",
        )
    redirect_uri = f"{settings.public_api_url.rstrip('/')}/api/auth/google/callback"
    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_oauth_callback(
    db: DbSession,
    code: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    frontend = settings.public_frontend_url.rstrip("/")
    if error or not code:
        return RedirectResponse(f"{frontend}/login?oauth_error=1")

    if not settings.google_oauth_configured:
        return RedirectResponse(f"{frontend}/login?oauth_error=1")

    redirect_uri = f"{settings.public_api_url.rstrip('/')}/api/auth/google/callback"
    async with httpx.AsyncClient(timeout=20) as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code >= 400:
            return RedirectResponse(f"{frontend}/login?oauth_error=1")
        tokens = token_res.json()
        access = tokens.get("access_token")
        if not access:
            return RedirectResponse(f"{frontend}/login?oauth_error=1")

        info_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access}"},
        )
        if info_res.status_code >= 400:
            return RedirectResponse(f"{frontend}/login?oauth_error=1")
        info = info_res.json()

    email = (info.get("email") or "").lower().strip()
    google_sub = info.get("sub")
    name = info.get("name")
    if not email or not google_sub:
        return RedirectResponse(f"{frontend}/login?oauth_error=1")

    result = await db.execute(
        select(Owner).where(or_(Owner.google_sub == google_sub, Owner.email == email))
    )
    owner = result.scalar_one_or_none()

    if owner is None:
        business = Business(
            id=uuid4(),
            name=f"Salon {name or email.split('@')[0]}",
            timezone="Europe/Warsaw",
            settings={"locale": "pl", "currency": "PLN"},
        )
        db.add(business)
        await db.flush()
        owner = Owner(
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            name=name,
            role=UserRole.owner,
            email_verified=bool(info.get("email_verified")),
            google_sub=google_sub,
            business_id=business.id,
            is_active=True,
        )
        db.add(owner)
        await db.flush()
    else:
        if not owner.is_active:
            return RedirectResponse(f"{frontend}/login?oauth_error=disabled")
        owner.google_sub = google_sub
        if info.get("email_verified"):
            owner.email_verified = True
        if name and not owner.name:
            owner.name = name
        await db.flush()

    jwt_token = create_access_token(
        subject=owner.email, business_id=owner.business_id, role=owner.role
    )
    return RedirectResponse(f"{frontend}/login#token={jwt_token}")


async def _authenticate(db: DbSession, email: str, password: str) -> TokenResponse:
    result = await db.execute(select(Owner).where(Owner.email == email.lower().strip()))
    owner = result.scalar_one_or_none()
    if (
        owner is None
        or not owner.is_active
        or not verify_password(password, owner.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy e-mail lub hasło",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        subject=owner.email, business_id=owner.business_id, role=owner.role
    )
    return TokenResponse(access_token=token)
