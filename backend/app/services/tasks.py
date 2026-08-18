"""Staff task assignment: CRUD helpers, attachments, assignment emails."""

from __future__ import annotations

import logging
import shutil
from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import Business, Owner, Task, TaskAssignee, TaskAttachment, UserRole
from app.models.enums import TaskMailStatus, TaskPriority, TaskStatus
from app.models.mixins import utc_now
from app.schemas import (
    TaskAssigneeOut,
    TaskAttachmentOut,
    TaskCreatedByOut,
    TaskOut,
)
from app.services.mailer import send_email
from app.services.uploads import (
    attachment_path,
    safe_filename,
    stored_name_for,
    task_upload_dir,
)

logger = logging.getLogger("bizchat.tasks")

PRIORITY_LABEL = {
    TaskPriority.low: "niska",
    TaskPriority.normal: "normalna",
    TaskPriority.high: "wysoka",
    TaskPriority.urgent: "pilna",
}

_TASK_LOAD = (
    selectinload(Task.assignees).selectinload(TaskAssignee.owner),
    selectinload(Task.attachments),
    selectinload(Task.created_by),
)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_overdue(task: Task) -> bool:
    if task.status != TaskStatus.open or task.due_at is None:
        return False
    return _as_utc(task.due_at) < datetime.now(timezone.utc)


def to_task_out(task: Task) -> TaskOut:
    created = None
    if task.created_by is not None:
        created = TaskCreatedByOut(
            id=task.created_by.id,
            name=task.created_by.name,
            email=task.created_by.email,
        )
    assignees: list[TaskAssigneeOut] = []
    for row in task.assignees:
        owner = row.owner
        assignees.append(
            TaskAssigneeOut(
                id=row.id,
                owner_id=row.owner_id,
                name=owner.name if owner else None,
                email=owner.email if owner else "",
                mail_status=row.mail_status,
                mail_error=row.mail_error,
            )
        )
    attachments = [
        TaskAttachmentOut(
            id=att.id,
            filename=att.filename,
            content_type=att.content_type,
            size_bytes=att.size_bytes,
            created_at=att.created_at,
        )
        for att in task.attachments
    ]
    return TaskOut(
        id=task.id,
        business_id=task.business_id,
        title=task.title,
        description=task.description or "",
        priority=task.priority,
        due_at=task.due_at,
        status=task.status,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        is_overdue=is_overdue(task),
        created_by=created,
        assignees=assignees,
        attachments=attachments,
    )


async def get_task(db: AsyncSession, task_id: UUID) -> Task | None:
    result = await db.execute(
        select(Task).options(*_TASK_LOAD).where(Task.id == task_id)
    )
    return result.unique().scalar_one_or_none()


def can_view(actor: Owner, task: Task) -> bool:
    if task.business_id != actor.business_id:
        return False
    if actor.role in (UserRole.owner, UserRole.admin):
        return True
    return any(a.owner_id == actor.id for a in task.assignees)


def can_manage(actor: Owner) -> bool:
    return actor.role in (UserRole.owner, UserRole.admin)


def can_complete(actor: Owner, task: Task) -> bool:
    if can_manage(actor) and task.business_id == actor.business_id:
        return True
    return any(a.owner_id == actor.id for a in task.assignees)


async def list_tasks(
    db: AsyncSession,
    actor: Owner,
    *,
    status_filter: TaskStatus | None = None,
    assignee_id: UUID | None = None,
    priority: TaskPriority | None = None,
    overdue: bool | None = None,
) -> list[Task]:
    stmt = (
        select(Task)
        .options(*_TASK_LOAD)
        .where(Task.business_id == actor.business_id)
    )
    if actor.role == UserRole.pracownik:
        stmt = stmt.join(TaskAssignee).where(TaskAssignee.owner_id == actor.id)
    if status_filter is not None:
        stmt = stmt.where(Task.status == status_filter)
    if assignee_id is not None:
        stmt = stmt.where(
            Task.assignees.any(TaskAssignee.owner_id == assignee_id)
        )
    if priority is not None:
        stmt = stmt.where(Task.priority == priority)
    stmt = stmt.order_by(Task.created_at.desc())
    result = await db.execute(stmt)
    items = list(result.unique().scalars().all())
    if overdue is True:
        items = [t for t in items if is_overdue(t)]
    elif overdue is False:
        items = [t for t in items if not is_overdue(t)]
    items.sort(
        key=lambda t: (
            0 if t.status == TaskStatus.open else 1 if t.status == TaskStatus.done else 2,
            0 if is_overdue(t) else 1,
            {
                TaskPriority.urgent: 0,
                TaskPriority.high: 1,
                TaskPriority.normal: 2,
                TaskPriority.low: 3,
            }.get(t.priority, 2),
            _as_utc(t.due_at).timestamp() if t.due_at else float("inf"),
        )
    )
    return items


async def resolve_assignees(
    db: AsyncSession, business_id: UUID, owner_ids: list[UUID]
) -> list[Owner]:
    unique_ids = list(dict.fromkeys(owner_ids))
    if not unique_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wybierz przynajmniej jednego pracownika",
        )
    result = await db.execute(
        select(Owner).where(
            Owner.business_id == business_id,
            Owner.id.in_(unique_ids),
            Owner.is_active.is_(True),
        )
    )
    found = list(result.scalars().all())
    if len(found) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Niektórzy pracownicy nie istnieją albo są nieaktywni",
        )
    return found


