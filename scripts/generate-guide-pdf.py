#!/usr/bin/env python3
"""Generate BizChat Polish user guide PDF."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "BizChat-przewodnik.pdf"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


class Guide(FPDF):
    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "", 9)
        self.set_text_color(120, 120, 120)
        self.set_x(self.l_margin)
        self.cell(0, 8, f"BizChat — przewodnik po funkcjach    {self.page_no()}", align="L", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(200, 200, 200)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 8, "BizChat · panel salonu · omnichannel rezerwacje", align="C")

    def h1(self, text: str) -> None:
        self.ln(4)
        self.set_font("DejaVu", "B", 16)
        self.set_text_color(20, 20, 20)
        self.set_x(self.l_margin)
        self.multi_cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def h2(self, text: str) -> None:
        self.ln(3)
        self.set_font("DejaVu", "B", 12)
        self.set_text_color(30, 30, 30)
        self.set_x(self.l_margin)
        self.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body(self, text: str) -> None:
        self.set_font("DejaVu", "", 10)
        self.set_text_color(40, 40, 40)
        self.set_x(self.l_margin)
        self.multi_cell(0, 5.5, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def bullet(self, text: str) -> None:
        self.set_font("DejaVu", "", 10)
        self.set_text_color(40, 40, 40)
        self.set_x(self.l_margin)
        self.multi_cell(0, 5.5, f"•  {text}", new_x="LMARGIN", new_y="NEXT")

    def step(self, n: int, text: str) -> None:
        self.set_font("DejaVu", "", 10)
        self.set_text_color(40, 40, 40)
        self.set_x(self.l_margin)
        self.multi_cell(0, 5.5, f"{n}.  {text}", new_x="LMARGIN", new_y="NEXT")

    def note(self, text: str) -> None:
        self.set_fill_color(245, 245, 245)
        self.set_font("DejaVu", "", 9)
        self.set_text_color(60, 60, 60)
        self.set_x(self.l_margin)
        self.multi_cell(0, 5, f"Uwaga: {text}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)


def build() -> Path:
    pdf = Guide(format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("DejaVu", "", FONT)
    pdf.add_font("DejaVu", "B", FONT_B)
    pdf.set_margins(18, 18, 18)

    # --- Cover ---
    pdf.add_page()
    pdf.ln(40)
    pdf.set_font("DejaVu", "B", 28)
    pdf.set_text_color(15, 15, 15)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 14, "BizChat", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 14)
    pdf.set_text_color(80, 80, 80)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 8, "Przewodnik po funkcjach panelu", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("DejaVu", "", 11)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(
        0,
        6,
        "Jak korzystać z kalendarza, Inbox, klientów, kanałów (Messenger, WhatsApp,\n"
        "Telegram, widget), publicznej rezerwacji, zaliczek, raportów i zespołu.",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(16)
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 6, "Wersja produktu: salon feature pack · 2026", align="C", new_x="LMARGIN", new_y="NEXT")

    # --- 1 Intro ---
    pdf.add_page()
    pdf.h1("1. Co to jest BizChat?")
    pdf.body(
        "BizChat to panel salonu + bot rezerwacyjny na Messengerze, WhatsAppie, "
        "Telegramie i widgetcie WWW. Bot umawia wizyty, a Ty zarządzasz kalendarzem, "
        "odpisujesz klientom i wysyłasz przypomnienia z jednego miejsca."
    )
    pdf.h2("Do czego służy")
    pdf.bullet("Automatyczne umawianie wizyt przez chat (bot).")
    pdf.bullet("Ręczna obsługa rozmów i outreach do klientów.")
    pdf.bullet("Publiczna strona rezerwacji (link do bio / Google).")
    pdf.bullet("Przypomnienia z potwierdzeniem jednym kliknięciem.")
    pdf.bullet("Raporty: wizyty, no-show, skąd przyszli klienci.")

    pdf.h2("Logowanie")
    pdf.step(1, "Otwórz panel (Cloud Run / localhost:5173).")
    pdf.step(2, "Zaloguj się e-mailem i hasłem albo Google.")
    pdf.step(3, "Po pierwszym wejściu uruchomi się krótki samouczek (można pominąć).")
    pdf.note(
        "Samouczek możesz włączyć ponownie przyciskiem „Samouczek” w górnym pasku "
        "albo na stronie Kanały."
    )

    # --- 2 Nav ---
    pdf.h1("2. Nawigacja panelu")
    items = [
        ("Kalendarz", "Widok dnia/tygodnia z wizytami."),
        ("Wizyty", "Lista, dodawanie, edycja, anulowanie, przypomnienia."),
        ("Inbox", "Rozmowy z kanałów + „Nowa wiadomość”."),
        ("Klienci", "Baza klientów, PSID, import CSV, napisz na Messenger."),
        ("Zespół", "Specjaliści (stylista / fryzjer) do przypisania wizyt."),
        ("Godziny", "Godziny otwarcia i urlopy — bot widzi tylko wolne sloty."),
        ("Raporty", "Statystyki 7/30/90 dni + eksport CSV."),
        ("Powiadomienia", "Szablony SMS/e-mail/Messenger/WhatsApp."),
        ("Kanały", "Webhooki, setup Meta/Telegram/WhatsApp/widget."),
        ("Ustawienia", "Nazwa, slug rezerwacji, zaliczka %, Google Calendar, usługi, FAQ."),
    ]
    for title, desc in items:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("DejaVu", "B", 10)
        pdf.set_text_color(20, 20, 20)
        pdf.multi_cell(0, 5.5, f"{title} — {desc}", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("DejaVu", "", 10)

    # --- 3 Calendar / Appointments ---
    pdf.h1("3. Kalendarz i wizyty")
    pdf.h2("Kalendarz")
    pdf.body(
        "Na stronie głównej widzisz grafik. Przydatny do szybkiego podglądu dnia. "
        "Szczegóły i zmiany statusów robisz w zakładce Wizyty."
    )
    pdf.h2("Wizyty — jak dodać")
    pdf.step(1, "Wejdź w Wizyty → Dodaj wizytę.")
    pdf.step(2, "Wybierz klienta z listy albo utwórz nowego (imię, telefon, e-mail).")
    pdf.step(3, "Wybierz usługę, opcjonalnie specjalistę z Zespołu, datę i godzinę.")
    pdf.step(4, "Ustaw status (np. Potwierdzona) i zapisz.")
    pdf.h2("Statusy")
    pdf.bullet("Oczekuje / Potwierdzona — aktywne, zajmują slot.")
    pdf.bullet("Anulowana — zwalnia termin (może odpalić waitlistę).")
    pdf.bullet("Zakończona / Nieobecność (no-show) — do raportów.")
    pdf.h2("Przypomnienie z listy wizyt")
    pdf.body(
        "Przy wizycie kliknij wysyłkę przypomnienia. System wybierze kanał "
        "zgodny z tym, którym klient się umawiał (Messenger / Telegram / …)."
    )

    # --- 4 Inbox ---
    pdf.h1("4. Inbox")
    pdf.body(
        "Tu lądują rozmowy z bota i klientów. Możesz odpisać jako właściciel — "
        "wiadomość idzie na ten sam kanał (Messenger, WhatsApp itd.)."
    )
    pdf.h2("Nowa wiadomość (bez wcześniejszej rozmowy)")
    pdf.step(1, "Kliknij „Nowa wiadomość”.")
    pdf.step(2, "Wybierz klienta, który ma Messenger PSID (lub ID innego kanału).")
    pdf.step(3, "Napisz treść i wyślij — powstanie wątek w Inbox.")
    pdf.note(
        "Facebook nie pozwala na zimny kontakt do kogoś, kto nigdy nie napisał "
        "do fanpage. Potrzebujesz PSID (Page-Scoped ID)."
    )

    # --- 5 Customers ---
    pdf.h1("5. Klienci")
    pdf.h2("Do czego służy")
    pdf.body(
        "Ręczna baza klientów: imię, telefon, e-mail oraz ID kanałów "
        "(Messenger PSID, WhatsApp, Telegram)."
    )
    pdf.h2("Dodanie klienta i wiadomość")
    pdf.step(1, "Wypełnij formularz „Nowy klient” (opcjonalnie wklej Messenger PSID).")
    pdf.step(2, "Zapisz. Przy kliencie użyj „Napisz”, wybierz kanał i treść.")
    pdf.step(3, "Jeśli brak PSID — przycisk „PSID” pozwala go dopisać później.")
    pdf.h2("Import CSV")
    pdf.body("Na stronie Klienci wybierz plik CSV. Wymagany wiersz nagłówka.")
    pdf.bullet("Kolumny: name, phone, email, messenger_psid, whatsapp")
    pdf.bullet("Duplikaty po telefonie/e-mailu są aktualizowane, nie dublowane.")

    # --- 6 Staff ---
    pdf.h1("6. Zespół (multi-staff)")
    pdf.body(
        "Jeśli w salonie pracuje kilku specjalistów, dodaj ich w Zespół. "
        "Potem przy wizycie (panel lub publiczna rezerwacja) możesz wybrać osobę. "
        "Wolne sloty liczą się osobno per specjalista."
    )
    pdf.step(1, "Zespół → wpisz imię → Dodaj.")
    pdf.step(2, "W Wizytach / publicznej rezerwacji wybierz specjalistę.")
    pdf.step(3, "Dezaktywuj osobę, która już nie przyjmuje.")

    # --- 7 Hours ---
    pdf.h1("7. Godziny i dostępność")
    pdf.body(
        "Ustaw godziny otwarcia na każdy dzień tygodnia oraz urlopy/time-off. "
        "Bot i publiczna rezerwacja proponują wyłącznie wolne terminy w tych ramach, "
        "minus zajęte wizyty."
    )

    # --- 8 Channels ---
    pdf.h1("8. Kanały — podłączanie chatów")
    pdf.body(
        "Sekcja Kanały to hub: checklisty, kopiowanie webhooków z business_id, "
        "snippet widgetu i link do publicznej rezerwacji."
    )
    pdf.h2("Messenger / Instagram")
    pdf.step(1, "W Meta Developers dodaj produkt Messenger.")
    pdf.step(2, "Callback URL skopiuj z karty kanału (z ?business_id=…).")
    pdf.step(3, "Verify token = META_VERIFY_TOKEN (domyślnie bizchat-verify).")
    pdf.step(4, "Subskrypcje: messages, messaging_postbacks.")
    pdf.step(5, "Ustaw META_PAGE_ACCESS_TOKEN na API i zredeployuj.")
    pdf.h2("WhatsApp (Cloud API)")
    pdf.step(1, "W Meta Business włącz WhatsApp Cloud API.")
    pdf.step(2, "Ustaw WHATSAPP_PHONE_NUMBER_ID i WHATSAPP_ACCESS_TOKEN.")
    pdf.step(3, "Webhook: URL z karty WhatsApp, verify token jak Meta.")
    pdf.step(4, "Numer klienta trzymaj w external_ids.whatsapp.")
    pdf.h2("Telegram")
    pdf.step(1, "Utwórz bota w @BotFather → TELEGRAM_BOT_TOKEN.")
    pdf.step(2, "Ustaw webhook na URL z karty Telegram.")
    pdf.step(3, "Klient pisze /start — rozmowa w Inbox.")
    pdf.h2("Widget WWW")
    pdf.body(
        "Skopiuj snippet ze strony Kanały, wklej przed </body> na stronie salonu. "
        "Origin strony musi być na liście CORS_ORIGINS API."
    )

    # --- 9 Public booking ---
    pdf.h1("9. Publiczna rezerwacja")
    pdf.body(
        "Strona bez logowania: /book/<slug-lub-uuid>. Klient wybiera usługę, "
        "dzień, godzinę, specjalistę (opcjonalnie) i zostawia dane kontaktowe."
    )
    pdf.h2("Jak włączyć")
    pdf.step(1, "Ustawienia → „Slug publicznej rezerwacji” (np. moj-salon).")
    pdf.step(2, "Zapisz. Link: /book/moj-salon (albo UUID salonu).")
    pdf.step(3, "Dodaj link do bio Instagrama / Google Business / strony.")
    pdf.note(
        "Jeśli ustawisz zaliczkę > 0%, po rezerwacji klient trafi do płatności "
        "(Stripe albo mock, gdy brak klucza Stripe)."
    )

    # --- 10 Deposits ---
    pdf.h1("10. Zaliczki (Stripe)")
    pdf.body(
        "W Ustawieniach ustaw „Zaliczka %” (0–100). Przy publicznej rezerwacji "
        "system liczy kwotę od ceny usługi i tworzy sesję Checkout."
    )
    pdf.bullet("Bez STRIPE_SECRET_KEY — mock pay (demo: oznacza zaliczkę jako opłaconą).")
    pdf.bullet("Ze Stripe — prawdziwa płatność; webhook /api/payments/stripe/webhook.")
    pdf.bullet("Po opłaceniu status wizyty przechodzi na potwierdzoną.")

    # --- 11 Notifications ---
    pdf.h1("11. Powiadomienia i przyciski Messenger")
    pdf.body(
        "W Powiadomieniach edytujesz szablony (placeholdery: {{klient}}, {{usluga}}, "
        "{{data}}, {{godzina}}, {{firma}}, {{cena}}). Przypomnienia lecą automatycznie "
        "przed wizytą według lead time (np. 24h / 2h / 30 min)."
    )
    pdf.h2("Potwierdzam / Odwołuję")
    pdf.body(
        "Reminder na Messengerze (i WhatsApp, gdy skonfigurowany) dostaje szybkie "
        "przyciski. Klient klika — wizyta jest potwierdzana albo anulowana bez "
        "wejścia do panelu."
    )

    # --- 12 GCal ---
    pdf.h1("12. Google Calendar")
    pdf.body(
        "W Ustawieniach wpisz Google Calendar ID (np. primary). Na serwerze API "
        "muszą być: GOOGLE_CALENDAR_ENABLED=true oraz refresh token / service account. "
        "Przy tworzeniu, zmianie i anulowaniu wizyty BizChat synchronizuje wydarzenie."
    )

    # --- 13 Reports ---
    pdf.h1("13. Raporty")
    pdf.body(
        "Zakładka Raporty: wizyty, wskaźnik no-show, anulacje oraz rozkład po kanałach "
        "za 7 / 30 / 90 dni. Przycisk Export CSV ściąga plik do Excela / Sheets."
    )

    # --- 14 Settings ---
    pdf.h1("14. Ustawienia — usługi i FAQ")
    pdf.bullet("Usługi: nazwa, czas trwania, cena — bot i rezerwacja z nich korzystają.")
    pdf.bullet("Baza wiedzy (FAQ): pytania i odpowiedzi dla bota.")
    pdf.bullet("Licencja: limity rezerwacji / wiadomości / miejsc w panelu.")

    # --- 15 Checklist ---
    pdf.h1("15. Szybka checklista startowa")
    pdf.step(1, "Ustawienia: nazwa salonu, strefa, slug, usługi, FAQ.")
    pdf.step(2, "Godziny otwarcia.")
    pdf.step(3, "Zespół (jeśli wielu specjalistów).")
    pdf.step(4, "Kanały: podłącz Messenger / WhatsApp / Telegram / widget.")
    pdf.step(5, "Powiadomienia: szablon reminder + test wysyłki.")
    pdf.step(6, "Udostępnij /book/<slug> klientom.")
    pdf.step(7, "Opcjonalnie: zaliczka %, Google Calendar, import CSV klientów.")

    pdf.ln(6)
    pdf.h2("Pomoc w panelu")
    pdf.body(
        "Interaktywny samouczek oprowadza po ikonach nawigacji. "
        "Szczegóły webhooków zawsze są na stronie Kanały (kopiuj-wklej)."
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    return OUT


if __name__ == "__main__":
    path = build()
    print(path)
