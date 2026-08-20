"""Customer tags — custom labels per business.

Revision ID: 0008_customer_tags
Revises: 0007_salon_features
Create Date: 2026-08-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_customer_tags"
down_revision: Union[str, None] = "0007_salon_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("business_id", "name", name="uq_tags_business_name"),
    )
    op.create_index("ix_tags_business_id", "tags", ["business_id"])

    op.create_table(
        "customer_tags",
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("customer_id", "tag_id"),
    )


def downgrade() -> None:
    op.drop_table("customer_tags")
    op.drop_index("ix_tags_business_id", table_name="tags")
    op.drop_table("tags")
