"""Add owners.avatar_url for team photos.

Revision ID: 0006_owner_avatar
Revises: 0005_platform_admin_pageviews
Create Date: 2026-08-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_owner_avatar"
down_revision = "0005_platform_admin_pageviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("owners", sa.Column("avatar_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("owners", "avatar_url")
