"""BizChat FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from collections.abc import AsyncIterator

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    analytics,
    appointments,
    auth,
    business,
    calendar,
    customers,
    dashboard,
    hours,
    inbox,
    knowledge,
    notifications,
    payments,
    platform,
    public_booking,
    services,
    staff,
    tags,
    users,
    ws,
)
from app.api.feedback_waitlist import feedback_router, waitlist_router
from app.api.webhooks import meta_router, telegram_router, whatsapp_router, widget_router
from app.config import settings
from app.db.session import engine
from app.schemas import HealthResponse
from app.workers.reminders import reminder_loop


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if settings.auto_migrate or settings.auto_seed:
        from app.scripts.bootstrap import bootstrap

        await bootstrap()
    reminders_task = asyncio.create_task(reminder_loop())
    yield
    reminders_task.cancel()
    with suppress(asyncio.CancelledError):
        await reminders_task
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(platform.router)
app.include_router(analytics.router)
app.include_router(appointments.router)
app.include_router(calendar.router)
app.include_router(dashboard.router)
app.include_router(business.router)
app.include_router(services.router)
app.include_router(staff.router)
app.include_router(customers.router)
app.include_router(tags.router)
app.include_router(hours.router)
app.include_router(knowledge.router)
app.include_router(feedback_router)
app.include_router(waitlist_router)
app.include_router(inbox.router)
app.include_router(notifications.router)
app.include_router(public_booking.router)
app.include_router(payments.router)
app.include_router(ws.router)
app.include_router(telegram_router)
app.include_router(meta_router)
app.include_router(whatsapp_router)
app.include_router(widget_router)

_widget_candidates = [
    Path(__file__).resolve().parents[1] / "widget",  # Docker: /app/widget
    Path(__file__).resolve().parents[2] / "widget",  # Local monorepo: ../widget
]
_widget_dir = next((p for p in _widget_candidates if p.is_dir()), None)
if _widget_dir is not None:
    app.mount("/widget", StaticFiles(directory=str(_widget_dir), html=True), name="widget")


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root() -> str:
    """Friendly landing for browsers hitting the API port by mistake."""
    return """<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Automovia API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.5; color: #1a1a1a; }
    h1 { font-size: 1.35rem; margin-bottom: 0.5rem; }
    code { background: #f3f3f3; padding: 0.1em 0.35em; border-radius: 4px; }
    ul { padding-left: 1.2rem; }
    a { color: #0b57d0; }
  </style>
</head>
<body>
  <h1>Automovia API</h1>
  <p>To jest backend (FastAPI), nie panel administracyjny.</p>
  <ul>
    <li>Panel admin (Liquid Glass): <a href="http://localhost:5173/">http://localhost:5173/</a></li>
    <li>Dokumentacja API: <a href="/docs">/docs</a></li>
    <li>Health check: <a href="/health">/health</a></li>
    <li>Widget demo: otwórz <code>widget/index.html</code></li>
  </ul>
</body>
</html>
"""


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
    )
