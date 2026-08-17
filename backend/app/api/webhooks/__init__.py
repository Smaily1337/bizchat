"""Inbound channel webhooks."""

from app.api.webhooks.meta import router as meta_router
from app.api.webhooks.telegram import router as telegram_router
from app.api.webhooks.whatsapp import router as whatsapp_router
from app.api.webhooks.widget import router as widget_router

__all__ = [
    "meta_router",
    "telegram_router",
    "whatsapp_router",
    "widget_router",
]
