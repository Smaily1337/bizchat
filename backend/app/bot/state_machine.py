"""Conversation state transitions for booking / FAQ flows."""

from __future__ import annotations

from app.models.enums import ConversationState


def next_state(current: ConversationState, intent: str) -> ConversationState:
    if intent == "booking":
        return ConversationState.booking
    if intent == "waitlist":
        return ConversationState.waitlist
    if intent == "feedback":
        return ConversationState.feedback
    if intent == "faq":
        return ConversationState.faq
    if intent in {"greeting", "cancel", "list"}:
        return ConversationState.idle
    return current


def booking_step(context: dict) -> str:
    return str(context.get("booking_step") or "pick_service")
