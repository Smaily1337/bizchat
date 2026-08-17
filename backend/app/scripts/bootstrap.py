"""Bootstrap DB on container start: migrate/create tables + seed demo."""

from __future__ import annotations

import asyncio
import logging
import subprocess
import sys
from pathlib import Path

from sqlalchemy import select, text

from app.config import settings
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
import app.models  # noqa: F401 — register metadata
from app.models import Owner

logger = logging.getLogger("bizchat.bootstrap")
BACKEND_ROOT = Path(__file__).resolve().parents[2]


async def _sqlite_prepare() -> None:
    async with engine.begin() as conn:
        # DELETE journal — WAL/-shm breaks on GCS FUSE (Cloud Run volume).
        await conn.execute(text("PRAGMA journal_mode=DELETE"))
        await conn.execute(text("PRAGMA synchronous=FULL"))
        await conn.execute(text("PRAGMA temp_store=MEMORY"))
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(Base.metadata.create_all)

    async with engine.begin() as conn:
        cols = (
            await conn.execute(text("PRAGMA table_info(owners)"))
        ).mappings().all()
        existing = {c["name"] for c in cols}
        alters: list[str] = []
        if "name" not in existing:
            alters.append("ALTER TABLE owners ADD COLUMN name VARCHAR(255)")
        if "role" not in existing:
            alters.append(
                "ALTER TABLE owners ADD COLUMN role VARCHAR(32) DEFAULT 'owner'"
            )
        if "email_verified" not in existing:
            alters.append(
                "ALTER TABLE owners ADD COLUMN email_verified BOOLEAN DEFAULT 0"
            )
        if "email_verification_token" not in existing:
            alters.append(
                "ALTER TABLE owners ADD COLUMN email_verification_token VARCHAR(128)"
            )
        if "google_sub" not in existing:
            alters.append("ALTER TABLE owners ADD COLUMN google_sub VARCHAR(255)")
        if "is_active" not in existing:
            alters.append(
                "ALTER TABLE owners ADD COLUMN is_active BOOLEAN DEFAULT 1"
            )
        if "is_platform_admin" not in existing:
            alters.append(
                "ALTER TABLE owners ADD COLUMN is_platform_admin BOOLEAN DEFAULT 0"
            )
        for stmt in alters:
            await conn.execute(text(stmt))

        biz_cols = (
            await conn.execute(text("PRAGMA table_info(businesses)"))
        ).mappings().all()
        biz_existing = {c["name"] for c in biz_cols}
        biz_alters: list[str] = []
        if "plan" not in biz_existing:
            biz_alters.append(
                "ALTER TABLE businesses ADD COLUMN plan VARCHAR(32) DEFAULT 'free'"
            )
        if "license_status" not in biz_existing:
            biz_alters.append(
                "ALTER TABLE businesses ADD COLUMN license_status VARCHAR(32) "
                "DEFAULT 'trial'"
            )
        if "license_expires_at" not in biz_existing:
            biz_alters.append(
                "ALTER TABLE businesses ADD COLUMN license_expires_at DATETIME"
            )
        if "max_appointments_month" not in biz_existing:
            biz_alters.append(
                "ALTER TABLE businesses ADD COLUMN max_appointments_month INTEGER"
            )
        if "max_messages_month" not in biz_existing:
            biz_alters.append(
                "ALTER TABLE businesses ADD COLUMN max_messages_month INTEGER"
            )
        if "max_seats" not in biz_existing:
            biz_alters.append("ALTER TABLE businesses ADD COLUMN max_seats INTEGER")
        if "enabled_channels" not in biz_existing:
            biz_alters.append("ALTER TABLE businesses ADD COLUMN enabled_channels JSON")
        for stmt in biz_alters:
            await conn.execute(text(stmt))
        if biz_alters:
            await conn.execute(
                text(
                    """
                    UPDATE businesses SET
                      plan = COALESCE(plan, 'free'),
                      license_status = COALESCE(license_status, 'active'),
                      max_appointments_month = COALESCE(max_appointments_month, 30),
                      max_messages_month = COALESCE(max_messages_month, 200),
                      max_seats = COALESCE(max_seats, 2),
                      enabled_channels = COALESCE(
                        enabled_channels, '["widget","admin"]'
                      )
                    """
                )
            )


def _alembic_upgrade() -> None:
    subprocess.check_call(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_ROOT),
    )


async def _ensure_owner_columns_pg() -> None:
    stmts = [
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS name VARCHAR(255)",
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'owner'",
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(128)",
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255)",
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan VARCHAR(32) DEFAULT 'free'",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS license_status VARCHAR(32) DEFAULT 'trial'",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_appointments_month INTEGER",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_messages_month INTEGER",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_seats INTEGER",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS enabled_channels JSONB",
    ]
    async with engine.begin() as conn:
        for stmt in stmts:
            try:
                await conn.execute(text(stmt))
            except Exception as exc:  # noqa: BLE001
                logger.warning("PG alter skipped: %s (%s)", stmt, exc)


async def bootstrap() -> None:
    if settings.auto_migrate:
        if settings.is_sqlite:
            logger.info("SQLite: create_all + PRAGMA")
            await _sqlite_prepare()
        else:
            logger.info("PostgreSQL: alembic upgrade head")
            try:
                _alembic_upgrade()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Alembic failed (%s) — falling back to create_all", exc)
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
            await _ensure_owner_columns_pg()

    if settings.auto_seed:
        from app.scripts.seed import seed

        await seed()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(bootstrap())


if __name__ == "__main__":
    main()
