"""Notifications: manual sends, reminder settings, templates, delivery log."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import CurrentOwner, DbSession
from app.models import (
    Appointment,
    Business,
    Customer,
    NotificationKind,
    NotificationLog,
    NotificationTemplate,
    Service,
)
from app.schemas import (
    NotificationLogOut,
    NotificationPreviewRequest,
    NotificationPreviewResponse,
    NotificationSendRequest,
    NotificationSettingsOut,
    NotificationSettingsUpdate,
    NotificationTemplateCreate,
    NotificationTemplateOut,
    NotificationTemplateUpdate,
)
from app.services.notifications import (
    build_context,
    get_or_create_settings,
    render_template,
    send_notification,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# Settings (automatic reminders)
# ---------------------------------------------------------------------------


@router.get("/settings", response_model=NotificationSettingsOut)
async def get_settings(db: DbSession, owner: CurrentOwner) -> NotificationSettingsOut:
    row = await get_or_create_settings(db, owner.business_id)
    return NotificationSettingsOut.model_validate(row)


@router.put("/settings", response_model=NotificationSettingsOut)
async def update_settings(
    db: DbSession,
    owner: CurrentOwner,
    body: NotificationSettingsUpdate,
) -> NotificationSettingsOut:
    row = await get_or_create_settings(db, owner.business_id)
    if body.reminders_enabled is not None:
        row.reminders_enabled = body.reminders_enabled
    if body.lead_times_min is not None:
        cleaned = sorted({m for m in body.lead_times_min if 5 <= m <= 7 * 24 * 60}, reverse=True)
        if not cleaned:
            raise HTTPException(status_code=400, detail="Podaj co najmniej jeden czas 5 min – 7 dni")
        row.lead_times_min = cleaned
    if body.max_per_appointment is not None:
        row.max_per_appointment = body.max_per_appointment
    if body.default_channel is not None:
        row.default_channel = body.default_channel
    await db.flush()
    return NotificationSettingsOut.model_validate(row)


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------


@router.get("/templates", response_model=list[NotificationTemplateOut])
async def list_templates(db: DbSession, owner: CurrentOwner) -> list[NotificationTemplate]:
    result = await db.execute(
        select(NotificationTemplate)
        .where(NotificationTemplate.business_id == owner.business_id)
        .order_by(NotificationTemplate.kind, NotificationTemplate.created_at)
    )
    return list(result.scalars().all())


@router.post(
    "/templates",
    response_model=NotificationTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    db: DbSession,
    owner: CurrentOwner,
    body: NotificationTemplateCreate,
) -> NotificationTemplate:
    row = NotificationTemplate(
        business_id=owner.business_id,
        kind=body.kind,
        name=body.name,
        body=body.body,
        is_default=body.is_default,
    )
    db.add(row)
    await db.flush()
    return row


@router.patch("/templates/{template_id}", response_model=NotificationTemplateOut)
async def update_template(
    db: DbSession,
    owner: CurrentOwner,
    template_id: UUID,
    body: NotificationTemplateUpdate,
) -> NotificationTemplate:
    row = await db.get(NotificationTemplate, template_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Template not found")
    for field in ("kind", "name", "body", "is_default"):
        value = getattr(body, field)
        if value is not None:
            setattr(row, field, value)
    await db.flush()
    return row


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    db: DbSession,
    owner: CurrentOwner,
    template_id: UUID,
) -> Response:
    row = await db.get(NotificationTemplate, template_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(row)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Preview + send
# ---------------------------------------------------------------------------


async def _load_send_targets(
    db: DbSession,
    business_id: UUID,
    appointment_id: UUID | None,
    customer_id: UUID | None,
) -> tuple[Appointment | None, Customer | None, Service | None]:
    appointment: Appointment | None = None
    customer: Customer | None = None
    service: Service | None = None

    if appointment_id is not None:
        appointment = await db.get(Appointment, appointment_id)
        if appointment is None or appointment.business_id != business_id:
            raise HTTPException(status_code=404, detail="Appointment not found")
        customer = await db.get(Customer, appointment.customer_id)
        service = await db.get(Service, appointment.service_id)
    elif customer_id is not None:
        customer = await db.get(Customer, customer_id)
        if customer is None or customer.business_id != business_id:
            raise HTTPException(status_code=404, detail="Customer not found")

    return appointment, customer, service


@router.post("/preview", response_model=NotificationPreviewResponse)
async def preview_notification(
    db: DbSession,
    owner: CurrentOwner,
    body: NotificationPreviewRequest,
) -> NotificationPreviewResponse:
    business = await db.get(Business, owner.business_id)
    assert business is not None
    appointment, customer, service = await _load_send_targets(
        db, owner.business_id, body.appointment_id, None
    )
    context = build_context(business, customer, appointment, service)
    return NotificationPreviewResponse(rendered=render_template(body.body, context))


@router.post("/send", response_model=NotificationLogOut, status_code=status.HTTP_201_CREATED)
async def send_manual_notification(
    db: DbSession,
    owner: CurrentOwner,
    body: NotificationSendRequest,
) -> NotificationLogOut:
    if body.appointment_id is None and body.customer_id is None:
        raise HTTPException(
            status_code=400, detail="Wskaż wizytę lub klienta (appointment_id / customer_id)"
        )

    business = await db.get(Business, owner.business_id)
    assert business is not None
    appointment, customer, service = await _load_send_targets(
        db, owner.business_id, body.appointment_id, body.customer_id
    )

    message_body = body.body
    kind = NotificationKind.custom
    if body.template_id is not None:
        template = await db.get(NotificationTemplate, body.template_id)
        if template is None or template.business_id != owner.business_id:
            raise HTTPException(status_code=404, detail="Template not found")
        message_body = template.body
        kind = template.kind
    if not message_body or not message_body.strip():
        raise HTTPException(status_code=400, detail="Treść wiadomości jest pusta")

    cfg = await get_or_create_settings(db, owner.business_id)
    channel = body.channel or cfg.default_channel

    log = await send_notification(
        db,
        business,
        customer=customer,
        appointment=appointment,
        service=service,
        channel=channel,
        kind=kind,
        body=message_body,
    )
    out = NotificationLogOut.model_validate(log)
    out.customer_name = customer.name if customer else None
    out.service_name = service.name if service else None
    return out


# ---------------------------------------------------------------------------
# Log
# ---------------------------------------------------------------------------


@router.get("/log", response_model=list[NotificationLogOut])
async def list_log(
    db: DbSession,
    owner: CurrentOwner,
    limit: int = 100,
) -> list[NotificationLogOut]:
    limit = max(1, min(limit, 500))
    result = await db.execute(
        select(NotificationLog, Customer.name, Service.name)
        .outerjoin(Customer, NotificationLog.customer_id == Customer.id)
        .outerjoin(Appointment, NotificationLog.appointment_id == Appointment.id)
        .outerjoin(Service, Appointment.service_id == Service.id)
        .where(NotificationLog.business_id == owner.business_id)
        .order_by(NotificationLog.created_at.desc())
        .limit(limit)
    )
    out: list[NotificationLogOut] = []
    for log, customer_name, service_name in result.all():
        item = NotificationLogOut.model_validate(log)
        item.customer_name = customer_name
        item.service_name = service_name
        out.append(item)
    return out
