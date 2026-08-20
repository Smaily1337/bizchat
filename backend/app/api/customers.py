"""Customers CRUD (admin) + CSV import."""

from __future__ import annotations

import csv
import io
from typing import Any
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentOwner, DbSession
from app.models import Customer
from app.schemas import CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _merge_external_ids(
    existing: dict[str, Any] | None,
    *,
    external_ids: dict[str, Any] | None = None,
    messenger_psid: str | None = None,
    instagram_id: str | None = None,
    telegram_id: str | None = None,
    whatsapp_id: str | None = None,
) -> dict[str, Any]:
    merged: dict[str, Any] = dict(existing or {})
    if external_ids:
        for key, value in external_ids.items():
            if value is None or value == "":
                merged.pop(str(key), None)
            else:
                merged[str(key)] = str(value).strip()
    channel_map = {
        "messenger": messenger_psid,
        "instagram": instagram_id,
        "telegram": telegram_id,
        "whatsapp": whatsapp_id,
    }
    for key, value in channel_map.items():
        if value is None:
            continue
        cleaned = value.strip()
        if cleaned:
            merged[key] = cleaned
        else:
            merged.pop(key, None)
    return merged


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]


@router.get("", response_model=list[CustomerOut])
async def list_customers(db: DbSession, owner: CurrentOwner) -> list[Customer]:
    result = await db.execute(
        select(Customer)
        .where(Customer.business_id == owner.business_id)
        .options(selectinload(Customer.tags))
        .order_by(Customer.name.nulls_last(), Customer.created_at.desc())
    )
    return list(result.scalars().unique().all())


@router.post("/import", response_model=ImportResult)
async def import_customers_csv(
    db: DbSession,
    owner: CurrentOwner,
    file: UploadFile = File(...),
) -> ImportResult:
    """CSV columns: name, phone, email, messenger_psid, whatsapp (header required)."""
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Pusty CSV")

    created = updated = skipped = 0
    errors: list[str] = []
    for i, row in enumerate(reader, start=2):
        norm = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        name = norm.get("name") or norm.get("imie") or norm.get("nazwa") or None
        phone = norm.get("phone") or norm.get("telefon") or None
        email = norm.get("email") or norm.get("e-mail") or None
        if email:
            email = email.lower()
        psid = norm.get("messenger_psid") or norm.get("psid") or None
        wa = norm.get("whatsapp") or None
        if not name and not phone and not email:
            skipped += 1
            continue
        existing = None
        clauses = []
        if phone:
            clauses.append(Customer.phone == phone)
        if email:
            clauses.append(Customer.email == email)
        if clauses:
            existing = (
                await db.execute(
                    select(Customer).where(
                        Customer.business_id == owner.business_id,
                        or_(*clauses),
                    )
                )
            ).scalars().first()
        try:
            if existing:
                if name:
                    existing.name = name
                if phone:
                    existing.phone = phone
                if email:
                    existing.email = email
                existing.external_ids = _merge_external_ids(
                    existing.external_ids,
                    messenger_psid=psid,
                    whatsapp_id=wa,
                )
                updated += 1
            else:
                db.add(
                    Customer(
                        business_id=owner.business_id,
                        name=name,
                        phone=phone,
                        email=email,
                        external_ids=_merge_external_ids(
                            {},
                            messenger_psid=psid,
                            whatsapp_id=wa,
                        ),
                    )
                )
                created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"wiersz {i}: {exc}")
            skipped += 1
    await db.flush()
    return ImportResult(
        created=created, updated=updated, skipped=skipped, errors=errors[:20]
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    db: DbSession,
    owner: CurrentOwner,
    body: CustomerCreate,
) -> Customer:
    customer = Customer(
        business_id=owner.business_id,
        name=(body.name or "").strip() or None,
        phone=(body.phone or "").strip() or None,
        email=(body.email or "").strip() or None,
        external_ids=_merge_external_ids(
            {},
            external_ids=body.external_ids,
            messenger_psid=body.messenger_psid,
            instagram_id=body.instagram_id,
            telegram_id=body.telegram_id,
        ),
    )
    db.add(customer)
    await db.flush()
    customer.tags = []
    return customer


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    db: DbSession,
    owner: CurrentOwner,
    customer_id: UUID,
    body: CustomerUpdate,
) -> Customer:
    customer = (
        await db.execute(
            select(Customer)
            .where(Customer.id == customer_id)
            .options(selectinload(Customer.tags))
        )
    ).scalars().first()
    if customer is None or customer.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = body.model_dump(exclude_unset=True)
    for key in ("name", "phone", "email"):
        if key in data:
            value = data[key]
            setattr(
                customer,
                key,
                (value.strip() if isinstance(value, str) else value) or None,
            )

    if any(
        k in data
        for k in ("external_ids", "messenger_psid", "instagram_id", "telegram_id")
    ):
        customer.external_ids = _merge_external_ids(
            customer.external_ids,
            external_ids=data.get("external_ids"),
            messenger_psid=data.get("messenger_psid"),
            instagram_id=data.get("instagram_id"),
            telegram_id=data.get("telegram_id"),
        )

    await db.flush()
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    db: DbSession,
    owner: CurrentOwner,
    customer_id: UUID,
) -> Response:
    customer = await db.get(Customer, customer_id)
    if customer is None or customer.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.delete(customer)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
