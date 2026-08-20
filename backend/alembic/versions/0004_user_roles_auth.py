"""Add user roles and auth columns to owners.

Revision ID: 0004_user_roles_auth
Revises: 0003_customer_email
Create Date: 2026-08-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_user_roles_auth"
down_revision = "0003_customer_email"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("owners", sa.Column("name", sa.String(length=255), nullable=True))
    op.add_column(
        "owners",
        sa.Column("role", sa.String(length=32), nullable=False, server_default="owner"),
    )
    op.add_column(
        "owners",
        sa.Column(
            "email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "owners",
        sa.Column("email_verification_token", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "owners", sa.Column("google_sub", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "owners",
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )
    op.create_unique_constraint("uq_owners_google_sub", "owners", ["google_sub"])
    # Demo owner is considered verified
    op.execute(
        "UPDATE owners SET email_verified = true WHERE email = 'owner@bizchat.local'"
    )


def downgrade() -> None:
    op.drop_constraint("uq_owners_google_sub", "owners", type_="unique")
    op.drop_column("owners", "is_active")
    op.drop_column("owners", "google_sub")
    op.drop_column("owners", "email_verification_token")
    op.drop_column("owners", "email_verified")
    op.drop_column("owners", "role")
    op.drop_column("owners", "name")
