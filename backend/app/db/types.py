"""Portable column types (PostgreSQL + SQLite)."""

from __future__ import annotations

from sqlalchemy import JSON, Uuid
from sqlalchemy import Enum as SAEnum

GUID = Uuid(as_uuid=True)
JSONType = JSON


def str_enum(enum_cls: type, name: str, *, create_type: bool = True) -> SAEnum:
    """String-backed enum — works on SQLite and PostgreSQL."""
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        values_callable=lambda obj: [e.value for e in obj],
        create_constraint=False,
    )
