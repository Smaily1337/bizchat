"""Natural-language Polish date parsing for the booking bot."""

from __future__ import annotations

import re
from datetime import date, timedelta

MONTHS: dict[str, int] = {
    "stycznia": 1,
    "styczeń": 1,
    "styczen": 1,
    "sty": 1,
    "lutego": 2,
    "luty": 2,
    "lut": 2,
    "marca": 3,
    "marzec": 3,
    "mar": 3,
    "kwietnia": 4,
    "kwiecień": 4,
    "kwiecien": 4,
    "kwi": 4,
    "maja": 5,
    "maj": 5,
    "czerwca": 6,
    "czerwiec": 6,
    "cze": 6,
    "lipca": 7,
    "lipiec": 7,
    "lip": 7,
    "sierpnia": 8,
    "sierpień": 8,
    "sierpien": 8,
    "sie": 8,
    "września": 9,
    "wrzesnia": 9,
    "wrzesień": 9,
    "wrzesien": 9,
    "wrz": 9,
    "października": 10,
    "pazdziernika": 10,
    "październik": 10,
    "pazdziernik": 10,
    "paź": 10,
    "paz": 10,
    "listopada": 11,
    "listopad": 11,
    "lis": 11,
    "grudnia": 12,
    "grudzień": 12,
    "grudzien": 12,
    "gru": 12,
}

WEEKDAYS: dict[str, int] = {
    "poniedziałek": 0,
    "poniedzialek": 0,
    "pon": 0,
    "wtorek": 1,
    "wt": 1,
    "środa": 2,
    "sroda": 2,
    "śr": 2,
    "sr": 2,
    "czwartek": 3,
    "czw": 3,
    "piątek": 4,
    "piatek": 4,
    "pt": 4,
    "sobota": 5,
    "sob": 5,
    "niedziela": 6,
    "nd": 6,
    "ndz": 6,
}

ISO_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
DOT_RE = re.compile(r"\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b")
DAY_MONTH_RE = re.compile(
    r"\b(\d{1,2})\s+(?:"
    + "|".join(re.escape(m) for m in sorted(MONTHS, key=len, reverse=True))
    + r")(?:\s+(\d{4}))?\b",
    re.IGNORECASE,
)
RELATIVE_DAYS_RE = re.compile(r"\bza\s+(\d{1,3})\s+dn", re.IGNORECASE)


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _year_for_month(month: int, day: int, today: date) -> int:
    """Pick current or next year so the date is not in the past."""
    candidate = _safe_date(today.year, month, day)
    if candidate is None:
        return today.year
    if candidate < today:
        return today.year + 1
    return today.year


def parse_month_only(text: str, *, today: date | None = None) -> tuple[int, int] | None:
    """If user named only a month (e.g. 'grudzień'), return (year, month)."""
    today = today or date.today()
    lowered = text.lower().strip().strip("!?.")
    # Exact month word / short form
    for name, month in MONTHS.items():
        if lowered == name or lowered == f"w {name}" or lowered == f"na {name}":
            year = today.year if month >= today.month else today.year + 1
            return year, month
    # "w grudniu", "na grudzień" etc. without a day number
    if re.search(r"\b\d{1,2}\b", lowered):
        return None
    for name, month in sorted(MONTHS.items(), key=lambda x: -len(x[0])):
        if len(name) < 3:
            continue
        if re.search(rf"\b{re.escape(name)}\b", lowered):
            year = today.year if month >= today.month else today.year + 1
            return year, month
    return None


def parse_date_phrase(text: str, *, today: date | None = None) -> date | None:
    """Parse a single calendar day from free-form Polish / ISO text."""
    today = today or date.today()
    raw = text.strip()
    lowered = raw.lower().strip()

    if lowered in {"dziś", "dzis", "dzisiaj", "today"}:
        return today
    if lowered in {"jutro", "tomorrow"}:
        return today + timedelta(days=1)
    if lowered in {"pojutrze"}:
        return today + timedelta(days=2)

    m = RELATIVE_DAYS_RE.search(lowered)
    if m:
        return today + timedelta(days=int(m.group(1)))

    m = ISO_RE.search(raw)
    if m:
        return _safe_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))

    m = DAY_MONTH_RE.search(lowered)
    if m:
        day_n = int(m.group(1))
        # Extract month token from the match span
        span = m.group(0)
        month = None
        for name, num in sorted(MONTHS.items(), key=lambda x: -len(x[0])):
            if name in span:
                month = num
                break
        if month is None:
            return None
        year = int(m.group(2)) if m.group(2) else _year_for_month(month, day_n, today)
        return _safe_date(year, month, day_n)

    m = DOT_RE.search(raw)
    if m:
        day_n, month_n = int(m.group(1)), int(m.group(2))
        year_raw = m.group(3)
        if year_raw:
            year = int(year_raw)
            if year < 100:
                year += 2000
        else:
            year = _year_for_month(month_n, day_n, today)
        return _safe_date(year, month_n, day_n)

    # Next weekday: "w poniedziałek", "w piątek"
    for name, weekday in sorted(WEEKDAYS.items(), key=lambda x: -len(x[0])):
        if re.search(rf"\b{re.escape(name)}\b", lowered):
            delta = (weekday - today.weekday()) % 7
            if delta == 0:
                delta = 7  # "w poniedziałek" on Monday → next week
            if "ten" in lowered or "najbliższ" in lowered or "najblizsz" in lowered:
                delta = (weekday - today.weekday()) % 7
                if delta == 0:
                    delta = 0  # today if matching
            return today + timedelta(days=delta)

    return None


def format_day_pl(d: date) -> str:
    months = [
        "",
        "stycznia",
        "lutego",
        "marca",
        "kwietnia",
        "maja",
        "czerwca",
        "lipca",
        "sierpnia",
        "września",
        "października",
        "listopada",
        "grudnia",
    ]
    weekdays = [
        "poniedziałek",
        "wtorek",
        "środa",
        "czwartek",
        "piątek",
        "sobota",
        "niedziela",
    ]
    return f"{weekdays[d.weekday()]}, {d.day} {months[d.month]} {d.year}"
