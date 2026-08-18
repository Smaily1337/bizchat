"""Local file storage for task attachments."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.config import settings

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def uploads_root() -> Path:
    if settings.upload_dir:
        root = Path(settings.upload_dir)
    elif settings.is_sqlite:
        raw = settings.database_url.split("///", 1)[-1]
        root = Path(raw).parent / "uploads"
    else:
        root = Path("data/uploads")
    root.mkdir(parents=True, exist_ok=True)
    return root


def task_upload_dir(task_id: uuid.UUID) -> Path:
    path = uploads_root() / "tasks" / str(task_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def safe_filename(name: str) -> str:
    cleaned = _UNSAFE.sub("_", (name or "plik").strip())[:180].strip("._")
    return cleaned or "plik"


def stored_name_for(original: str) -> str:
    suffix = Path(original).suffix[:16]
    return f"{uuid.uuid4().hex}{suffix}"


def attachment_path(task_id: uuid.UUID, stored_name: str) -> Path:
    return task_upload_dir(task_id) / stored_name
