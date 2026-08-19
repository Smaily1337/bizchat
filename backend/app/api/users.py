"""Panel użytkowników — CRUD kont, role, reset hasła."""

from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select

from app.api.deps import (
    DbSession,
    RequireOwnerOrAdmin,
    hash_password,
)
from app.models import Business, Owner, UserRole
from app.schemas import OwnerOut
from app.services import limits as limits_service
from app.services.limits import LimitExceededError

router = APIRouter(prefix="/api/users", tags=["users"])


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ValueError("Nieprawidłowy adres e-mail")
    return email


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)
    name: str | None = None
    role: UserRole = UserRole.pracownik

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        return _normalize_email(v)


class UserUpdate(BaseModel):
    email: str | None = None
    name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _normalize_email(v)


class PasswordReset(BaseModel):
    password: str | None = Field(default=None, min_length=6, max_length=128)


class PasswordResetOut(BaseModel):
    message: str
    temporary_password: str | None = None


def _can_assign_role(actor: Owner, role: UserRole) -> bool:
    if actor.role == UserRole.owner:
        return True
    # Admin nie może tworzyć/promować do owner
    return role != UserRole.owner


async def _count_owners(db: DbSession, business_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Owner)
        .where(
            Owner.business_id == business_id,
            Owner.role == UserRole.owner,
            Owner.is_active.is_(True),
        )
    )
    return int(result.scalar_one())


@router.get("", response_model=list[OwnerOut])
async def list_users(db: DbSession, actor: RequireOwnerOrAdmin) -> list[Owner]:
    result = await db.execute(
        select(Owner)
        .where(Owner.business_id == actor.business_id)
        .order_by(Owner.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("", response_model=OwnerOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    db: DbSession, actor: RequireOwnerOrAdmin, body: UserCreate
) -> Owner:
    if not _can_assign_role(actor, body.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nie możesz nadać roli właściciela",
        )
    existing = await db.execute(
        select(Owner).where(Owner.email == body.email.lower().strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto z tym e-mailem już istnieje",
        )
    business = await db.get(Business, actor.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Firma nie znaleziona")
    try:
        await limits_service.assert_can_add_seat(db, business)
    except LimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    user = Owner(
        email=body.email.lower().strip(),
        password_hash=hash_password(body.password),
        name=(body.name or "").strip() or None,
        role=body.role,
        email_verified=True,
        business_id=actor.business_id,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


@router.patch("/{user_id}", response_model=OwnerOut)
async def update_user(
    db: DbSession,
    actor: RequireOwnerOrAdmin,
    user_id: UUID,
    body: UserUpdate,
) -> Owner:
    result = await db.execute(
        select(Owner).where(
            Owner.id == user_id, Owner.business_id == actor.business_id
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Użytkownik nie znaleziony")

    if body.role is not None:
        if not _can_assign_role(actor, body.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nie możesz nadać roli właściciela",
            )
        if (
            user.role == UserRole.owner
            and body.role != UserRole.owner
            and await _count_owners(db, actor.business_id) <= 1
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nie można zdegradować jedynego właściciela",
            )
        user.role = body.role

    if body.email is not None:
        email = body.email.lower().strip()
        clash = await db.execute(
            select(Owner).where(Owner.email == email, Owner.id != user.id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Konto z tym e-mailem już istnieje",
            )
        user.email = email

    if body.name is not None:
        user.name = body.name.strip() or None

    if body.is_active is not None:
        if user.id == actor.id and not body.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nie możesz dezaktywować własnego konta",
            )
        if (
            user.role == UserRole.owner
            and not body.is_active
            and await _count_owners(db, actor.business_id) <= 1
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nie można dezaktywować jedynego właściciela",
            )
        user.is_active = body.is_active

    await db.flush()
    return user


@router.post("/{user_id}/reset-password", response_model=PasswordResetOut)
async def reset_password(
    db: DbSession,
    actor: RequireOwnerOrAdmin,
    user_id: UUID,
    body: PasswordReset | None = None,
) -> PasswordResetOut:
    result = await db.execute(
        select(Owner).where(
            Owner.id == user_id, Owner.business_id == actor.business_id
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Użytkownik nie znaleziony")

    if actor.role == UserRole.admin and user.role == UserRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin nie może resetować hasła właściciela",
        )

    provided = body.password if body else None
    new_password = provided or secrets.token_urlsafe(10)
    user.password_hash = hash_password(new_password)
    await db.flush()
    return PasswordResetOut(
        message="Hasło zostało zresetowane",
        temporary_password=None if provided else new_password,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    db: DbSession, actor: RequireOwnerOrAdmin, user_id: UUID
) -> Response:
    result = await db.execute(
        select(Owner).where(
            Owner.id == user_id, Owner.business_id == actor.business_id
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Użytkownik nie znaleziony")
    if user.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie możesz usunąć własnego konta",
        )
    if actor.role == UserRole.admin and user.role == UserRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin nie może usuwać właściciela",
        )
    if (
        user.role == UserRole.owner
        and await _count_owners(db, actor.business_id) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można usunąć jedynego właściciela",
        )
    await db.delete(user)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
