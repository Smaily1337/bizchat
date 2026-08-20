"""Salon feature pack migration — staff, deposits, public slug, whatsapp-ready columns.

Revision ID: 0007_salon_features
Revises: 0006_business_licensing
Create Date: 2026-08-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_salon_features"
down_revision: Union[str, None] = "0006_business_licensing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_business_id", "staff", ["business_id"])

    with op.batch_alter_table("businesses") as batch:
        batch.add_column(sa.Column("public_slug", sa.String(length=64), nullable=True))
        batch.add_column(
            sa.Column("deposit_percent", sa.Integer(), nullable=True, server_default="0")
        )
        batch.add_column(sa.Column("stripe_account_id", sa.String(length=255), nullable=True))

    op.create_index("ix_businesses_public_slug", "businesses", ["public_slug"], unique=True)

    with op.batch_alter_table("appointments") as batch:
        batch.add_column(sa.Column("staff_id", sa.Uuid(), nullable=True))
        batch.add_column(
            sa.Column("deposit_amount", sa.Numeric(10, 2), nullable=True)
        )
        batch.add_column(
            sa.Column(
                "deposit_status",
                sa.String(length=32),
                nullable=True,
                server_default="none",
            )
        )
        batch.add_column(
            sa.Column("stripe_checkout_session_id", sa.String(length=255), nullable=True)
        )
        batch.create_foreign_key(
            "fk_appointments_staff_id",
            "staff",
            ["staff_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_index("ix_appointments_staff_id", "appointments", ["staff_id"])


def downgrade() -> None:
    op.drop_index("ix_appointments_staff_id", table_name="appointments")
    with op.batch_alter_table("appointments") as batch:
        batch.drop_constraint("fk_appointments_staff_id", type_="foreignkey")
        batch.drop_column("stripe_checkout_session_id")
        batch.drop_column("deposit_status")
        batch.drop_column("deposit_amount")
        batch.drop_column("staff_id")

    op.drop_index("ix_businesses_public_slug", table_name="businesses")
    with op.batch_alter_table("businesses") as batch:
        batch.drop_column("stripe_account_id")
        batch.drop_column("deposit_percent")
        batch.drop_column("public_slug")

    op.drop_index("ix_staff_business_id", table_name="staff")
    op.drop_table("staff")
