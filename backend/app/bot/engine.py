"""Core Bot Engine — FAQ from knowledge + multi-step booking + cancel/list."""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.bot.adapters.base import ChannelAdapter
from app.bot.dates import format_day_pl, parse_date_phrase, parse_month_only
from app.bot.intents import Intent, detect_intent
from app.bot.state_machine import booking_step, next_state
from app.models import Appointment, Conversation, Customer, KnowledgeItem, Message, Service
from app.models.enums import AppointmentStatus, Channel, ConversationState, MessageRole
from app.schemas import InboundMessage, OutboundMessage
from app.models.mixins import utc_now
from app.services import availability, booking, waitlist
from app.services.booking import BookingError
from app.services.events import hub

logger = logging.getLogger(__name__)

TIME_RE = re.compile(r"(\d{1,2})[:\.](\d{2})")
SLOT_INDEX_RE = re.compile(
    r"(?:(?:nr|numer|nr\.|#)\s*)?(\d{1,2})\s*\.?\s*$",
    re.IGNORECASE,
)
HOUR_FLEX_RE = re.compile(
    r"(?:^|[^\d])(?:o\s+)?(\d{1,2})(?:[:\.](\d{2}))?(?:\s*(?:godz(?:iny|ina|ine)?|h))?\b",
    re.IGNORECASE,
)


