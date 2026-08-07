"""notifications module: templates, settings, log

Revision ID: 0002_notifications
Revises: 0001_initial
Create Date: 2026-08-07

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_notifications"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

notification_channel_enum = postgresql.ENUM(
    "sms",
    "email",
    "telegram",
    "widget",
    name="notification_channel_enum",
    create_type=False,
)
notification_kind_enum = postgresql.ENUM(
    "reminder",
    "custom",
    "waitlist",
    "feedback",
    name="notification_kind_enum",
    create_type=False,
)
notification_status_enum = postgresql.ENUM(
    "sent",
    "failed",
    name="notification_status_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    notification_channel_enum.create(bind, checkfirst=True)
    notification_kind_enum.create(bind, checkfirst=True)
    notification_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "notification_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", notification_kind_enum, server_default="custom", nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
    op.create_index(
        "ix_notification_templates_business_id",
        "notification_templates",
        ["business_id"],
    )

    op.create_table(
        "notification_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "reminders_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "lead_times_min",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[1440, 120, 30]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "max_per_appointment",
            sa.Integer(),
            server_default="3",
            nullable=False,
        ),
        sa.Column(
            "default_channel",
            notification_channel_enum,
            server_default="sms",
            nullable=False,
        ),
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

    op.create_table(
        "notification_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "appointment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("channel", notification_channel_enum, server_default="sms", nullable=False),
        sa.Column("kind", notification_kind_enum, server_default="custom", nullable=False),
        sa.Column("status", notification_status_enum, server_default="sent", nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("provider", sa.String(64), server_default="mock", nullable=False),
        sa.Column("lead_time_min", sa.Integer(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index(
        "ix_notification_logs_business_created",
        "notification_logs",
        ["business_id", "created_at"],
    )
    op.create_index(
        "ix_notification_logs_appointment_kind",
        "notification_logs",
        ["appointment_id", "kind", "lead_time_min"],
    )


def downgrade() -> None:
    op.drop_index("ix_notification_logs_appointment_kind", table_name="notification_logs")
    op.drop_index("ix_notification_logs_business_created", table_name="notification_logs")
    op.drop_table("notification_logs")
    op.drop_table("notification_settings")
    op.drop_index(
        "ix_notification_templates_business_id", table_name="notification_templates"
    )
    op.drop_table("notification_templates")

    bind = op.get_bind()
    notification_status_enum.drop(bind, checkfirst=True)
    notification_kind_enum.drop(bind, checkfirst=True)
    notification_channel_enum.drop(bind, checkfirst=True)
