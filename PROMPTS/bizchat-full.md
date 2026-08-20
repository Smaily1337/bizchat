# BizChat — pełny prompt produktowy

Rola: Jesteś Senior Full-Stack Developerem, ekspertem od automatyzacji AI oraz UI/UX Designerem.

Zadanie: Zaprojektuj i zbuduj aplikację **BizChat** — inteligentny system rezerwacyjny z wielokanałowym chatbotem oraz dedykowanym panelem administracyjnym (web app) dla właściciela salonu / gabinetu / firmy usługowej.

Cel: Odciążyć recepcję. Bot odpowiada na pytania klientów (cennik, godziny), zarządza kalendarzem w czasie rzeczywistym, rezerwuje wizyty, obsługuje anulacje i no-show, zbiera opinie oraz wysyła powiadomienia do klientów. Wszystko spływa do jednego, ładnego panelu webowego.

## Stos (preferowany)

- Backend: Python FastAPI, PostgreSQL, SQLAlchemy, Alembic
- Frontend panel: React + Vite + TypeScript + Tailwind
- Widget WWW: embeddable JS
- Integracje: Telegram Bot API, Meta (Messenger/Instagram), OpenAI (NLP), Google Calendar (dwukierunkowo), WebSockets (live w panelu)

## Design system (obowiązkowy — „Liquid Glass")

- Tło: głęboki matowy grafit / jasnoczarny (#121417)
- Akcenty i CTA: kanarkowy żółty (#F4E04D)
- Tekst i ikony: biel
- Style: glassmorphism — backdrop-blur, półprzezroczyste panele, delikatne białe obramowania, miękkie cienie
- Typography: ekspresywne fonty (nie Inter/Roboto/Arial/system)
- Bez fioletowych gradientów, bez „cream + terracotta serif", bez przeładowanych kart i badge'y
- Responsywność desktop + mobile
- Animacje: 2–3 celowe micro-interactions (wejście paneli, toast, hover CTA)
- Pierwszy viewport panelu ma wyglądać jak jedna spójna kompozycja produktu, nie jak surowy dashboard z tabelkami

## Moduł BOTA (omnichannel)

Jeden Core Bot Engine + adaptery kanałów:

- Telegram, Messenger, Instagram, widget na stronę WWW
- FAQ z bazy wiedzy (cennik, usługi, godziny)
- Rezerwacja: wolne terminy z wewnętrznego kalendarza (sync z Google Calendar)
- Self-service: odwołanie / zmiana terminu przez klienta
- Smart Waitlist: po anulacji proponuj zwolniony termin osobom z listy oczekujących
- Feedback po wizycie: dobra opinia → link Google/Booksy; zła → alert w panelu
- Opcjonalnie OpenAI do intencji; bez klucza — sensowny fallback rule-based

## Panel ADMINA (Web App) — musi być kompletny i „ładny"

Autoryzacja właściciela (JWT).

Główne widoki:

- **Kalendarz** — widok dzienny / tygodniowy, kolorowe bloki wizyt, szybkie przejścia, podgląd nadchodzących terminów
- **Wizyty** — lista + dodawanie / edycja / anulowanie; wybór istniejącego klienta albo nowego (przełącznik, nie dwa pola naraz)
- **Godziny otwarcia** — dni tygodnia + urlopy / przerwy
- **Ustawienia** — dane firmy, usługi (CRUD), baza FAQ
- **Inbox** — rozmowy z botem na żywo, odpowiedź ręczna właściciela
- **Feedback / Waitlist** — opinie, alerty, kolejka oczekujących
- **Kanały** — status integracji + snippet widgetu
- **Powiadomienia** (ważne):
  - przycisk „Wyślij powiadomienie do klienta" (przypomnienie o wizycie / custom wiadomość)
  - ustawienia automatycznych przypomnień: na ile wcześniej (np. 24h, 2h, 30 min)
  - częstotliwość / reguły: ile przypomnień max na wizytę, kanał (SMS/Telegram/Widget/email — stub OK jeśli brak providera)
  - szablony wiadomości edytowalne
  - podgląd „jak zobaczy klient"
  - log wysłanych powiadomień
- **Dashboard analityczny** — wykresy wizyt/anulacji/no-show, źródła kanałów, luki w kalendarzu dziś, średnia opinii
- **Live toasty (WebSocket)** — nowa rezerwacja, wiadomość, zła opinia, oferta waitlist

## Synchronizacja

- Google Calendar = lustro czasu (dwukierunkowo gdy są credentials; bez nich jasny stub + docs)
- Wewnętrzny kalendarz = źródło prawdy operacyjnej w aplikacji

## Wymagania UX szczegółowe

- Wszystko po polsku w UI
- GlassCard / GlassButton / GlassNav jako design system
- Formularze czytelne, jeden flow na raz
- Empty states z CTA
- Loading / error states
- Panel ma wyglądać jak produkt gotowy do dema inwestorskiego / klienta biznesowego

## Deliverables

- Architektura (modułowa) + struktura folderów monorepo
- Backend z modelami DB, webhookami, API admina, WS eventami
- Frontend panelu z pełną nawigacją i Liquid Glass
- Widget WWW
- docker-compose + .env.example + README (setup lokalny i deploy)
- Seed demo: login, przykładowe wizyty, klienci, FAQ
- Smoke-test: health, login, CRUD wizyt, widget booking, toasty, powiadomienia (nawet mock send)
- Demo login w seedzie

Algorytmy ML no-show mogą być heurystyką; pełny ML opcjonalnie później.
