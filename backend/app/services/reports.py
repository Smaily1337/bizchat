"""Executive reporting service: daily morning summaries and weekly/monthly PDF reports."""

from __future__ import annotations

import io
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Business, Customer, Owner, Service, Staff, TimeOff
from app.models.enums import Channel
from app.services.mailer import send_email

logger = logging.getLogger("bizchat.reports")


POLISH_WEEKDAYS = [
    "Poniedziałek",
    "Wtorek",
    "Środa",
    "Czwartek",
    "Piątek",
    "Sobota",
    "Niedziela",
]

POLISH_MONTHS = [
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


async def generate_morning_summary(
    db: AsyncSession, business_id: UUID
) -> dict[str, Any]:
    """Generates today's morning briefing text and statistics for the salon owner."""
    biz = await db.get(Business, business_id)
    if not biz:
        raise ValueError("Business not found")

    tz_str = biz.timezone or "Europe/Warsaw"
    tz = ZoneInfo(tz_str)
    now_local = datetime.now(tz)

    start_of_day_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day_local = now_local.replace(hour=23, minute=59, second=59, microsecond=999999)

    start_of_day_utc = start_of_day_local.astimezone(timezone.utc)
    end_of_day_utc = end_of_day_local.astimezone(timezone.utc)

    # Fetch appointments today
    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.business_id == business_id,
            Appointment.start_at >= start_of_day_utc,
            Appointment.start_at <= end_of_day_utc,
            Appointment.status != "cancelled",
        )
        .order_by(Appointment.start_at)
    )
    appts = list(result.scalars().all())

    # Fetch time off today
    to_res = await db.execute(
        select(TimeOff)
        .where(
            TimeOff.business_id == business_id,
            TimeOff.start_at <= end_of_day_utc,
            TimeOff.end_at >= start_of_day_utc,
        )
    )
    time_offs = list(to_res.scalars().all())

    # Pre-fetch services, staff and customers
    svc_res = await db.execute(select(Service).where(Service.business_id == business_id))
    services_map = {s.id: s for s in svc_res.scalars().all()}

    staff_res = await db.execute(select(Staff).where(Staff.business_id == business_id))
    staff_map = {st.id: st for st in staff_res.scalars().all()}

    cust_res = await db.execute(select(Customer).where(Customer.business_id == business_id))
    customers_map = {c.id: c for c in cust_res.scalars().all()}

    total_revenue = Decimal("0.00")
    lines: list[str] = []

    weekday_name = POLISH_WEEKDAYS[now_local.weekday()]
    formatted_date = f"{now_local.day} {POLISH_MONTHS[now_local.month]} {now_local.year}"

    for a in appts:
        start_loc = a.start_at.astimezone(tz)
        end_loc = a.end_at.astimezone(tz)
        time_range = f"{start_loc.strftime('%H:%M')}–{end_loc.strftime('%H:%M')}"

        svc = services_map.get(a.service_id) if a.service_id else None
        svc_name = svc.name if svc else "Wizyta"
        price_val = Decimal(str(svc.price)) if svc and svc.price else Decimal("0.00")
        total_revenue += price_val

        staff_member = staff_map.get(a.staff_id) if a.staff_id else None
        staff_info = f" (Specjalista: {staff_member.name})" if staff_member else ""

        cust = customers_map.get(a.customer_id) if a.customer_id else None
        client_name = cust.name if (cust and cust.name) else "Klient"
        phone_info = f" [tel: {cust.phone}]" if (cust and cust.phone) else ""

        lines.append(
            f"• 🕒 {time_range} | {client_name}{phone_info} — {svc_name} ({price_val:.2f} zł){staff_info}"
        )

    # Build Polish text message
    summary_text = (
        f"☀️ Dzień dobry! Oto Twój poranny briefing Automovia na dziś ({weekday_name}, {formatted_date}):\n\n"
        f"🏢 Salon: {biz.name}\n"
        f"📅 Liczba wizyt na dziś: {len(appts)}\n"
        f"💰 Szacowany przychód: {total_revenue:.2f} zł\n\n"
    )

    if lines:
        summary_text += "📋 Grafik wizyt na dziś:\n" + "\n".join(lines) + "\n\n"
    else:
        summary_text += "☕ Brak zaplanowanych wizyt na dziś — idealny dzień na promocje lub odpoczynek!\n\n"

    if time_offs:
        summary_text += "🌴 Zaplanowane przerwy / urlopy na dziś:\n"
        for to in time_offs:
            to_start_loc = to.start_at.astimezone(tz)
            to_end_loc = to.end_at.astimezone(tz)
            reason = to.reason or "Przerwa salonu"
            summary_text += f"• 🔒 {to_start_loc.strftime('%H:%M')} - {to_end_loc.strftime('%H:%M')} ({reason})\n"
        summary_text += "\n"

    summary_text += "✨ Życzymy owocnego i udanego dnia z Automovia AI!"

    return {
        "summary_text": summary_text,
        "appointments_count": len(appts),
        "total_revenue": float(total_revenue),
        "date_label": f"{weekday_name}, {formatted_date}",
        "time_offs_count": len(time_offs),
    }


