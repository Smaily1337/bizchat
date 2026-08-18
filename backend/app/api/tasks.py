"""Staff tasks — assign work, attachments, immediate email."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse

from app.api.deps import CurrentOwner, DbSession, RequireOwnerOrAdmin
from app.models import Owner
from app.models.enums import TaskPriority, TaskStatus
from app.schemas import TaskOut, TaskUpdate
from app.services import tasks as task_svc
from app.services.uploads import attachment_path

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _parse_due(raw: str | None) -> datetime | None:
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _require_task(task, actor: Owner):
    if task is None or not task_svc.can_view(actor, task):
        raise HTTPException(status_code=404, detail="Zadanie nie znalezione")
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    db: DbSession,
    actor: CurrentOwner,
    status_filter: TaskStatus | None = Query(None, alias="status"),
    assignee_id: UUID | None = None,
    priority: TaskPriority | None = None,
    overdue: bool | None = None,
) -> list[TaskOut]:
    items = await task_svc.list_tasks(
        db,
        actor,
        status_filter=status_filter,
        assignee_id=assignee_id,
        priority=priority,
        overdue=overdue,
    )
    return [task_svc.to_task_out(t) for t in items]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    db: DbSession,
    actor: RequireOwnerOrAdmin,
    title: str = Form(..., min_length=1, max_length=255),
    description: str = Form(""),
    priority: TaskPriority = Form(TaskPriority.normal),
    due_at: str | None = Form(None),
    assignee_ids: list[UUID] = Form(...),
    files: list[UploadFile] = File(default=[]),
) -> TaskOut:
    task = await task_svc.create_task(
        db,
        actor=actor,
        title=title,
        description=description,
        priority=priority,
        due_at=_parse_due(due_at),
        assignee_ids=assignee_ids,
        files=files,
    )
    return task_svc.to_task_out(task)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(db: DbSession, actor: CurrentOwner, task_id: UUID) -> TaskOut:
    task = _require_task(await task_svc.get_task(db, task_id), actor)
    return task_svc.to_task_out(task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    db: DbSession,
    actor: CurrentOwner,
    task_id: UUID,
    body: TaskUpdate,
) -> TaskOut:
    task = _require_task(await task_svc.get_task(db, task_id), actor)
    manager = task_svc.can_manage(actor)

    if not manager:
        extra = body.model_dump(exclude_unset=True)
        extra.pop("status", None)
        if extra:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Pracownik może tylko zmienić status zadania",
            )
        if body.status is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Brak zmian",
            )
        if body.status == TaskStatus.cancelled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tylko szef lub admin może anulować zadanie",
            )
        if not task_svc.can_complete(actor, task):
            raise HTTPException(status_code=403, detail="Brak uprawnień")
        task_svc.apply_status(task, body.status)
        await db.flush()
        loaded = await task_svc.get_task(db, task.id)
        return task_svc.to_task_out(loaded or task)

    if body.title is not None:
        task.title = body.title.strip()
    if body.description is not None:
        task.description = body.description.strip()
    if body.priority is not None:
        task.priority = body.priority
    if body.clear_due_at:
        task.due_at = None
    elif body.due_at is not None:
        due = body.due_at
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        task.due_at = due
    if body.status is not None:
        task_svc.apply_status(task, body.status)
    if body.assignee_ids is not None:
        await task_svc.replace_assignees(
            db, actor=actor, task=task, assignee_ids=body.assignee_ids
        )
    await db.flush()
    loaded = await task_svc.get_task(db, task.id)
    return task_svc.to_task_out(loaded or task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    db: DbSession, actor: RequireOwnerOrAdmin, task_id: UUID
) -> Response:
    task = await task_svc.get_task(db, task_id)
    if task is None or task.business_id != actor.business_id:
        raise HTTPException(status_code=404, detail="Zadanie nie znalezione")
    await task_svc.delete_task_files(task)
    await db.delete(task)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{task_id}/attachments",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_attachments(
    db: DbSession,
    actor: RequireOwnerOrAdmin,
    task_id: UUID,
    files: list[UploadFile] = File(...),
) -> TaskOut:
    task = await task_svc.get_task(db, task_id)
    if task is None or task.business_id != actor.business_id:
        raise HTTPException(status_code=404, detail="Zadanie nie znalezione")
    await task_svc.save_uploads(db, task, files)
    await db.flush()
    loaded = await task_svc.get_task(db, task.id)
    return task_svc.to_task_out(loaded or task)


@router.get("/{task_id}/attachments/{attachment_id}")
async def download_attachment(
    db: DbSession,
    actor: CurrentOwner,
    task_id: UUID,
    attachment_id: UUID,
) -> FileResponse:
    task = _require_task(await task_svc.get_task(db, task_id), actor)
    att = next((a for a in task.attachments if a.id == attachment_id), None)
    if att is None:
        raise HTTPException(status_code=404, detail="Załącznik nie znaleziony")
    path = attachment_path(task.id, att.stored_name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Plik nie znaleziony na dysku")
    return FileResponse(
        path,
        filename=att.filename,
        media_type=att.content_type or "application/octet-stream",
    )


@router.delete(
    "/{task_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_attachment(
    db: DbSession,
    actor: RequireOwnerOrAdmin,
    task_id: UUID,
    attachment_id: UUID,
) -> Response:
    task = await task_svc.get_task(db, task_id)
    if task is None or task.business_id != actor.business_id:
        raise HTTPException(status_code=404, detail="Zadanie nie znalezione")
    att = next((a for a in task.attachments if a.id == attachment_id), None)
    if att is None:
        raise HTTPException(status_code=404, detail="Załącznik nie znaleziony")
    path = attachment_path(task.id, att.stored_name)
    if path.is_file():
        path.unlink()
    await db.delete(att)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
