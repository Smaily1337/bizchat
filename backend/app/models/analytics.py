"""Landing / marketing pageview tracking."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import GUID
from app.models.mixins import TimestampMixin


class PageView(Base, TimestampMixin):
    """Single pageview hit from landing (or other public pages)."""

    __tablename__ = "pageviews"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    path: Mapped[str] = mapped_column(String(512), nullable=False, default="/")
    referrer: Mapped[Optional[str]] = mapped_column(String(1024))
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    session_id: Mapped[Optional[str]] = mapped_column(String(64))
    # TimestampMixin provides created_at / updated_at; updated_at unused but kept for consistency.
    # Store optional client IP hash for rate-limit diagnostics (not PII).
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64))
    notes: Mapped[Optional[str]] = mapped_column(Text)
