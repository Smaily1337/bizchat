"""Lightweight intent detection — keywords + optional OpenAI."""

from __future__ import annotations

import json
import logging
import re
from enum import Enum

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class Intent(str, Enum):
    faq = "faq"
    booking = "booking"
    cancel = "cancel"
    list = "list"
    greeting = "greeting"
    waitlist = "waitlist"
    feedback = "feedback"
    unknown = "unknown"


# Exact / near-exact short greetings (slang included)
GREETING_EXACT = {
    "cześć",
    "czesc",
    "cześć!",
    "czesc!",
    "hej",
    "hej!",
    "hejka",
    "heja",
    "hello",
    "hi",
    "yo",
    "elo",
    "eloo",
    "elooo",
    "siema",
    "siemka",
    "siemanko",
    "siemano",
    "witam",
    "witaj",
    "dzień dobry",
    "dzien dobry",
    "dobry",
    "dobry wieczór",
    "dobry wieczor",
    "good morning",
    "hey",
}

GREETING_KEYWORDS = GREETING_EXACT | {
    "dzień dobry",
    "dzien dobry",
}
BOOKING_KEYWORDS = {
    "rezerwuj",
    "umów",
    "umow",
    "termin",
    "wizyta",
    "book",
    "appointment",
    "zarezerwuj",
}
CANCEL_KEYWORDS = {"anuluj", "odwołaj", "odwolaj", "cancel", "rezygnuję", "rezygnuje"}
LIST_KEYWORDS = {"moje wizyty", "moja wizyta", "lista wizyt", "kiedy mam", "moje terminy"}
WAITLIST_KEYWORDS = {"lista oczekujących", "waitlist", "kolejka", "wolny termin"}
FEEDBACK_KEYWORDS = {"opinia", "ocena", "feedback", "recenzja"}


def detect_intent_keywords(text: str) -> Intent:
    lowered = text.lower().strip().strip("!?.🙂😊👋")
    # Normalize repeated letters in slang: elooo → elo, hejjj → hej
    collapsed = re.sub(r"(.)\1{2,}", r"\1\1", lowered)

    if collapsed in GREETING_EXACT or lowered in GREETING_EXACT:
        return Intent.greeting
    if any(k in lowered for k in GREETING_KEYWORDS):
        return Intent.greeting
    if any(k in lowered for k in CANCEL_KEYWORDS):
        return Intent.cancel
    if any(k in lowered for k in LIST_KEYWORDS):
        return Intent.list
    if any(k in lowered for k in WAITLIST_KEYWORDS):
        return Intent.waitlist
    if any(k in lowered for k in FEEDBACK_KEYWORDS):
        return Intent.feedback
    if any(k in lowered for k in BOOKING_KEYWORDS):
        return Intent.booking
    return Intent.faq


async def detect_intent(text: str) -> Intent:
    """Rule-based first; OpenAI only if key set and keywords are ambiguous (faq)."""
    base = detect_intent_keywords(text)
    if base != Intent.faq or not settings.openai_api_key:
        return base

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "temperature": 0,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Classify the user message for a salon booking bot. "
                                "Reply JSON only: {\"intent\": one of "
                                "greeting,booking,cancel,list,waitlist,feedback,faq}."
                            ),
                        },
                        {"role": "user", "content": text},
                    ],
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            value = str(data.get("intent", "faq")).lower()
            return Intent(value) if value in Intent.__members__ else Intent.faq
    except Exception as exc:  # noqa: BLE001 — graceful fallback
        logger.debug("OpenAI intent fallback: %s", exc)
        return base
