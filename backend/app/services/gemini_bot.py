"""Google Gemini AI Bot Assistant for multi-channel salon booking & CRM."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import (
    Appointment,
    AppointmentStatus,
    Business,
    Conversation,
    Customer,
    KnowledgeItem,
    Message,
    Service,
    WorkingHours,
)
from app.models.enums import Channel, MessageRole
from app.models.mixins import utc_now
from app.services import availability, booking

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

GEMINI_TOOLS = [
    {
        "function_declarations": [
            {
                "name": "get_services_list",
                "description": "Zwraca aktualną listę usług, zabiegów, ich czas trwania i ceny w salonie.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {},
                },
            },
            {
                "name": "check_available_slots",
                "description": "Sprawdza wolne godziny i terminy dla wybranej usługi w podanym dniu.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "service_name": {
                            "type": "STRING",
                            "description": "Nazwa usługi np. Strzyżenie męskie, Koloryzacja",
                        },
                        "date_str": {
                            "type": "STRING",
                            "description": "Data w formacie YYYY-MM-DD (np. 2026-08-21)",
                        },
                    },
                    "required": ["service_name", "date_str"],
                },
            },
            {
                "name": "book_appointment",
                "description": "Dokonuje rezerwacji wizyty w kalendarzu na podaną datę i godzinę.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "service_name": {
                            "type": "STRING",
                            "description": "Dokładna nazwa usługi",
                        },
                        "date_str": {
                            "type": "STRING",
                            "description": "Data w formacie YYYY-MM-DD",
                        },
                        "time_str": {
                            "type": "STRING",
                            "description": "Godzina w formacie HH:MM (np. 14:30)",
                        },
                        "notes": {
                            "type": "STRING",
                            "description": "Dodatkowe uwagi lub preferencje klienta",
                        },
                    },
                    "required": ["service_name", "date_str", "time_str"],
                },
            },
            {
                "name": "cancel_appointment",
                "description": "Odwołuje / anuluje najbliższą aktywną wizytę klienta.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "reason": {
                            "type": "STRING",
                            "description": "Powód anulowania podany przez klienta",
                        }
                    },
                },
            },
            {
                "name": "reschedule_appointment",
                "description": "Przekłada istniejącą wizytę na nowy termin lub godzinę.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "new_date_str": {
                            "type": "STRING",
                            "description": "Nowa data w formacie YYYY-MM-DD",
                        },
                        "new_time_str": {
                            "type": "STRING",
                            "description": "Nowa godzina w formacie HH:MM",
                        },
                    },
                    "required": ["new_date_str", "new_time_str"],
                },
            },
        ]
    }
]


async def _execute_tool_call(
    name: str,
    args: dict[str, Any],
    *,
    db: AsyncSession,
    business: Business,
    customer: Customer,
    channel: Channel,
) -> dict[str, Any]:
    """Execute the tool called by Gemini."""
    tz = ZoneInfo(business.timezone or "Europe/Warsaw")

    if name == "get_services_list":
        res = await db.execute(
            select(Service)
            .where(Service.business_id == business.id, Service.is_active == True)
        )
        services = res.scalars().all()
        return {
            "services": [
                {
                    "id": str(s.id),
                    "name": s.name,
                    "price_pln": float(s.price_cents) / 100.0 if s.price_cents else 0,
                    "duration_min": s.duration_min,
                    "description": s.description or "",
                }
                for s in services
            ]
        }

    if name == "check_available_slots":
        service_name = str(args.get("service_name", "")).strip().lower()
        date_str = str(args.get("date_str", "")).strip()

        # Parse date
        try:
            day = date.fromisoformat(date_str)
        except Exception:
            return {"error": "Nieprawidłowy format daty. Wymagany YYYY-MM-DD."}

        # Find service
        res = await db.execute(
            select(Service).where(Service.business_id == business.id, Service.is_active == True)
        )
        services = res.scalars().all()
        matched = None
        for s in services:
            if s.name.lower() in service_name or service_name in s.name.lower():
                matched = s
                break
        if not matched and services:
            matched = services[0]

        if not matched:
            return {"error": "Brak zdefiniowanych usług w salonie."}

        try:
            avail = await availability.list_availability(
                db,
                business_id=business.id,
                service_id=matched.id,
                day=day,
            )
            free_slots = [
                slot.start_at.astimezone(tz).strftime("%H:%M")
                for slot in avail.slots
                if slot.available
            ]
            return {
                "date": date_str,
                "service": matched.name,
                "duration_min": matched.duration_min,
                "available_slots": free_slots[:12],
                "is_open": len(free_slots) > 0,
            }
        except Exception as e:
            return {"error": f"Błąd pobierania terminów: {str(e)}"}

    if name == "book_appointment":
        service_name = str(args.get("service_name", "")).strip().lower()
        date_str = str(args.get("date_str", "")).strip()
        time_str = str(args.get("time_str", "")).strip().replace(".", ":")
        notes = args.get("notes")

        try:
            day = date.fromisoformat(date_str)
            parts = time_str.split(":")
            hour = int(parts[0])
            minute = int(parts[1])
            start_at = datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)
        except Exception:
            return {"error": "Niepoprawny format daty lub godziny."}

        res = await db.execute(
            select(Service).where(Service.business_id == business.id, Service.is_active == True)
        )
        services = res.scalars().all()
        matched = None
        for s in services:
            if s.name.lower() in service_name or service_name in s.name.lower():
                matched = s
                break
        if not matched and services:
            matched = services[0]

        if not matched:
            return {"error": "Nie znaleziono wybranej usługi."}

        try:
            appt = await booking.create_appointment(
                db,
                business_id=business.id,
                customer_id=customer.id,
                service_id=matched.id,
                start_at=start_at,
                channel=channel,
                notes=notes,
            )
            return {
                "success": True,
                "appointment_id": str(appt.id),
                "service": matched.name,
                "date": start_at.strftime("%Y-%m-%d"),
                "time": start_at.strftime("%H:%M"),
                "duration_min": matched.duration_min,
                "status": appt.status.value,
            }
        except Exception as e:
            return {"error": f"Nie udało się zarezerwować: {str(e)}"}

    if name == "cancel_appointment":
        # Find customer's upcoming appointment
        res = await db.execute(
            select(Appointment)
            .where(
                Appointment.business_id == business.id,
                Appointment.customer_id == customer.id,
                Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed]),
                Appointment.start_at >= utc_now() - timedelta(hours=1),
            )
            .order_by(Appointment.start_at.asc())
        )
        appt = res.scalar_one_or_none()
        if not appt:
            return {"error": "Nie znaleziono żadnej aktywnej nadchodzącej wizyty do anulowania."}

        appt.status = AppointmentStatus.cancelled
        appt.notes = f"{appt.notes or ''} [Anulowano przez klienta: {args.get('reason', 'brak powodu')}]".strip()
        await db.flush()
        return {
            "success": True,
            "message": "Wizyta została pomyślnie anulowana.",
            "cancelled_date": appt.start_at.astimezone(tz).strftime("%Y-%m-%d %H:%M"),
        }

    if name == "reschedule_appointment":
        new_date_str = str(args.get("new_date_str", "")).strip()
        new_time_str = str(args.get("new_time_str", "")).strip().replace(".", ":")

        try:
            day = date.fromisoformat(new_date_str)
            parts = new_time_str.split(":")
            hour = int(parts[0])
            minute = int(parts[1])
            new_start_at = datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)
        except Exception:
            return {"error": "Niepoprawna nowa data lub godzina."}

        res = await db.execute(
            select(Appointment)
            .where(
                Appointment.business_id == business.id,
                Appointment.customer_id == customer.id,
                Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed]),
                Appointment.start_at >= utc_now() - timedelta(hours=1),
            )
            .order_by(Appointment.start_at.asc())
        )
        appt = res.scalar_one_or_none()
        if not appt:
            return {"error": "Nie znaleziono aktywnej wizyty do przełożenia."}

        service = await db.get(Service, appt.service_id)
        duration = service.duration_min if service else 30
        new_end_at = new_start_at + timedelta(minutes=duration)

        appt.start_at = new_start_at
        appt.end_at = new_end_at
        await db.flush()

        return {
            "success": True,
            "message": "Wizyta została przełożona.",
            "new_date": new_start_at.strftime("%Y-%m-%d"),
            "new_time": new_start_at.strftime("%H:%M"),
        }

    return {"error": f"Unknown tool {name}"}


async def generate_gemini_bot_reply(
    db: AsyncSession,
    *,
    business: Business,
    customer: Customer,
    conversation: Conversation,
    inbound_text: str,
    channel: Channel,
) -> str | None:
    """Generates AI assistant response using Google Gemini 2.0 Flash."""
    api_key = settings.gemini_api_key.strip() or (business.settings or {}).get("gemini_api_key", "").strip()
    if not api_key:
        return None

    tz = ZoneInfo(business.timezone or "Europe/Warsaw")
    now_local = datetime.now(tz)
    current_time_str = now_local.strftime("%Y-%m-%d %H:%M (%A)")

    # Fetch services
    services_res = await db.execute(
        select(Service).where(Service.business_id == business.id, Service.is_active == True)
    )
    services = services_res.scalars().all()
    services_list_txt = "\n".join(
        [
            f"- {s.name}: {float(s.price_cents or 0)/100.0:.2f} PLN ({s.duration_min} min)"
            for s in services
        ]
    )

    # Fetch knowledge base items
    kb_res = await db.execute(
        select(KnowledgeItem).where(KnowledgeItem.business_id == business.id)
    )
    kb_items = kb_res.scalars().all()
    kb_txt = "\n".join([f"Q: {k.question}\nA: {k.answer}" for k in kb_items])

    # Fetch upcoming appointments for customer
    appts_res = await db.execute(
        select(Appointment)
        .where(
            Appointment.business_id == business.id,
            Appointment.customer_id == customer.id,
            Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed]),
            Appointment.start_at >= utc_now() - timedelta(hours=1),
        )
        .order_by(Appointment.start_at.asc())
        .options(selectinload(Appointment.service))
    )
    upcoming = appts_res.scalars().all()
    upcoming_txt = "\n".join(
        [
            f"- {a.service.name if a.service else 'Wizyta'} dnia {a.start_at.astimezone(tz).strftime('%Y-%m-%d o %H:%M')} (Status: {a.status.value})"
            for a in upcoming
        ]
    ) or "Brak nadchodzących wizyt."

    # Build system prompt
    system_instruction = f"""Jesteś inteligentnym, wirtualnym asystentem firmy "{business.name}".
