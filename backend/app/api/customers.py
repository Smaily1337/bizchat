"""Customers CRUD (admin)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

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


@router.get("", response_model=list[CustomerOut])
async def list_customers(db: DbSession, owner: CurrentOwner) -> list[Customer]:
    result = await db.execute(
        select(Customer)
        .where(Customer.business_id == owner.business_id)
        .order_by(Customer.name.nulls_last(), Customer.created_at.desc())
    )
    return list(result.scalars().all())


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
    return customer


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    db: DbSession,
    owner: CurrentOwner,
    customer_id: UUID,
    body: CustomerUpdate,
) -> Customer:
    customer = await db.get(Customer, customer_id)
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
