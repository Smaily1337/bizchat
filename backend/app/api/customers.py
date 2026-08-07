"""Customers CRUD (admin)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import CurrentOwner, DbSession
from app.models import Customer
from app.schemas import CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


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
        name=body.name,
        phone=body.phone,
        external_ids={},
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
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
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