Rozmawiasz z klientem o imieniu: {customer.name or 'Klient'} przez kanał: {channel.value}.
Aktualny czas lokalny: {current_time_str}.

Twoje zadania:
1. Prowadź naturalną, przyjazną, profesjonalną i zwięzłą rozmowę w języku polskim.
2. Dostosuj się do branży i profilu firmy "{business.name}" oraz jej listy usług (np. usługi kosmetyczne, fryzjerskie, warsztat/serwis, medyczne/fizjoterapia/stomatologia, doradztwo, trener, itp.).
3. Gdy klient pyta o rezerwację lub potrzebuje usługi, dopytaj o szczegóły i preferowany termin, a następnie sprawdź dostępne terminy narzędziem `check_available_slots`.
4. Gdy klient wybierze konkretny termin, zarezerwuj go za pomocą narzędzia `book_appointment`.
5. Jeśli klient chce anulować lub przełożyć rezerwację, użyj `cancel_appointment` lub `reschedule_appointment`.
6. Odpowiadaj rzeczowo na pytania o ofertę, cennik, godziny pracy i informacje z bazy wiedzy firmy.

Dostępne usługi i cennik:
{services_list_txt or 'Zgodnie z ofertą firmy.'}

Aktualne rezerwacje tego klienta:
{upcoming_txt}

