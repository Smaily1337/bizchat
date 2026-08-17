"""Staff CRUD for multi-person scheduling."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentOwner, DbSession
from app.models import Staff
from app.schemas import ORMModel

router = APIRouter(prefix="/api/staff", tags=["staff"])


class StaffOut(ORMModel):
    id: UUID
    business_id: UUID
    name: str
    color: str | None = None
    is_active: bool
    sort_order: int


class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    color: str | None = None
    sort_order: int = 0


class StaffUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


@router.get("", response_model=list[StaffOut])
async def list_staff(db: DbSession, owner: CurrentOwner) -> list[Staff]:
    result = await db.execute(
        select(Staff)
        .where(Staff.business_id == owner.business_id)
        .order_by(Staff.sort_order, Staff.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
async def create_staff(
    db: DbSession, owner: CurrentOwner, body: StaffCreate
) -> Staff:
    row = Staff(
        business_id=owner.business_id,
        name=body.name.strip(),
        color=body.color,
        sort_order=body.sort_order,
        is_active=True,
    )
    db.add(row)
    await db.flush()
    return row


@router.patch("/{staff_id}", response_model=StaffOut)
async def update_staff(
    db: DbSession, owner: CurrentOwner, staff_id: UUID, body: StaffUpdate
) -> Staff:
    row = await db.get(Staff, staff_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Staff not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for k, v in data.items():
        setattr(row, k, v)
    await db.flush()
    return row


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(
    db: DbSession, owner: CurrentOwner, staff_id: UUID
) -> Response:
    row = await db.get(Staff, staff_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Staff not found")
    row.is_active = False
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
