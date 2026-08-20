"""Lightweight intent detection — keywords + Gemini/OpenAI fallback."""

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


def normalize_pl(text: str) -> str:
    """Normalize text by lowering and removing Polish diacritics."""
    t = text.lower().strip().strip("!?.🙂😊👋 \t\n\r")
    mapping = {
        "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n",
        "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    }
    for k, v in mapping.items():
        t = t.replace(k, v)
    return t


# Exact short greetings
GREETING_EXACT = {
    "czesc", "hej", "hejka", "heja", "hello", "hi", "yo", "elo", "eloo",
    "siema", "siemka", "siemanko", "siemano", "witam", "witaj",
    "dzien dobry", "dobry", "dobry wieczor", "good morning", "hey",
}

BOOKING_KEYWORDS = {
    # Ogólne rezerwacje i umawianie
    "umow", "rezerw", "wizyt", "termin", "spotkan", "konsultac", "sesj", "zapis",
    "potrzebuj", "chce", "chcial", "wolne", "wolny", "godzin", "kiedy mozna",
    "przyjsc", "book", "appointment", "wolne terminy", "zapisac", "zapisz",
    # Warsztat / Serwis / Auto / Montaż:
    "wymian", "opon", "olej", "klimatyzac", "przeglad", "serwis", "napraw", "auto",
    "samochod", "diagnostyk", "hamulc", "rozrzad", "blacharz", "lakiernik", "montaz",
    "pomiar", "geometri", "wulkanizac", "usterk",
    # Beauty & Barber & Wellness:
    "strzyz", "wlos", "paznok", "manicur", "pedicur", "masaz", "brod", "barber",
    "fryzjer", "farb", "koloryz", "zabieg", "sciac", "obciac", "balejaz", "makijaz",
    "pielegnac", "rzes", "brwi", "depilac", "kosmetycz", "peeling",
    # Zdrowie / Fizjoterapia / Medycyna / Trening:
    "fizjo", "rehabilitac", "trening", "terapi", "badani", "stomatolog", "dentyst",
    "masazysta", "trener", "porad", "diagnoz", "plomb", "konsultacj",
    # Usługi specjalistyczne / Doradztwo / Szkolenia:
    "wycen", "ogledzin", "prawn", "ksiegow", "korepetycj", "lekcj", "kurs", "audyt",
}

CANCEL_KEYWORDS = {
    "anuluj", "odwolaj", "odwolac", "cancel", "rezygnuj", "nie dam rady",
    "nie moge", "zrezygnuj", "anulowac",
}

LIST_KEYWORDS = {
    "moje wizyty", "moja wizyta", "lista wizyt", "kiedy mam", "moje terminy",
    "kiedy wizyta", "jaki mam termin", "kiedy jestem zapisany", "sprawdz termin",
}

WAITLIST_KEYWORDS = {
    "lista oczekujacych", "waitlist", "kolejka", "powiadom jak sie zwolni",
    "zapisz na rezerwe", "gdy bedzie wolne",
}

FEEDBACK_KEYWORDS = {"opinia", "ocena", "feedback", "recenzja", "gwiazdki"}


def detect_intent_keywords(text: str) -> Intent:
    norm = normalize_pl(text)
    collapsed = re.sub(r"(.)\1{2,}", r"\1\1", norm)

    # 1. Action intents have HIGHEST priority
    if any(k in norm for k in CANCEL_KEYWORDS):
        return Intent.cancel
    if any(k in norm for k in LIST_KEYWORDS):
        return Intent.list
    if any(k in norm for k in WAITLIST_KEYWORDS):
        return Intent.waitlist
    if any(k in norm for k in FEEDBACK_KEYWORDS):
        return Intent.feedback
    if any(k in norm for k in BOOKING_KEYWORDS):
        return Intent.booking

    # 2. Check greetings only if no specific booking action was detected
    if collapsed in GREETING_EXACT or norm in GREETING_EXACT:
        return Intent.greeting
    if any(norm.startswith(k) for k in GREETING_EXACT) and len(norm.split()) <= 3:
        return Intent.greeting

    return Intent.faq


async def detect_intent(text: str) -> Intent:
    """Classifies user intent using keyword rules with AI fallback."""
    base = detect_intent_keywords(text)
    if base != Intent.faq:
        return base

    # Try Gemini if API key available
    gemini_key = settings.gemini_api_key.strip()
    if gemini_key:
        try:
            model = settings.gemini_model or "gemini-2.0-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
            async with httpx.AsyncClient(timeout=6.0) as client:
                prompt = (
                    "Sklasyfikuj intencję klienta salonu. Odpowiedz TYLKO jednym słowem z listy: "
                    "greeting, booking, cancel, list, waitlist, feedback, faq.\n\n"
                    f"Wiadomość klienta: {text}"
                )
                resp = await client.post(
                    url,
                    json={
                        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 20},
                    },
                )
                if resp.is_success:
                    data = resp.json()
                    val = (
                        data.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                        .strip()
                        .lower()
                    )
                    for member in Intent:
                        if member.value == val:
                            return member
        except Exception as exc:
            logger.debug("Gemini intent fallback error: %s", exc)

    return base
