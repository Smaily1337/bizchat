#!/usr/bin/env python3
"""Generate BizChat Polish user guide PDF (ReportLab + embedded DejaVu)."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "BizChat-przewodnik.pdf"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def build() -> Path:
    pdfmetrics.registerFont(TTFont("DejaVu", FONT))
    pdfmetrics.registerFont(TTFont("DejaVuBold", FONT_B))

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="BizChat — przewodnik po funkcjach",
        author="BizChat",
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="DejaVuBold",
            fontSize=28,
            leading=34,
            alignment=TA_CENTER,
            textColor=HexColor("#111111"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="DejaVu",
            fontSize=14,
            leading=18,
            alignment=TA_CENTER,
            textColor=HexColor("#555555"),
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverBody",
            fontName="DejaVu",
            fontSize=11,
            leading=16,
            alignment=TA_CENTER,
            textColor=HexColor("#444444"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1PL",
            fontName="DejaVuBold",
            fontSize=15,
            leading=20,
            textColor=HexColor("#141414"),
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2PL",
            fontName="DejaVuBold",
            fontSize=12,
            leading=16,
            textColor=HexColor("#1e1e1e"),
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyPL",
            fontName="DejaVu",
            fontSize=10,
            leading=14,
            textColor=HexColor("#282828"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletPL",
            fontName="DejaVu",
            fontSize=10,
            leading=14,
            textColor=HexColor("#282828"),
            leftIndent=12,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="NotePL",
            fontName="DejaVu",
            fontSize=9,
            leading=13,
            textColor=HexColor("#3c3c3c"),
            backColor=HexColor("#f3f3f3"),
            borderPadding=6,
            spaceBefore=4,
            spaceAfter=8,
        )
    )

    def h1(t: str) -> Paragraph:
        return Paragraph(t, styles["H1PL"])

    def h2(t: str) -> Paragraph:
        return Paragraph(t, styles["H2PL"])

    def p(t: str) -> Paragraph:
        return Paragraph(t, styles["BodyPL"])

    def b(t: str) -> Paragraph:
        return Paragraph(f"•  {t}", styles["BulletPL"])

    def s(n: int, t: str) -> Paragraph:
        return Paragraph(f"<b>{n}.</b>  {t}", styles["BodyPL"])

    def note(t: str) -> Paragraph:
        return Paragraph(f"<b>Uwaga:</b> {t}", styles["NotePL"])

    def sp(h: int = 6) -> Spacer:
        return Spacer(1, h)

    story: list = []
    story += [
        sp(50),
        Paragraph("BizChat", styles["CoverTitle"]),
        Paragraph("Przewodnik po funkcjach panelu", styles["CoverSub"]),
        Paragraph(
            "Jak korzystać z kalendarza, Inbox, klientów, kanałów (Messenger, WhatsApp, "
            "Telegram, widget), publicznej rezerwacji, zaliczek, raportów i zespołu.",
            styles["CoverBody"],
        ),
        sp(20),
        Paragraph(
            "Wersja produktu: salon feature pack · 2026", styles["CoverBody"]
        ),
        PageBreak(),
    ]

    story += [
        h1("1. Co to jest BizChat?"),
        p(
            "BizChat to panel salonu + bot rezerwacyjny na Messengerze, WhatsAppie, "
            "Telegramie i widgetcie WWW. Bot umawia wizyty, a Ty zarządzasz kalendarzem, "
            "odpisujesz klientom i wysyłasz przypomnienia z jednego miejsca."
        ),
        h2("Do czego służy"),
        b("Automatyczne umawianie wizyt przez chat (bot)."),
        b("Ręczna obsługa rozmów i outreach do klientów."),
        b("Publiczna strona rezerwacji (link do bio / Google)."),
        b("Przypomnienia z potwierdzeniem jednym kliknięciem."),
        b("Raporty: wizyty, no-show, skąd przyszli klienci."),
        h2("Logowanie"),
        s(1, "Otwórz panel (Cloud Run / localhost:5173)."),
        s(2, "Zaloguj się e-mailem i hasłem albo Google."),
        s(3, "Po pierwszym wejściu uruchomi się krótki samouczek (można pominąć)."),
        note(
            "Samouczek możesz włączyć ponownie przyciskiem „Samouczek” w górnym pasku "
            "albo na stronie Kanały."
        ),
    ]

    story.append(h1("2. Nawigacja panelu"))
    for title, desc in [
        ("Kalendarz", "Widok dnia/tygodnia z wizytami."),
        ("Wizyty", "Lista, dodawanie, edycja, anulowanie, przypomnienia."),
        ("Inbox", "Rozmowy z kanałów + „Nowa wiadomość”."),
        ("Klienci", "Baza klientów, PSID, import CSV, napisz na Messenger."),
        ("Zespół", "Specjaliści (stylista / fryzjer) do przypisania wizyt."),
        ("Godziny", "Godziny otwarcia i urlopy — bot widzi tylko wolne sloty."),
        ("Raporty", "Statystyki 7/30/90 dni + eksport CSV."),
        ("Powiadomienia", "Szablony SMS/e-mail/Messenger/WhatsApp."),
        ("Kanały", "Webhooki, setup Meta/Telegram/WhatsApp/widget."),
        (
            "Ustawienia",
            "Nazwa, slug rezerwacji, zaliczka %, Google Calendar, usługi, FAQ.",
        ),
    ]:
        story.append(p(f"<b>{title}</b> — {desc}"))

    story += [
        h1("3. Kalendarz i wizyty"),
        h2("Kalendarz"),
        p(
            "Na stronie głównej widzisz grafik. Przydatny do szybkiego podglądu dnia. "
            "Szczegóły i zmiany statusów robisz w zakładce Wizyty."
        ),
        h2("Wizyty — jak dodać"),
        s(1, "Wejdź w Wizyty → Dodaj wizytę."),
        s(2, "Wybierz klienta z listy albo utwórz nowego (imię, telefon, e-mail)."),
        s(3, "Wybierz usługę, opcjonalnie specjalistę z Zespołu, datę i godzinę."),
        s(4, "Ustaw status (np. Potwierdzona) i zapisz."),
        h2("Statusy"),
        b("Oczekuje / Potwierdzona — aktywne, zajmują slot."),
        b("Anulowana — zwalnia termin (może odpalić waitlistę)."),
        b("Zakończona / Nieobecność (no-show) — do raportów."),
        h2("Przypomnienie z listy wizyt"),
        p(
            "Przy wizycie kliknij wysyłkę przypomnienia. System wybierze kanał zgodny "
            "z tym, którym klient się umawiał (Messenger / Telegram / …)."
        ),
        h1("4. Inbox"),
        p(
            "Tu lądują rozmowy z bota i klientów. Możesz odpisać jako właściciel — "
            "wiadomość idzie na ten sam kanał (Messenger, WhatsApp itd.)."
        ),
        h2("Nowa wiadomość (bez wcześniejszej rozmowy)"),
        s(1, "Kliknij „Nowa wiadomość”."),
        s(2, "Wybierz klienta, który ma Messenger PSID (lub ID innego kanału)."),
        s(3, "Napisz treść i wyślij — powstanie wątek w Inbox."),
        note(
            "Facebook nie pozwala na zimny kontakt do kogoś, kto nigdy nie napisał "
            "do fanpage. Potrzebujesz PSID (Page-Scoped ID)."
        ),
        h1("5. Klienci"),
        h2("Do czego służy"),
        p(
            "Ręczna baza klientów: imię, telefon, e-mail oraz ID kanałów "
            "(Messenger PSID, WhatsApp, Telegram)."
        ),
        h2("Dodanie klienta i wiadomość"),
        s(1, "Wypełnij formularz „Nowy klient” (opcjonalnie wklej Messenger PSID)."),
        s(2, "Zapisz. Przy kliencie użyj „Napisz”, wybierz kanał i treść."),
        s(3, "Jeśli brak PSID — przycisk „PSID” pozwala go dopisać później."),
        h2("Import CSV"),
        p("Na stronie Klienci wybierz plik CSV. Wymagany wiersz nagłówka."),
        b("Kolumny: name, phone, email, messenger_psid, whatsapp"),
        b("Duplikaty po telefonie/e-mailu są aktualizowane, nie dublowane."),
        h1("6. Zespół (multi-staff)"),
        p(
            "Jeśli w salonie pracuje kilku specjalistów, dodaj ich w Zespół. Potem "
            "przy wizycie (panel lub publiczna rezerwacja) możesz wybrać osobę. "
            "Wolne sloty liczą się osobno per specjalista."
        ),
        s(1, "Zespół → wpisz imię → Dodaj."),
        s(2, "W Wizytach / publicznej rezerwacji wybierz specjalistę."),
        s(3, "Dezaktywuj osobę, która już nie przyjmuje."),
        h1("7. Godziny i dostępność"),
        p(
            "Ustaw godziny otwarcia na każdy dzień tygodnia oraz urlopy/time-off. "
            "Bot i publiczna rezerwacja proponują wyłącznie wolne terminy w tych "
            "ramach, minus zajęte wizyty."
        ),
        h1("8. Kanały — podłączanie chatów"),
        p(
            "Sekcja Kanały to hub: checklisty, kopiowanie webhooków z business_id, "
            "snippet widgetu i link do publicznej rezerwacji."
        ),
        h2("Messenger / Instagram"),
        s(1, "W Meta Developers dodaj produkt Messenger."),
        s(2, "Callback URL skopiuj z karty kanału (z ?business_id=…)."),
        s(3, "Verify token = META_VERIFY_TOKEN (domyślnie bizchat-verify)."),
        s(4, "Subskrypcje: messages, messaging_postbacks."),
        s(5, "Ustaw META_PAGE_ACCESS_TOKEN na API i zredeployuj."),
        h2("WhatsApp (Cloud API)"),
        s(1, "W Meta Business włącz WhatsApp Cloud API."),
        s(2, "Ustaw WHATSAPP_PHONE_NUMBER_ID i WHATSAPP_ACCESS_TOKEN."),
        s(3, "Webhook: URL z karty WhatsApp, verify token jak Meta."),
        s(4, "Numer klienta trzymaj w external_ids.whatsapp."),
        h2("Telegram"),
        s(1, "Utwórz bota w @BotFather → TELEGRAM_BOT_TOKEN."),
        s(2, "Ustaw webhook na URL z karty Telegram."),
        s(3, "Klient pisze /start — rozmowa w Inbox."),
        h2("Widget WWW"),
        p(
            "Skopiuj snippet ze strony Kanały, wklej przed &lt;/body&gt; na stronie "
            "salonu. Origin strony musi być na liście CORS_ORIGINS API."
        ),
        h1("9. Publiczna rezerwacja"),
        p(
            "Strona bez logowania: /book/&lt;slug-lub-uuid&gt;. Klient wybiera usługę, "
            "dzień, godzinę, specjalistę (opcjonalnie) i zostawia dane kontaktowe."
        ),
        h2("Jak włączyć"),
        s(1, "Ustawienia → „Slug publicznej rezerwacji” (np. moj-salon)."),
        s(2, "Zapisz. Link: /book/moj-salon (albo UUID salonu)."),
        s(3, "Dodaj link do bio Instagrama / Google Business / strony."),
        note(
            "Jeśli ustawisz zaliczkę &gt; 0%, po rezerwacji klient trafi do płatności "
            "(Stripe albo mock, gdy brak klucza Stripe)."
        ),
        h1("10. Zaliczki (Stripe)"),
        p(
            "W Ustawieniach ustaw „Zaliczka %” (0–100). Przy publicznej rezerwacji "
            "system liczy kwotę od ceny usługi i tworzy sesję Checkout."
        ),
        b("Bez STRIPE_SECRET_KEY — mock pay (demo: oznacza zaliczkę jako opłaconą)."),
        b("Ze Stripe — prawdziwa płatność; webhook /api/payments/stripe/webhook."),
        b("Po opłaceniu status wizyty przechodzi na potwierdzoną."),
        h1("11. Powiadomienia i przyciski Messenger"),
        p(
            "W Powiadomieniach edytujesz szablony (placeholdery: {{klient}}, {{usluga}}, "
            "{{data}}, {{godzina}}, {{firma}}, {{cena}}). Przypomnienia lecą "
            "automatycznie przed wizytą według lead time (np. 24h / 2h / 30 min)."
        ),
        h2("Potwierdzam / Odwołuję"),
        p(
            "Reminder na Messengerze (i WhatsApp, gdy skonfigurowany) dostaje szybkie "
            "przyciski. Klient klika — wizyta jest potwierdzana albo anulowana bez "
            "wejścia do panelu."
        ),
        h1("12. Google Calendar"),
        p(
            "W Ustawieniach wpisz Google Calendar ID (np. primary). Na serwerze API "
            "muszą być: GOOGLE_CALENDAR_ENABLED=true oraz refresh token / service "
            "account. Przy tworzeniu, zmianie i anulowaniu wizyty BizChat "
            "synchronizuje wydarzenie."
        ),
        h1("13. Raporty"),
        p(
            "Zakładka Raporty: wizyty, wskaźnik no-show, anulacje oraz rozkład po "
            "kanałach za 7 / 30 / 90 dni. Przycisk Export CSV ściąga plik do Excela / "
            "Sheets."
        ),
        h1("14. Ustawienia — usługi i FAQ"),
        b("Usługi: nazwa, czas trwania, cena — bot i rezerwacja z nich korzystają."),
        b("Baza wiedzy (FAQ): pytania i odpowiedzi dla bota."),
        b("Licencja: limity rezerwacji / wiadomości / miejsc w panelu."),
        h1("15. Szybka checklista startowa"),
        s(1, "Ustawienia: nazwa salonu, strefa, slug, usługi, FAQ."),
        s(2, "Godziny otwarcia."),
        s(3, "Zespół (jeśli wielu specjalistów)."),
        s(4, "Kanały: podłącz Messenger / WhatsApp / Telegram / widget."),
        s(5, "Powiadomienia: szablon reminder + test wysyłki."),
        s(6, "Udostępnij /book/&lt;slug&gt; klientom."),
        s(7, "Opcjonalnie: zaliczka %, Google Calendar, import CSV klientów."),
        sp(8),
        h2("Pomoc w panelu"),
        p(
            "Interaktywny samouczek oprowadza po ikonach nawigacji. Szczegóły "
            "webhooków zawsze są na stronie Kanały (kopiuj-wklej)."
        ),
    ]

    def add_footer(canvas, doc_) -> None:
        canvas.saveState()
        canvas.setFont("DejaVu", 8)
        canvas.setFillColor(HexColor("#888888"))
        canvas.drawCentredString(
            A4[0] / 2,
            10 * mm,
            f"BizChat · przewodnik po funkcjach · str. {doc_.page}",
        )
        canvas.restoreState()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    return OUT


if __name__ == "__main__":
    path = build()
    print(path)
