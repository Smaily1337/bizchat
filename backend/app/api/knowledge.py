"""Knowledge base CRUD (FAQ for bot)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import CurrentOwner, DbSession
from app.models import KnowledgeItem
from app.schemas import KnowledgeCreate, KnowledgeOut, KnowledgeUpdate

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeOut])
async def list_knowledge(db: DbSession, owner: CurrentOwner) -> list[KnowledgeItem]:
    result = await db.execute(
        select(KnowledgeItem)
        .where(KnowledgeItem.business_id == owner.business_id)
        .order_by(KnowledgeItem.category.nulls_last(), KnowledgeItem.question)
    )
    return list(result.scalars().all())


@router.post("", response_model=KnowledgeOut, status_code=status.HTTP_201_CREATED)
async def create_knowledge(
    db: DbSession,
    owner: CurrentOwner,
    body: KnowledgeCreate,
) -> KnowledgeItem:
    item = KnowledgeItem(
        business_id=owner.business_id,
        category=body.category,
        question=body.question,
        answer=body.answer,
    )
    db.add(item)
    await db.flush()
    return item


@router.patch("/{item_id}", response_model=KnowledgeOut)
async def update_knowledge(
    db: DbSession,
    owner: CurrentOwner,
    item_id: UUID,
    body: KnowledgeUpdate,
) -> KnowledgeItem:
    item = await db.get(KnowledgeItem, item_id)
    if item is None or item.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.flush()
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge(
    db: DbSession,
    owner: CurrentOwner,
    item_id: UUID,
) -> Response:
    item = await db.get(KnowledgeItem, item_id)
    if item is None or item.business_id != owner.business_id:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    await db.delete(item)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
