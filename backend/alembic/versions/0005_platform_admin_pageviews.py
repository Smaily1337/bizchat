"""Add is_platform_admin + pageviews table.

Revision ID: 0005_platform_admin_pageviews
Revises: 0004_user_roles_auth
Create Date: 2026-08-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_platform_admin_pageviews"
down_revision = "0004_user_roles_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "owners",
        sa.Column(
            "is_platform_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_table(
        "pageviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("referrer", sa.String(length=1024), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_pageviews_created_at", "pageviews", ["created_at"])
    op.create_index("ix_pageviews_path", "pageviews", ["path"])


def downgrade() -> None:
    op.drop_index("ix_pageviews_path", table_name="pageviews")
    op.drop_index("ix_pageviews_created_at", table_name="pageviews")
    op.drop_table("pageviews")
    op.drop_column("owners", "is_platform_admin")