async def save_uploads(db: AsyncSession, task: Task, files: list[UploadFile]) -> None:
    for upload in files:
        if not upload or not upload.filename:
            continue
        data = await upload.read()
        if not data:
            continue
        if len(data) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Plik {upload.filename} jest za duży "
                    f"(max {settings.max_upload_bytes // (1024 * 1024)} MB)"
                ),
            )
        stored = stored_name_for(upload.filename)
        path = attachment_path(task.id, stored)
        path.write_bytes(data)
        db.add(
            TaskAttachment(
                task_id=task.id,
                filename=safe_filename(upload.filename),
                stored_name=stored,
                content_type=upload.content_type or "application/octet-stream",
                size_bytes=len(data),
            )
        )


def _format_due(due_at: datetime | None, tz_name: str) -> str:
    if due_at is None:
        return "brak terminu"
    dt = _as_utc(due_at)
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("Europe/Warsaw")
    return dt.astimezone(tz).strftime("%d.%m.%Y %H:%M")


def _assigner_label(actor: Owner) -> str:
    name = (actor.name or "").strip()
    if name:
        return f"{name} ({actor.email})"
    return actor.email


def build_assignment_email(
    *,
    actor: Owner,
    business: Business,
    task: Task,
    assignees: list[Owner],
) -> tuple[str, str]:
    names = ", ".join((o.name or o.email) for o in assignees)
    due = _format_due(task.due_at, business.timezone or "Europe/Warsaw")
    attach_names = ", ".join(a.filename for a in task.attachments) or "brak"
    subject = f"[BizChat] Nowe zadanie: {task.title}"
    body = (
        f"Od: {_assigner_label(actor)}\n"
        f"Firma: {business.name}\n\n"
        f"Nowe zadanie: {task.title}\n"
        f"Ważność: {PRIORITY_LABEL.get(task.priority, task.priority.value)}\n"
        f"Termin: {due}\n\n"
        f"{(task.description or '').strip() or '(brak opisu)'}\n\n"
        f"Przydzieleni: {names}\n"
        f"Załączniki: {attach_names}\n"
    )
    return subject, body


async def notify_assignees(
    db: AsyncSession,
    *,
    actor: Owner,
    business: Business,
    task: Task,
    targets: list[TaskAssignee],
) -> None:
    owners = [row.owner for row in targets if row.owner is not None]
    subject, body = build_assignment_email(
        actor=actor, business=business, task=task, assignees=owners
    )
    files: list[tuple[str, bytes, str]] = []
    for att in task.attachments:
        path = attachment_path(task.id, att.stored_name)
        if path.is_file():
            files.append((att.filename, path.read_bytes(), att.content_type))

    for row in targets:
        owner = row.owner
        if owner is None or not owner.email:
            row.mail_status = TaskMailStatus.failed
            row.mail_error = "Brak adresu e-mail"
            continue
        try:
            send_email(
                to=owner.email,
                subject=subject,
                body=body,
                reply_to=actor.email,
                attachments=files or None,
            )
            row.mail_status = TaskMailStatus.sent
            row.mail_error = None
        except Exception as exc:  # noqa: BLE001
            logger.exception("Task mail failed for %s", owner.email)
            row.mail_status = TaskMailStatus.failed
            row.mail_error = str(exc)[:500]
    await db.flush()


async def create_task(
    db: AsyncSession,
    *,
    actor: Owner,
    title: str,
    description: str,
    priority: TaskPriority,
    due_at: datetime | None,
    assignee_ids: list[UUID],
    files: list[UploadFile],
) -> Task:
    owners = await resolve_assignees(db, actor.business_id, assignee_ids)
    task = Task(
        business_id=actor.business_id,
        created_by_id=actor.id,
        title=title.strip(),
        description=(description or "").strip(),
        priority=priority,
        due_at=_as_utc(due_at) if due_at else None,
        status=TaskStatus.open,
    )
    db.add(task)
    await db.flush()
    for owner in owners:
        db.add(TaskAssignee(task_id=task.id, owner_id=owner.id))
    await save_uploads(db, task, files)
    await db.flush()

    loaded = await get_task(db, task.id)
    assert loaded is not None
    business = await db.get(Business, actor.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Firma nie znaleziona")
    await notify_assignees(
        db, actor=actor, business=business, task=loaded, targets=loaded.assignees
    )
    return await get_task(db, task.id) or loaded


async def replace_assignees(
    db: AsyncSession,
    *,
    actor: Owner,
    task: Task,
    assignee_ids: list[UUID],
) -> None:
    owners = await resolve_assignees(db, actor.business_id, assignee_ids)
    wanted = {o.id for o in owners}
    existing = {row.owner_id: row for row in task.assignees}
    for owner_id, row in list(existing.items()):
        if owner_id not in wanted:
            await db.delete(row)
    new_rows: list[TaskAssignee] = []
    for owner in owners:
        if owner.id not in existing:
            row = TaskAssignee(task_id=task.id, owner_id=owner.id)
            db.add(row)
            new_rows.append(row)
    await db.flush()
    if not new_rows:
        return
    loaded = await get_task(db, task.id)
    assert loaded is not None
    business = await db.get(Business, actor.business_id)
    if business is None:
        return
    fresh_new = [a for a in loaded.assignees if a.owner_id in {r.owner_id for r in new_rows}]
    await notify_assignees(
        db, actor=actor, business=business, task=loaded, targets=fresh_new
    )


def apply_status(task: Task, new_status: TaskStatus) -> None:
    task.status = new_status
    if new_status == TaskStatus.done:
        task.completed_at = utc_now()
    else:
        task.completed_at = None


async def delete_task_files(task: Task) -> None:
    folder = task_upload_dir(task.id)
    if folder.is_dir():
        shutil.rmtree(folder, ignore_errors=True)
