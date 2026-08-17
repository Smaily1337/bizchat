"""Unit tests for natural Polish date parsing."""

from __future__ import annotations

from datetime import date

from app.bot.dates import format_day_pl, parse_date_phrase, parse_month_only


TODAY = date(2026, 8, 17)  # Monday


def test_iso():
    assert parse_date_phrase("2026-08-23", today=TODAY) == date(2026, 8, 23)


def test_relative():
    assert parse_date_phrase("jutro", today=TODAY) == date(2026, 8, 18)
    assert parse_date_phrase("pojutrze", today=TODAY) == date(2026, 8, 19)
    assert parse_date_phrase("dziś", today=TODAY) == TODAY
    assert parse_date_phrase("za 3 dni", today=TODAY) == date(2026, 8, 20)


def test_polish_day_month():
    assert parse_date_phrase("23 sierpnia", today=TODAY) == date(2026, 8, 23)
    assert parse_date_phrase("15 grudnia", today=TODAY) == date(2026, 12, 15)
    assert parse_date_phrase("5 marca 2027", today=TODAY) == date(2027, 3, 5)


def test_dotted():
    assert parse_date_phrase("23.08", today=TODAY) == date(2026, 8, 23)
    assert parse_date_phrase("15.12.2026", today=TODAY) == date(2026, 12, 15)
    assert parse_date_phrase("15/12", today=TODAY) == date(2026, 12, 15)


def test_weekday():
    # TODAY is Monday 2026-08-17 → next Friday is 2026-08-21
    assert parse_date_phrase("piątek", today=TODAY) == date(2026, 8, 21)
    assert parse_date_phrase("w poniedziałek", today=TODAY) == date(2026, 8, 24)


def test_month_only():
    assert parse_month_only("grudzień", today=TODAY) == (2026, 12)
    assert parse_month_only("grudzien", today=TODAY) == (2026, 12)
    assert parse_month_only("na grudzień", today=TODAY) == (2026, 12)
    # Past month in year → next year
    assert parse_month_only("marzec", today=TODAY) == (2027, 3)
    # Day+month should NOT be month-only
    assert parse_month_only("15 grudnia", today=TODAY) is None


def test_past_day_rolls_year():
    # 5 marca when today is August → next year
    assert parse_date_phrase("5 marca", today=TODAY) == date(2027, 3, 5)


def test_format_pl():
    assert "sierpnia" in format_day_pl(date(2026, 8, 23))
    assert "poniedziałek" in format_day_pl(date(2026, 8, 17))