Baza wiedzy / FAQ firmy:
{kb_txt or 'Brak dodatkowych wpisów FAQ.'}

Zasady:
- Odpowiadaj zwięźle, uprzejmie i konkretnie.
- Nie wymyślaj wolnych terminów z głowy — zawsze sprawdzaj je za pomocą `check_available_slots`.
- Zawsze potwierdzaj dokonanie, zmianę lub anulowanie rezerwacji z podaniem dokładnej daty i godziny."""

    # Fetch last 10 messages for context
    msgs_res = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history_msgs = list(reversed(msgs_res.scalars().all()))

    contents: list[dict[str, Any]] = []
    for m in history_msgs:
        role = "user" if m.role == MessageRole.customer else "model"
        contents.append({"role": role, "parts": [{"text": m.content}]})

    # Ensure last user message is present
    if not contents or contents[-1].get("role") != "user":
        contents.append({"role": "user", "parts": [{"text": inbound_text}]})

    model_name = settings.gemini_model or "gemini-2.0-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "tools": GEMINI_TOOLS,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 600,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, json=payload)
            if resp.is_error:
                logger.error("Gemini API error: %s", resp.text)
                return None

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None

            candidate = candidates[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [])

            # Check if Gemini executed function calling
            function_calls = [p.get("functionCall") for p in parts if p.get("functionCall")]

            if function_calls:
                call = function_calls[0]
                fn_name = call.get("name")
                fn_args = call.get("args", {})

                # Execute local tool
                tool_result = await _execute_tool_call(
                    fn_name,
                    fn_args,
                    db=db,
                    business=business,
                    customer=customer,
                    channel=channel,
                )

                # Feed function response back to Gemini for final natural output
                followup_contents = list(contents)
                followup_contents.append({"role": "model", "parts": [{"functionCall": call}]})
                followup_contents.append(
                    {
                        "role": "function",
                        "parts": [
                            {
                                "functionResponse": {
                                    "name": fn_name,
                                    "response": tool_result,
                                }
                            }
                        ],
                    }
                )

                followup_payload = {
                    "system_instruction": {"parts": [{"text": system_instruction}]},
                    "contents": followup_contents,
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600},
                }

                followup_resp = await client.post(url, json=followup_payload)
                if not followup_resp.is_error:
                    f_data = followup_resp.json()
                    f_candidates = f_data.get("candidates", [])
                    if f_candidates:
                        f_parts = f_candidates[0].get("content", {}).get("parts", [])
                        for p in f_parts:
                            if p.get("text"):
                                return p.get("text")

            # Return direct text response
            for p in parts:
                if p.get("text"):
                    return p.get("text")

    except Exception as exc:
        logger.exception("Error communicating with Gemini: %s", exc)
        return None

    return None
