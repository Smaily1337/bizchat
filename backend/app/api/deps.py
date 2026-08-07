"""FastAPI dependencies — DB session + JWT auth."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models import Owner

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

DbSession = Annotated[AsyncSession, Depends(get_db)]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(*, subject: str, business_id: UUID, expires_minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload = {
        "sub": subject,
        "business_id": str(business_id),
        "exp": expire,
        "typ": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


async def get_current_owner(
    db: DbSession,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> Owner:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email: str | None = data.get("sub")
        if not email:
            raise credentials_exc
    except InvalidTokenError as exc:
        raise credentials_exc from exc

    result = await db.execute(select(Owner).where(Owner.email == email))
    owner = result.scalar_one_or_none()
    if owner is None:
        raise credentials_exc
    return owner


CurrentOwner = Annotated[Owner, Depends(get_current_owner)]