class CoreBotEngine:
    def __init__(self, db: AsyncSession, adapter: ChannelAdapter) -> None:
        self.db = db
        self.adapter = adapter

    async def handle(self, inbound: InboundMessage) -> OutboundMessage:
        business_id = inbound.business_id
        if business_id is None:
            reply_text = (
                "BizChat: brak business_id — skonfiguruj webhook z identyfikatorem salonu."
            )
            outbound = OutboundMessage(
                channel=inbound.channel,
                external_thread_id=inbound.external_thread_id,
                text=reply_text,
            )
            await self.adapter.send_outbound(outbound)
            return outbound

        customer = await self._get_or_create_customer(inbound, business_id)
        conversation = await self._get_or_create_conversation(inbound, customer.id)

        self.db.add(
            Message(
                conversation_id=conversation.id,
                role=MessageRole.customer,
                content=inbound.text,
                raw_payload=inbound.raw_payload,
            )
        )

        intent = await detect_intent(inbound.text)
        ctx = dict(conversation.context or {})

        # Continue booking flow if already in progress (unless clear exit)
        in_booking = conversation.state == ConversationState.booking and booking_step(ctx) != "done"
        text_l = inbound.text.lower().strip()
        if text_l in {"anuluj", "cancel", "wyjdź", "wyjdz", "stop"} and in_booking:
            conversation.state = ConversationState.idle
            conversation.context = {}
            reply_text = "Anulowano rezerwację. Napisz „umów wizytę”, gdy będziesz gotowy/a."
        elif in_booking and intent not in {Intent.cancel, Intent.list, Intent.greeting}:
            conversation.state = ConversationState.booking
            reply_text = await self._handle_booking(
                business_id, customer, conversation, inbound.text, inbound.channel
            )
        else:
            conversation.state = next_state(conversation.state, intent.value)
            reply_text = await self._dispatch(
                business_id, customer, conversation, inbound, intent
            )

        conversation.context = {
            **(conversation.context or {}),
            "last_intent": intent.value,
        }

        self.db.add(
            Message(
                conversation_id=conversation.id,
                role=MessageRole.bot,
                content=reply_text,
            )
        )
        conversation.updated_at = utc_now()
        await self.db.flush()

        preview = inbound.text.strip()[:100] or "…"
        await hub.publish(
            business_id,
            "chat.message",
            {
                "conversation_id": str(conversation.id),
                "channel": inbound.channel.value
                if hasattr(inbound.channel, "value")
                else str(inbound.channel),
                "customer_name": customer.name,
                "role": "customer",
            },
            title="Nowa wiadomość",
            message=f"{customer.name or 'Klient'} ({inbound.channel}): {preview}",
        )

        outbound = OutboundMessage(
            channel=inbound.channel,
            external_thread_id=inbound.external_thread_id,
            text=reply_text,
        )
        await self.adapter.send_outbound(outbound)
        return outbound

    async def _dispatch(
        self,
        business_id: UUID,
        customer: Customer,
        conversation: Conversation,
        inbound: InboundMessage,
        intent: Intent,
    ) -> str:
        if intent == Intent.greeting:
            name = (customer.name or "").strip()
            hello = f"Hej{(' ' + name) if name and name.lower() not in {'klient', 'messenger'} else ''}!"
            return (
                f"{hello} 👋 Tu asystent salonu.\n\n"
                "Mogę:\n"
                "• umówić wizytę\n"
                "• pokazać Twoje terminy\n"
                "• anulować wizytę\n"
                "• odpowiedzieć na pytania (cennik, godziny)\n\n"
                "Napisz np. „umów wizytę” albo zadaj pytanie."
            )

        if intent == Intent.booking:
            conversation.state = ConversationState.booking
            conversation.context = {"booking_step": "pick_service"}
            return await self._handle_booking(
                business_id, customer, conversation, inbound.text, inbound.channel
            )

        if intent == Intent.list:
            return await self._list_appointments(business_id, customer.id)

        if intent == Intent.cancel:
            return await self._cancel_next(business_id, customer.id)

        if intent == Intent.waitlist:
            return await self._join_waitlist(business_id, customer)

        if intent == Intent.feedback:
            return (
                "Dziękujemy za chęć zostawienia opinii! Po wizycie właściciel "
                "może poprosić o ocenę 1–5 w panelu BizChat."
            )

        faq_answer = await self._match_faq(business_id, inbound.text)
        if faq_answer:
            return faq_answer

        return (
            "Nie jestem pewien, o co chodzi 🤔\n\n"
            "Napisz jedną z opcji:\n"
            "• umów wizytę\n"
            "• moje wizyty\n"
            "• anuluj wizytę\n"
            "• albo pytanie, np. „jaki jest cennik?”"
        )

    async def _handle_booking(
        self,
        business_id: UUID,
        customer: Customer,
        conversation: Conversation,
        text: str,
        channel: Channel,
    ) -> str:
        ctx = dict(conversation.context or {})
        step = booking_step(ctx)

        services = list(
            (
                await self.db.execute(
                    select(Service)
                    .where(Service.business_id == business_id)
                    .order_by(Service.name)
                )
            )
            .scalars()
            .all()
        )
        if not services:
            conversation.state = ConversationState.idle
            conversation.context = {}
            return "Brak usług w systemie. Poproś salon o konfigurację."

        if step == "pick_service":
            match = self._match_service(services, text)
            if match is None and not any(k in text.lower() for k in ("umów", "umow", "rezerw", "wizyt")):
                # try numeric index
                if text.strip().isdigit():
                    idx = int(text.strip()) - 1
                    if 0 <= idx < len(services):
                        match = services[idx]
            if match is None:
                lines = [
                    f"{i + 1}. {s.name} ({s.duration_min} min, {s.price} zł)"
                    for i, s in enumerate(services)
                ]
                conversation.context = {**ctx, "booking_step": "pick_service"}
                return (
                    "Wybierz usługę (numer lub nazwa):\n"
                    + "\n".join(lines)
                )
            conversation.context = {
                **ctx,
                "booking_step": "pick_day",
                "service_id": str(match.id),
                "service_name": match.name,
            }
            example = format_day_pl(date.today() + timedelta(days=1))
            return (
                f"Wybrano: {match.name}. Kiedy Ci pasuje?\n"
                f"Napisz np. „jutro”, „piątek”, „23 sierpnia”, „15.12” "
                f"albo „grudzień” — podpowiem wolne dni.\n"
                f"(przykład: {example})"
            )

        if step == "pick_day":
            service_id = UUID(ctx["service_id"])
            today = date.today()

            # Month only (e.g. "grudzień") → list free days in that month
            month_only = parse_month_only(text, today=today)
            if month_only is not None and parse_date_phrase(text, today=today) is None:
                year, month = month_only
                free_days = await self._free_days_in_month(
                    business_id, service_id, year, month, limit=6
                )
                if not free_days:
                    conversation.context = {**ctx, "booking_step": "pick_day"}
                    return (
                        f"W {month:02d}/{year} nie ma wolnych terminów. "
                        "Podaj inny miesiąc albo konkretny dzień (np. „15 grudnia”)."
                    )
                conversation.context = {
                    **ctx,
                    "booking_step": "pick_day",
                    "suggested_days": [d.isoformat() for d in free_days],
                }
                lines = [f"{i + 1}. {format_day_pl(d)}" for i, d in enumerate(free_days)]
                return (
                    "Wolne dni w tym miesiącu:\n"
                    + "\n".join(lines)
                    + "\nWybierz numer albo napisz datę (np. „15 grudnia”)."
                )

            # Numeric pick from previously suggested days
            suggested = ctx.get("suggested_days") or []
            day: date | None = None
            if text.strip().isdigit() and suggested:
                idx = int(text.strip()) - 1
                if 0 <= idx < len(suggested):
                    day = date.fromisoformat(suggested[idx])

            if day is None:
                day = parse_date_phrase(text, today=today)

            if day is None:
                return (
                    "Nie rozpoznałem daty 🤔 Napisz np.:\n"
                    "• jutro / pojutrze\n"
                    "• piątek\n"
                    "• 23 sierpnia\n"
                    "• 15.12.2026\n"
                    "• albo sam miesiąc: grudzień"
                )

            if day < today:
                return (
                    f"{format_day_pl(day)} już minął. "
                    "Podaj przyszłą datę (np. „jutro” albo „15 grudnia”)."
                )

            return await self._offer_slots_for_day(
                business_id, service_id, day, ctx, conversation
            )

        if step == "pick_slot":
            slots = list(ctx.get("slots") or [])
            day_iso = ctx.get("day")
            service_id = UUID(ctx["service_id"])
            start_iso = self._match_slot_choice(text, slots)

            # Time not in the short list → search full day availability
            if start_iso is None and day_iso:
                wanted = self._parse_time_hm(text)
                if wanted is not None:
                    hh, mm = wanted
                    try:
                        avail = await availability.list_availability(
                            self.db,
                            business_id=business_id,
                            service_id=service_id,
                            day=date.fromisoformat(day_iso),
                        )
                    except ValueError as exc:
                        return str(exc)
                    for s in avail.slots:
                        local = s.start_at
                        if local.hour == hh and local.minute == mm:
                            start_iso = s.start_at.isoformat()
                            break
                    if start_iso is None:
                        # nearest slot within 30 minutes
                        target_min = hh * 60 + mm
                        best = None
                        best_diff = 10**9
                        for s in avail.slots:
                            diff = abs(s.start_at.hour * 60 + s.start_at.minute - target_min)
                            if diff < best_diff:
                                best_diff = diff
                                best = s
                        if best is not None and best_diff <= 30:
                            start_iso = best.start_at.isoformat()

            if start_iso is None:
                shown = []
                for s in slots[:12]:
                    try:
                        dt = datetime.fromisoformat(s)
                        shown.append(dt.strftime("%H:%M"))
                    except ValueError:
                        continue
                hint = ", ".join(shown) if shown else "z listy powyżej"
                return (
                    f"Nie znalazłem tej godziny. Wybierz numer (np. „3” / „nr 3”) "
                    f"albo godzinę z listy ({hint})."
                )

            conversation.context = {
                **ctx,
                "booking_step": "confirm",
                "start_at": start_iso,
            }
            start_dt = datetime.fromisoformat(start_iso)
            return (
                f"Potwierdź wizytę: {ctx.get('service_name')} "
                f"{format_day_pl(start_dt.date())} o {start_dt.strftime('%H:%M')}. "
                "Odpisz „tak” aby zarezerwować lub „nie” aby anulować."
            )

        if step == "confirm":
            if text.lower().strip() in {"tak", "yes", "ok", "potwierdzam", "potwierdź", "potwierdz"}:
                try:
                    start_at = datetime.fromisoformat(ctx["start_at"])
                    appt = await booking.create_appointment(
                        self.db,
                        business_id=business_id,
                        customer_id=customer.id,
                        service_id=UUID(ctx["service_id"]),
                        start_at=start_at,
                        status=AppointmentStatus.confirmed,
                        channel=channel,
                    )
                except BookingError as exc:
                    conversation.context = {**ctx, "booking_step": "pick_day"}
                    return f"Nie udało się zarezerwować: {exc}. Podaj inny dzień."
                conversation.state = ConversationState.idle
                conversation.context = {"booking_step": "done"}
                return (
                    f"Zarezerwowano! {appt.service.name if appt.service else ctx.get('service_name')} "
                    f"{appt.start_at.strftime('%Y-%m-%d %H:%M')}–{appt.end_at.strftime('%H:%M')}. "
                    "Do zobaczenia!"
                )
            if text.lower().strip() in {"nie", "no", "anuluj"}:
                conversation.state = ConversationState.idle
                conversation.context = {}
                return "Rezerwacja anulowana. Napisz „umów wizytę”, gdy chcesz spróbować ponownie."
            return "Odpisz „tak” lub „nie”."

        conversation.state = ConversationState.idle
        conversation.context = {}
        return "Zrestartowałem rezerwację. Napisz „umów wizytę”."

    def _match_service(self, services: list[Service], text: str) -> Service | None:
        lowered = text.lower()
        for service in services:
            if service.name.lower() in lowered:
                return service
        return None

    async def _offer_slots_for_day(
        self,
        business_id: UUID,
        service_id: UUID,
        day: date,
        ctx: dict,
        conversation: Conversation,
    ) -> str:
        try:
            avail = await availability.list_availability(
                self.db,
                business_id=business_id,
                service_id=service_id,
                day=day,
            )
        except ValueError as exc:
            return str(exc)
        free = self._sample_day_slots(avail.slots, limit=10)
        if not free:
            conversation.context = {**ctx, "booking_step": "pick_day"}
            return (
                f"Brak wolnych terminów {format_day_pl(day)}. "
                "Podaj inny dzień albo napisz „kolejka”, by dołączyć do listy oczekujących."
            )
        slot_lines = [
            f"{i + 1}. {s.start_at.strftime('%H:%M')}–{s.end_at.strftime('%H:%M')}"
            for i, s in enumerate(free)
        ]
        example = free[min(2, len(free) - 1)].start_at.strftime("%H:%M")
        conversation.context = {
            **ctx,
            "booking_step": "pick_slot",
            "day": day.isoformat(),
            "suggested_days": [],
            "slots": [s.start_at.isoformat() for s in free],
        }
        return (
            f"Dostępne godziny {format_day_pl(day)}:\n"
            + "\n".join(slot_lines)
            + f"\nWybierz numer (np. 1) albo godzinę (np. {example}). "
            "Możesz też wpisać inną wolną godzinę tego dnia, np. 12:00."
        )

    @staticmethod
    def _sample_day_slots(slots: list, *, limit: int = 10) -> list:
        """Spread slots across the day instead of only the first morning ones."""
        if len(slots) <= limit:
            return list(slots)
        if limit <= 1:
            return [slots[0]]
        out = []
        for i in range(limit):
            idx = round(i * (len(slots) - 1) / (limit - 1))
            out.append(slots[idx])
        seen: set[str] = set()
        unique = []
        for s in out:
            key = s.start_at.isoformat()
            if key in seen:
                continue
            seen.add(key)
            unique.append(s)
        return unique

    @staticmethod
    def _parse_time_hm(text: str) -> tuple[int, int] | None:
        """Parse '12:00', '12.30', 'o 12', '12 godziny' → (h, m)."""
        lowered = text.lower().strip()
        tm = TIME_RE.search(lowered)
        if tm:
            hh, mm = int(tm.group(1)), int(tm.group(2))
            if 0 <= hh <= 23 and 0 <= mm <= 59:
                return hh, mm
        m = re.search(
            r"(?:^|\s)(?:o\s+)?(\d{1,2})(?:\s*(?:godz(?:iny|ina|ine)?|h))?(?:\s|$|[^\d])",
            lowered,
        )
        if m:
            hh = int(m.group(1))
            if 0 <= hh <= 23:
                return hh, 0
        return None

    def _match_slot_choice(self, text: str, slots: list[str]) -> str | None:
        raw = text.strip()
        lowered = raw.lower().strip()
        if not slots:
            return None

        # "nr 8" / "numer 3" / "#2"
        m = re.search(r"(?:nr|numer|nr\.|#)\s*(\d{1,2})\b", lowered)
        if m:
            idx = int(m.group(1)) - 1
            if 0 <= idx < len(slots):
                return slots[idx]

        # bare index "3" — only if not a plausible clock hour matching a slot time
        if raw.isdigit():
            n = int(raw)
            wanted_as_hour = self._parse_time_hm(raw)
            if wanted_as_hour is not None:
                hh, mm = wanted_as_hour
                for s in slots:
                    try:
                        dt = datetime.fromisoformat(s)
                    except ValueError:
                        continue
                    if dt.hour == hh and dt.minute == mm:
                        return s
            idx = n - 1
            if 0 <= idx < len(slots):
                return slots[idx]

        wanted = self._parse_time_hm(lowered)
        if wanted is not None:
            hh, mm = wanted
            for s in slots:
                try:
                    dt = datetime.fromisoformat(s)
                except ValueError:
                    continue
                if dt.hour == hh and dt.minute == mm:
                    return s
        return None

    async def _free_days_in_month(
        self,
        business_id: UUID,
        service_id: UUID,
        year: int,
        month: int,
        *,
        limit: int = 6,
    ) -> list[date]:
        """Scan a month and return days that still have at least one free slot."""
        import calendar as cal

        today = date.today()
        last_day = cal.monthrange(year, month)[1]
        found: list[date] = []
        for day_n in range(1, last_day + 1):
            d = date(year, month, day_n)
            if d < today:
                continue
            try:
                avail = await availability.list_availability(
                    self.db,
                    business_id=business_id,
                    service_id=service_id,
                    day=d,
                )
            except ValueError:
                continue
            if avail.slots:
                found.append(d)
                if len(found) >= limit:
                    break
        return found

    async def _list_appointments(self, business_id: UUID, customer_id: UUID) -> str:
        result = await self.db.execute(
            select(Appointment)
            .where(
                Appointment.business_id == business_id,
                Appointment.customer_id == customer_id,
                Appointment.status.in_(
                    {AppointmentStatus.pending, AppointmentStatus.confirmed}
                ),
                Appointment.start_at >= datetime.now(tz=ZoneInfo("UTC")),
            )
            .options(selectinload(Appointment.service))
            .order_by(Appointment.start_at)
            .limit(5)
        )
        items = list(result.scalars().all())
        if not items:
            return "Nie masz nadchodzących wizyt. Napisz „umów wizytę”, aby zarezerwować."
        lines = [
            f"• {a.service.name if a.service else 'Usługa'} "
            f"{a.start_at.strftime('%Y-%m-%d %H:%M')} ({a.status.value})"
            for a in items
        ]
        return "Twoje wizyty:\n" + "\n".join(lines)

    async def _cancel_next(self, business_id: UUID, customer_id: UUID) -> str:
        result = await self.db.execute(
            select(Appointment)
            .where(
                Appointment.business_id == business_id,
                Appointment.customer_id == customer_id,
                Appointment.status.in_(
                    {AppointmentStatus.pending, AppointmentStatus.confirmed}
                ),
                Appointment.start_at >= datetime.now(tz=ZoneInfo("UTC")),
            )
            .options(selectinload(Appointment.service))
            .order_by(Appointment.start_at)
            .limit(1)
        )
        appt = result.scalar_one_or_none()
        if appt is None:
            return "Brak wizyt do anulowania."
        await booking.cancel_appointment(self.db, appt, reason="Cancelled via chat")
        name = appt.service.name if appt.service else "wizyta"
        return (
            f"Anulowano: {name} {appt.start_at.strftime('%Y-%m-%d %H:%M')}. "
            "Jeśli ktoś czekał na liście, oferujemy mu termin."
        )

    async def _join_waitlist(self, business_id: UUID, customer: Customer) -> str:
        service = (
            await self.db.execute(
                select(Service)
                .where(Service.business_id == business_id)
                .order_by(Service.name)
                .limit(1)
            )
        ).scalar_one_or_none()
        if service is None:
            return "Brak usług — nie można dodać do kolejki."
        await waitlist.add_to_waitlist(
            self.db,
            business_id=business_id,
            customer_id=customer.id,
            service_id=service.id,
            preferred_windows=[],
        )
        return (
            f"Dodano Cię do listy oczekujących na „{service.name}”. "
            "Dam znać (FIFO), gdy zwolni się termin."
        )

    async def _match_faq(self, business_id: UUID, text: str) -> str | None:
        result = await self.db.execute(
            select(KnowledgeItem).where(KnowledgeItem.business_id == business_id)
        )
        items = list(result.scalars().all())
        if not items:
            return None

        lowered = text.lower()
        best: KnowledgeItem | None = None
        best_score = 0
        for item in items:
            question = (item.question or "").lower()
            tokens = [t for t in question.replace("?", "").split() if len(t) > 2]
            score = sum(1 for t in tokens if t in lowered)
            # also match category keywords
            if item.category and item.category.lower() in lowered:
                score += 2
            if score > best_score:
                best_score = score
                best = item

        if best and best_score > 0:
            return best.answer
        return None

    async def _get_or_create_customer(
        self, inbound: InboundMessage, business_id: UUID
    ) -> Customer:
        channel_key = inbound.channel.value
        result = await self.db.execute(
            select(Customer).where(Customer.business_id == business_id)
        )
        for customer in result.scalars().all():
            ext = customer.external_ids or {}
            if ext.get(channel_key) == inbound.external_user_id:
                if inbound.display_name and (
                    not customer.name
                    or customer.name.strip().lower() in {"klient", "client", "user"}
                ):
                    customer.name = inbound.display_name
                return customer

        customer = Customer(
            business_id=business_id,
            name=inbound.display_name,
            external_ids={channel_key: inbound.external_user_id},
        )
        self.db.add(customer)
        await self.db.flush()
        return customer

    async def _get_or_create_conversation(
        self, inbound: InboundMessage, customer_id: UUID
    ) -> Conversation:
        result = await self.db.execute(
            select(Conversation).where(
                Conversation.customer_id == customer_id,
                Conversation.channel == inbound.channel,
                Conversation.external_thread_id == inbound.external_thread_id,
            )
        )
        conversation = result.scalar_one_or_none()
        if conversation:
            return conversation

        conversation = Conversation(
            customer_id=customer_id,
            channel=inbound.channel,
            external_thread_id=inbound.external_thread_id,
            state=ConversationState.idle,
            context={},
        )
        self.db.add(conversation)
        await self.db.flush()
        return conversation
