"""Add business licensing + usage limit columns.

Revision ID: 0006_business_licensing
Revises: 0005_platform_admin_pageviews
Create Date: 2026-08-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_business_licensing"
down_revision = "0005_platform_admin_pageviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column(
            "plan",
            sa.String(length=32),
            nullable=False,
            server_default="free",
        ),
    )
    op.add_column(
        "businesses",
        sa.Column(
            "license_status",
            sa.String(length=32),
            nullable=False,
            server_default="trial",
        ),
    )
    op.add_column(
        "businesses",
        sa.Column("license_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column("max_appointments_month", sa.Integer(), nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column("max_messages_month", sa.Integer(), nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column("max_seats", sa.Integer(), nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column("enabled_channels", sa.JSON(), nullable=True),
    )
    # Seed sensible free-tier defaults for existing rows
    op.execute(
        """
        UPDATE businesses SET
          plan = COALESCE(plan, 'free'),
          license_status = COALESCE(license_status, 'active'),
          max_appointments_month = COALESCE(max_appointments_month, 30),
          max_messages_month = COALESCE(max_messages_month, 200),
          max_seats = COALESCE(max_seats, 2),
          enabled_channels = COALESCE(enabled_channels, '["widget","admin"]')
        """
    )


def downgrade() -> None:
    op.drop_column("businesses", "enabled_channels")
    op.drop_column("businesses", "max_seats")
    op.drop_column("businesses", "max_messages_month")
    op.drop_column("businesses", "max_appointments_month")
    op.drop_column("businesses", "license_expires_at")
    op.drop_column("businesses", "license_status")
    op.drop_column("businesses", "plan")
