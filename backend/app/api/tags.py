"""Customer tags CRUD + assign to customers."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentOwner, DbSession
from app.models import Customer, Tag
from app.schemas import ORMModel

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagOut(ORMModel):
    id: UUID
    business_id: UUID
    name: str
    color: str | None = None


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    color: str | None = Field(default=None, max_length=32)


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    color: str | None = None


class AssignTagsBody(BaseModel):
    tag_ids: list[UUID] = Field(default_factory=list)


@router.get("", response_model=list[TagOut])
async def list_tags(db: DbSession, owner: CurrentOwner) -> list[Tag]:
    result = await db.execute(
        select(Tag)
        .where(Tag.business_id == owner.business_id)
        .order_by(Tag.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    db: DbSession, owner: CurrentOwner, body: TagCreate
) -> Tag:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nazwa tagu jest wymagana")
    existing = (
        await db.execute(
            select(Tag).where(
                Tag.business_id == owner.business_id,
                Tag.name == name,
            )
        )
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag o tej nazwie już istnieje")
    row = Tag(
        business_id=owner.business_id,
        name=name,
        color=(body.color or "").strip() or None,
    )
    db.add(row)
    await db.flush()
    return row


@router.patch("/{tag_id}", response_model=TagOut)
async def update_tag(
    db: DbSession, owner: CurrentOwner, tag_id: UUID, body: TagUpdate
) -> Tag:
    row = await db.get(Tag, tag_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Tag not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="Nazwa tagu jest wymagana")
        clash = (
            await db.execute(
                select(Tag).where(
                    Tag.business_id == owner.business_id,
                    Tag.name == name,
                    Tag.id != tag_id,
                )
            )
        ).scalars().first()
        if clash:
            raise HTTPException(status_code=409, detail="Tag o tej nazwie już istnieje")
        data["name"] = name
    if "color" in data and isinstance(data["color"], str):
        data["color"] = data["color"].strip() or None
    for k, v in data.items():
        setattr(row, k, v)
    await db.flush()
    return row


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    db: DbSession, owner: CurrentOwner, tag_id: UUID
) -> Response:
    row = await db.get(Tag, tag_id)
    if row is None or row.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(row)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/customers/{customer_id}", response_model=list[TagOut])
async def set_customer_tags(
    db: DbSession,
    owner: CurrentOwner,
    customer_id: UUID,
    body: AssignTagsBody,
) -> list[Tag]:
    customer = (
        await db.execute(
            select(Customer)
            .where(
                Customer.id == customer_id,
                Customer.business_id == owner.business_id,
            )
            .options(selectinload(Customer.tags))
        )
    ).scalars().first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    tags: list[Tag] = []
    if body.tag_ids:
        tags = list(
            (
                await db.execute(
                    select(Tag).where(
                        Tag.business_id == owner.business_id,
                        Tag.id.in_(body.tag_ids),
                    )
                )
            ).scalars().all()
        )
        if len(tags) != len(set(body.tag_ids)):
            raise HTTPException(status_code=400, detail="Nieprawidłowy tag")
    customer.tags = tags
    await db.flush()
    return tags
