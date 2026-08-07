"""Auth endpoints — login (OAuth2 password form + JSON)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.api.deps import (
    CurrentOwner,
    DbSession,
    create_access_token,
    verify_password,
)
from app.models import Owner
from app.schemas import LoginRequest, OwnerOut, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login_form(
    db: DbSession,
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> TokenResponse:
    return await _authenticate(db, form_data.username, form_data.password)


@router.post("/login/json", response_model=TokenResponse)
async def login_json(db: DbSession, body: LoginRequest) -> TokenResponse:
    return await _authenticate(db, body.email, body.password)


@router.get("/me", response_model=OwnerOut)
async def me(owner: CurrentOwner) -> Owner:
    return owner


async def _authenticate(db: DbSession, email: str, password: str) -> TokenResponse:
    result = await db.execute(select(Owner).where(Owner.email == email))
    owner = result.scalar_one_or_none()
    if owner is None or not verify_password(password, owner.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=owner.email, business_id=owner.business_id)
    return TokenResponse(access_token=token)