async def generate_executive_pdf_report(
    db: AsyncSession, business_id: UUID, period: str = "week"
) -> bytes:
    """Generates a luxury, graphic executive PDF report with statistics."""
    biz = await db.get(Business, business_id)
    if not biz:
        raise ValueError("Business not found")

    tz_str = biz.timezone or "Europe/Warsaw"
    tz = ZoneInfo(tz_str)
    now_local = datetime.now(tz)

    days_delta = 7 if period == "week" else 30
    period_title = "Tygodniowy" if period == "week" else "Miesięczny"

    start_local = (now_local - timedelta(days=days_delta)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    end_local = now_local.replace(hour=23, minute=59, second=59, microsecond=999999)

    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)

    # Appointments in period
    result = await db.execute(
        select(Appointment).where(
            Appointment.business_id == business_id,
            Appointment.start_at >= start_utc,
            Appointment.start_at <= end_utc,
        )
    )
    appts = list(result.scalars().all())

    # Pre-fetch services and staff
    svc_res = await db.execute(select(Service).where(Service.business_id == business_id))
    services_map = {s.id: s for s in svc_res.scalars().all()}

    staff_res = await db.execute(select(Staff).where(Staff.business_id == business_id))
    staff_map = {st.id: st for st in staff_res.scalars().all()}

    # Compute KPI statistics
    total_appts = len(appts)
    completed_appts = sum(1 for a in appts if a.status == "completed")
    confirmed_appts = sum(1 for a in appts if a.status == "confirmed")
    cancelled_appts = sum(1 for a in appts if a.status == "cancelled")
    no_show_appts = sum(1 for a in appts if a.status == "no_show")

    active_appts = [a for a in appts if a.status != "cancelled"]
    total_revenue = Decimal("0.00")
    service_counts: dict[str, dict[str, Any]] = {}
    staff_counts: dict[str, int] = {}
    channel_counts: dict[str, int] = {}

    for a in active_appts:
        svc = services_map.get(a.service_id) if a.service_id else None
        svc_name = svc.name if svc else (a.service_name or "Inna usługa")
        price = Decimal(str(svc.price)) if svc and svc.price else Decimal("0.00")
        total_revenue += price

        if svc_name not in service_counts:
            service_counts[svc_name] = {"count": 0, "revenue": Decimal("0.00")}
        service_counts[svc_name]["count"] += 1
        service_counts[svc_name]["revenue"] += price

        staff = staff_map.get(a.staff_id) if a.staff_id else None
        staff_name = staff.name if staff else "Nieprzypisany"
        staff_counts[staff_name] = staff_counts.get(staff_name, 0) + 1

        ch_val_str = a.channel.value if hasattr(a.channel, "value") else str(a.channel or "widget")
        ch_name = ch_val_str.capitalize()
        channel_counts[ch_name] = channel_counts.get(ch_name, 0) + 1

    avg_ticket = total_revenue / len(active_appts) if active_appts else Decimal("0.00")
    no_show_rate = (no_show_appts / total_appts * 100) if total_appts > 0 else 0.0

    # Build ReportLab PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"Raport {period_title} — {biz.name}",
        author="Automovia AI",
    )

    styles = getSampleStyleSheet()

    # Colors
    c_dark = colors.HexColor("#0F172A")
    c_primary = colors.HexColor("#3B82F6")
    c_accent = colors.HexColor("#F59E0B")
    c_emerald = colors.HexColor("#10B981")
    c_card_bg = colors.HexColor("#F8FAFC")
    c_card_border = colors.HexColor("#E2E8F0")
    c_text_muted = colors.HexColor("#64748B")

    title_style = ParagraphStyle(
        name="RepTitle",
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.white,
    )
    sub_style = ParagraphStyle(
        name="RepSub",
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#93C5FD"),
    )
    section_h2 = ParagraphStyle(
        name="RepH2",
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=c_dark,
        spaceAfter=6,
    )
    card_num = ParagraphStyle(
        name="CardNum",
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=20,
        alignment=TA_CENTER,
        textColor=c_dark,
    )
    card_lbl = ParagraphStyle(
        name="CardLbl",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=c_text_muted,
    )
    table_cell = ParagraphStyle(
        name="TableCell",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=c_dark,
    )
    table_cell_bold = ParagraphStyle(
        name="TableCellB",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=c_dark,
    )
    table_cell_right = ParagraphStyle(
        name="TableCellR",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        alignment=TA_RIGHT,
        textColor=c_dark,
    )

    story = []

    # 1. LUXURY HEADER BANNER
    header_data = [
        [
            Paragraph(f"<b>AUTOMOVIA EXECUTIVE REPORT</b><br/>Raport {period_title} — {biz.name}", title_style),
            Paragraph(
                f"Zakres: {start_local.strftime('%d.%m.%Y')} – {end_local.strftime('%d.%m.%Y')}<br/>"
                f"Wygenerowano: {now_local.strftime('%d.%m.%Y %H:%M')}",
                sub_style,
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[110 * mm, 68 * mm])
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1E1B4B")),
                ("PADDING", (0, 0), (-1, -1), 12),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 10 * mm))

    # 2. KEY METRICS BENTO KPI CARDS (4 columns)
    kpis = [
        [
            Paragraph(f"{total_revenue:,.2f} zł".replace(",", " "), card_num),
            Paragraph(f"{total_appts}", card_num),
            Paragraph(f"{avg_ticket:,.2f} zł".replace(",", " "), card_num),
            Paragraph(f"{no_show_rate:.1f}%", card_num),
        ],
        [
            Paragraph("ŁĄCZNY PRZYCHÓD", card_lbl),
            Paragraph("REZERWACJE W OKRESIE", card_lbl),
            Paragraph("ŚREDNI KOSZYK (AOV)", card_lbl),
            Paragraph("WSKAŹNIK NO-SHOW", card_lbl),
        ],
    ]
    kpi_table = Table(kpis, colWidths=[44.5 * mm, 44.5 * mm, 44.5 * mm, 44.5 * mm])
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), c_card_bg),
                ("BOX", (0, 0), (0, 1), 1, c_card_border),
                ("BOX", (1, 0), (1, 1), 1, c_card_border),
                ("BOX", (2, 0), (2, 1), 1, c_card_border),
                ("BOX", (3, 0), (3, 1), 1, c_card_border),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(kpi_table)
    story.append(Spacer(1, 8 * mm))

    # 3. STATUS SUMMARY TABLE
    story.append(Paragraph("Statusy Wizyt", section_h2))
    status_data = [
        [
            Paragraph("Status", table_cell_bold),
            Paragraph("Liczba", table_cell_bold),
            Paragraph("Udział %", table_cell_bold),
        ],
        [
            Paragraph("Potwierdzone / Zakończone", table_cell),
            Paragraph(str(completed_appts + confirmed_appts), table_cell_right),
            Paragraph(f"{((completed_appts + confirmed_appts) / total_appts * 100 if total_appts else 0):.1f}%", table_cell_right),
        ],
        [
            Paragraph("Anulowane", table_cell),
            Paragraph(str(cancelled_appts), table_cell_right),
            Paragraph(f"{(cancelled_appts / total_appts * 100 if total_appts else 0):.1f}%", table_cell_right),
        ],
        [
            Paragraph("Nieobecność (No-Show)", table_cell),
            Paragraph(str(no_show_appts), table_cell_right),
            Paragraph(f"{(no_show_appts / total_appts * 100 if total_appts else 0):.1f}%", table_cell_right),
        ],
    ]
    status_table = Table(status_data, colWidths=[80 * mm, 49 * mm, 49 * mm])
    status_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2F6")),
                ("GRID", (0, 0), (-1, -1), 0.5, c_card_border),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(status_table)
    story.append(Spacer(1, 8 * mm))

    # 4. TOP SERVICES TABLE
    story.append(Paragraph("Najpopularniejsze Usługi", section_h2))
    sorted_services = sorted(
        service_counts.items(), key=lambda x: x[1]["count"], reverse=True
    )[:6]

    svc_rows = [
        [
            Paragraph("Usługa", table_cell_bold),
            Paragraph("Liczba rezerwacji", table_cell_bold),
            Paragraph("Generowany przychód", table_cell_bold),
        ]
    ]
    for s_name, data in sorted_services:
        svc_rows.append(
            [
                Paragraph(s_name, table_cell),
                Paragraph(str(data["count"]), table_cell_right),
                Paragraph(f"{data['revenue']:.2f} zł", table_cell_right),
            ]
        )
    if not sorted_services:
        svc_rows.append([Paragraph("Brak danych w tym okresie", table_cell), Paragraph("—", table_cell_right), Paragraph("—", table_cell_right)])

    svc_table = Table(svc_rows, colWidths=[90 * mm, 44 * mm, 44 * mm])
    svc_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2F6")),
                ("GRID", (0, 0), (-1, -1), 0.5, c_card_border),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(svc_table)
    story.append(Spacer(1, 8 * mm))

    # 5. CHANNEL ACQUISITION & TEAM BREAKDOWN
    story.append(Paragraph("Kanały Rezerwacji & Zespół", section_h2))
    ch_rows = [
        [
            Paragraph("Kanał / Źródło", table_cell_bold),
            Paragraph("Wizyty", table_cell_bold),
            Paragraph("Pracownik / Stanowisko", table_cell_bold),
            Paragraph("Obsłużone wizyty", table_cell_bold),
        ]
    ]

    sorted_channels = sorted(channel_counts.items(), key=lambda x: x[1], reverse=True)
    sorted_staff = sorted(staff_counts.items(), key=lambda x: x[1], reverse=True)
    max_len = max(len(sorted_channels), len(sorted_staff), 1)

    for i in range(max_len):
        ch_text = sorted_channels[i][0] if i < len(sorted_channels) else "—"
        ch_val = str(sorted_channels[i][1]) if i < len(sorted_channels) else "—"
        st_text = sorted_staff[i][0] if i < len(sorted_staff) else "—"
        st_val = str(sorted_staff[i][1]) if i < len(sorted_staff) else "—"
        ch_rows.append(
            [
                Paragraph(ch_text, table_cell),
                Paragraph(ch_val, table_cell_right),
                Paragraph(st_text, table_cell),
                Paragraph(st_val, table_cell_right),
            ]
        )

    comb_table = Table(ch_rows, colWidths=[45 * mm, 44 * mm, 45 * mm, 44 * mm])
    comb_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2F6")),
                ("GRID", (0, 0), (-1, -1), 0.5, c_card_border),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(comb_table)
    story.append(Spacer(1, 10 * mm))

    # 6. FOOTER
    footer_text = Paragraph(
        f"<font color='#94A3B8'>Automovia AI Smart Booking Engine · Raport {period_title} wygenerowany automatycznie dla: {biz.name}</font>",
        ParagraphStyle(name="Footer", fontName="Helvetica", fontSize=7.5, alignment=TA_CENTER),
    )
    story.append(footer_text)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


async def send_morning_summary_notification(
    db: AsyncSession, business: Business, owner_user: Owner | None = None
) -> dict[str, Any]:
    """Generates today's morning summary and delivers it to the business owner via Email."""
    summary_data = await generate_morning_summary(db, business.id)

    recipient_email = owner_user.email if owner_user and owner_user.email else None
    if not recipient_email:
        # Look up owner
        res = await db.execute(
            select(Owner).where(Owner.business_id == business.id, Owner.role == "owner")
        )
        owner_row = res.scalar_one_or_none()
        if owner_row:
            recipient_email = owner_row.email

    if recipient_email:
        send_email(
            to=recipient_email,
            subject=f"☀️ Poranny Briefing Wizyt — {business.name} ({summary_data['date_label']})",
            body=summary_data["summary_text"],
        )

    return {
        "ok": True,
        "recipient": recipient_email,
        "summary": summary_data,
        "message": f"Wysłano poranny briefing na adres: {recipient_email or 'konsola'}",
    }


async def send_pdf_report_email(
    db: AsyncSession,
    business: Business,
    owner_user: Owner | None = None,
    period: str = "week",
) -> dict[str, Any]:
    """Generates an executive PDF report and delivers it as an email attachment."""
    pdf_bytes = await generate_executive_pdf_report(db, business.id, period=period)

    recipient_email = owner_user.email if owner_user and owner_user.email else None
    if not recipient_email:
        res = await db.execute(
            select(Owner).where(Owner.business_id == business.id, Owner.role == "owner")
        )
        owner_row = res.scalar_one_or_none()
        if owner_row:
            recipient_email = owner_row.email

    period_pl = "Tygodniowy" if period == "week" else "Miesięczny"
    filename = f"Raport-{period_pl}-{business.name.replace(' ', '_')}.pdf"

    if recipient_email:
        send_email(
            to=recipient_email,
            subject=f"📊 Raport {period_pl} Statystyk & Przychodów — {business.name}",
            body=(
                f"Dzień dobry!\n\n"
                f"W załączeniu przesyłamy podsumowanie i raport statystyczny ({period_pl}) dla salonu {business.name}.\n\n"
                f"Raport zawiera zestawienie przychodów, wolumenu wizyt, no-show oraz kanałów rezerwacji.\n\n"
                f"Pozdrawiamy,\nZespół Automovia AI"
            ),
            attachment_bytes=pdf_bytes,
            attachment_filename=filename,
        )

    return {
        "ok": True,
        "recipient": recipient_email,
        "filename": filename,
        "message": f"Wysłano raport PDF ({period_pl}) na adres {recipient_email or 'konsola'}",
    }
