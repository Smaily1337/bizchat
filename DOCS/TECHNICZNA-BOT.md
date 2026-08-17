# BizChat — dokumentacja techniczna (bot + wdrożenie)

Przewodnik dla osoby wdrażającej i utrzymującej BizChat: instalacja, Messenger, zmienne środowiskowe, typowe błędy i co z nimi zrobić.

---

## 1. Co to jest

BizChat to system rezerwacji z chatbotem omnichannel i panelem admina.

| Element | Rola |
|---------|------|
| **Core Bot Engine** | Intencje + FAQ + rezerwacja wielokrokowa |
| **Adaptery** | Telegram, Meta (Messenger/IG), widget WWW |
| **Panel** | Kalendarz, wizyty, inbox, powiadomienia, użytkownicy |
| **Platforma** (`/platform`) | Superadmin: konta, firmy, statystyki landingu |

**Produkcja (projekt GCP `bizchat-504420`, region `europe-central2`):**

| Usługa | URL |
|--------|-----|
| API | https://bizchat-api-702906501614.europe-central2.run.app |
| Panel | https://bizchat-panel-702906501614.europe-central2.run.app |
| Landing | https://bizchat-landing-702906501614.europe-central2.run.app |
| Health | https://bizchat-api-702906501614.europe-central2.run.app/health |
| OpenAPI | https://bizchat-api-702906501614.europe-central2.run.app/docs |

**Konta demo (seed):**

| Konto | Hasło | Rola |
|-------|-------|------|
| `owner@bizchat.local` | `changeme` | właściciel salonu |
| `admin@bizchat.local` | `changeme` | platform admin (`/platform`) |

---

## 2. Architektura bota (skrót)

```
Klient (Messenger / Telegram / Widget)
        │
        ▼
  POST /webhooks/meta|telegram|widget
        │
        ▼
  Adapter → InboundMessage
        │
        ▼
  CoreBotEngine
    ├─ detect_intent (słowa kluczowe + opcjonalnie OpenAI)
    ├─ FAQ (knowledge_items)
    └─ booking: usługa → dzień → slot → potwierdzenie
        │
        ▼
  Adapter.send_outbound → odpowiedź do klienta
```

Kluczowe pliki:

| Plik | Opis |
|------|------|
| `backend/app/bot/engine.py` | Silnik rozmowy i rezerwacji |
| `backend/app/bot/dates.py` | Parsowanie dat po polsku |
| `backend/app/bot/intents.py` | Intencje (powitanie, booking, …) |
| `backend/app/bot/adapters/meta.py` | Messenger / Instagram |
| `backend/app/api/webhooks/meta.py` | Webhook Meta + verify |
| `backend/app/services/availability.py` | Wolne sloty |
| `backend/app/services/notifications.py` | Powiadomienia (kanał = kanał rezerwacji) |

---

## 3. Instalacja lokalna

### Wymagania
- Python 3.11+
- Node 20+
- Docker (Postgres) albo lokalny PostgreSQL
- `git`

### Kroki

```bash
git clone https://github.com/Smaily1337/bizchat.git
cd bizchat
cp .env.example .env

docker compose up -d postgres

cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload --port 8000
```

Drugi terminal:

```bash
cd frontend
npm install
npm run dev
```

| Usługa | URL |
|--------|-----|
| Panel | http://localhost:5173 |
| API | http://localhost:8000 |
| Docs API | http://localhost:8000/docs |

Pełny stack: `docker compose up --build`.

---

## 4. Deploy na Google Cloud Run

### Z Cloud Shell (zalecane w przeglądarce)

1. https://console.cloud.google.com/?project=bizchat-504420  
2. Ikona **Cloud Shell** (`>_`)  
3. Przykład aktualizacji API z brancha:

```bash
git clone https://github.com/Smaily1337/bizchat.git
cd bizchat
git pull

gcloud run deploy bizchat-api \
  --source ./backend \
  --project=bizchat-504420 \
  --region=europe-central2 \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=1 \
  --quiet
```

### Panel (osobny build)

```bash
IMAGE=europe-central2-docker.pkg.dev/bizchat-504420/cloud-run-source-deploy/bizchat-panel:latest

gcloud builds submit . \
  --project=bizchat-504420 \
  --config=cloudbuild.panel.yaml \
  --substitutions="_IMAGE=${IMAGE},_VITE_API_URL=https://bizchat-api-702906501614.europe-central2.run.app"

gcloud run deploy bizchat-panel \
  --image="$IMAGE" \
  --project=bizchat-504420 --region=europe-central2 \
  --allow-unauthenticated --max-instances=1 --quiet
```

### Baza
Produkcja: **SQLite na GCS** (`gs://bizchat-sqlite-504420/bizchat.db`), volume montowany w `/data`.  
Lokalnie: PostgreSQL.

**Uwaga:** SQLite + GCS Fuse — nie używaj `journal_mode=WAL` (psuje się `-shm`). Bootstrap ustawia `DELETE`.

---

## 5. Konfiguracja Messengera (Meta)

### Checklist

1. [developers.facebook.com](https://developers.facebook.com/) → aplikacja (np. `testowa aplikacja`)
2. Use case **Messenger**
3. **Messenger API Settings**
4. Podłącz **Facebook Page** (np. TEST API)
5. Webhook:
   - **Callback URL:**  
     `https://bizchat-api-702906501614.europe-central2.run.app/webhooks/meta`
   - **Verify token:** `bizchat-verify` (musi = `META_VERIFY_TOKEN`)
6. Subskrypcje przy Page: **`messages`**, **`messaging_postbacks`**
7. **Generate** → Page Access Token
8. App Settings → Basic → **App Secret** (opcjonalnie, do podpisu)
9. Env na Cloud Run:

```bash
gcloud run services update bizchat-api \
  --project=bizchat-504420 --region=europe-central2 \
  --update-env-vars="META_VERIFY_TOKEN=bizchat-verify,META_PAGE_ACCESS_TOKEN=EAAxxx...,META_DEFAULT_BUSINESS_ID=93470a1e-0c87-46e7-a448-bd5d13ebffef,META_APP_SECRET=opcjonalnie"
```

`META_DEFAULT_BUSINESS_ID` = UUID salonu (demo: z JWT/`/api/auth/me` po loginie ownera). Dzięki temu Callback URL **nie musi** mieć `?business_id=` (Meta czasem odrzuca verify z query).

### Test
Napisz na Page: https://m.me/1280603841801131 (ID zależy od Twojej Page).  
W panelu → **Inbox**.

W trybie **In development** bot odpowiada tylko adminom/developerom/testerom apki.

### NIP / Business Verification
- **Testy / demo:** NIP niepotrzebny  
- **Publiczny bot dla wszystkich:** zwykle weryfikacja firmy w Meta Business Manager (dokumenty / NIP)

---

## 6. Zmienne środowiskowe (ważne)

| Zmienna | Po co |
|---------|--------|
| `DATABASE_URL` | Postgres lokalnie / `sqlite+aiosqlite:////data/bizchat.db` na Cloud Run |
| `SECRET_KEY` | JWT |
| `CORS_ORIGINS` | URL panelu (i landingu) |
| `PUBLIC_API_URL` / `PUBLIC_FRONTEND_URL` | OAuth, linki |
| `META_VERIFY_TOKEN` | Weryfikacja webhooka Meta |
| `META_PAGE_ACCESS_TOKEN` | Wysyłka na Messenger |
| `META_APP_SECRET` | Sprawdzanie podpisu `X-Hub-Signature-256` |
| `META_DEFAULT_BUSINESS_ID` | Domyślny salon dla Meta |
| `TELEGRAM_BOT_TOKEN` | Telegram (opcjonalnie) |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET` | Logowanie Google do panelu |
| `OPENAI_API_KEY` | Lepsze intencje (opcjonalnie) |
| `AUTO_SEED` | Seed demo przy starcie |

Pełna lista: `.env.example`.

---

## 7. Jak działa rezerwacja w bocie

1. Klient: „umów wizytę”  
2. Bot: lista usług → numer lub nazwa  
3. Bot: pyta o dzień  
4. Bot: wolne godziny → numer lub `HH:MM`  
5. Bot: „tak” / „nie”

### Daty, które bot rozumie (`app/bot/dates.py`)

| Przykład | Znaczenie |
|----------|-----------|
| `2026-08-23` | ISO |
| `23.08` / `15.12.2026` | DD.MM |
| `23 sierpnia` / `15 grudnia` | dzień + miesiąc PL |
| `jutro` / `pojutrze` / `dziś` | względne |
| `za 3 dni` | +N dni |
| `piątek` / `w poniedziałek` | najbliższy dzień tygodnia |
| `grudzień` | sam miesiąc → lista wolnych dni do wyboru |

### Godziny (krok slotu)

| Przykład | Znaczenie |
|----------|-----------|
| `1` / `nr 3` | numer z listy |
| `12:00` / `16.30` | konkretna godzina |
| `o 12` / `12 godziny` | godzina (minuty = 00) |

Bot pokazuje sloty **rozłożone w ciągu dnia** (nie tylko pierwsze z rana). Jeśli wpiszesz godzinę spoza krótkiej listy, ale wolną tego dnia — i tak ją przyjmie (albo najbliższą ±30 min).

**Nie trzeba** już podawać wyłącznie `RRRR-MM-DD`.

---

## 8. Powiadomienia („Powiadom”)

Przycisk przy wizycie wysyła na **ten sam kanał, którym zrobiono rezerwację**:

| Kanał wizyty | Dostawa |
|--------------|---------|
| `messenger` | Meta Graph API |
| `instagram` | Meta |
| `telegram` | Telegram Bot API |
| `widget` | stub / mock |
| `admin` | domyślny z ustawień (np. SMS mock) |

Automatyczne przypomnienia (worker) też mapują kanał z wizyty.

---

## 9. Typowe błędy i co zrobić

### Meta / webhook

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| Verify: „couldn't be validated” / „retry verify token” | Cold start Cloud Run albo zły token / URL z `?business_id=` | `META_VERIFY_TOKEN=bizchat-verify`, prosty URL bez query, chwilowo `--min-instances=1`, kliknij Verify jeszcze raz |
| Bot milczy po wiadomości | Brak subskrypcji `messages` | Page → Add Subscriptions → `messages` + `messaging_postbacks` |
| „brak business_id” | Webhook bez salonu | Ustaw `META_DEFAULT_BUSINESS_ID` albo `?business_id=<UUID>` |
| Connect Page: „No FB pages yet” | Page nie w Business Manager | Dodaj Page w business.facebook.com → wróć → Connect |
| Odpowiedź tylko do Ciebie | App In development | Dodaj testerów w Roles albo App Review + Live |
| Wysyłka fail / brak odpowiedzi | Zły/expired Page token, okno 24h | Nowy Generate token + update env |
| W Inboxie „Klient” zamiast imienia | Brak profilu FB | Uprawnienie `pages_user_profile` + nowa wiadomość od klienta |

### Panel / API

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| Kalendarz: **Błąd: Load failed** | `/api/dashboard/analytics` 500 (daty naive/aware SQLite) | Zaktualizowany `dashboard.py` (już naprawione w main); odśwież panel |
| Wizyty widać, kalendarz pusty | Inny tydzień / filtr dat | Przełącz widok tygodnia; seedowe wizyty mogą być na inny dzień |
| Brak przycisku Google | Brak Client ID w env | Ustaw `GOOGLE_OAUTH_*` (instrukcja w README) |
| 401 przy logowaniu | Złe hasło / wyczyszczona baza SQLite | Seed / `AUTO_SEED=true` / `owner@bizchat.local` / `changeme` |

### Bot / rezerwacja

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| „Podaj RRRR-MM-DD” | Stara wersja API | Redeploy brancha z `dates.py` |
| „Brak wolnych terminów” | Zamknięty dzień / brak WorkingHours | Panel → Godziny otwarcia |
| Grudzień / daleka data nie działa | Brak godzin na te dni tygodnia | Sprawdź grafik; bot przy miesiącu listuje tylko dni z wolnymi slotami |
| Odpowiedź „TY” w Inboxie bez reakcji bota | To wiadomość **właściciela** z panelu | Bot odpowiada tylko na wiadomości **klienta** z kanału |

### Cloud Run / baza

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| 500 + błędy `bizchat.db-shm` / GCSFuse | WAL na GCS | `PRAGMA journal_mode=DELETE` (bootstrap), unikaj WAL |
| Utrata env po deploy | `--set-env-vars` nadpisuje | Preferuj `--update-env-vars`; sprawdź `gcloud run services describe` |
| Panel build fail przy `--source frontend` | Dockerfile liczy na root repo | Buduj z `cloudbuild.panel.yaml` z katalogu głównego |

### Logi

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="bizchat-api"' \
  --project=bizchat-504420 --limit=50
```

Szukaj: `webhooks/meta`, `Meta send failed`, `Traceback`.

---

## 10. Szybka diagnostyka Messengera

```bash
# 1) Health
curl -s https://bizchat-api-702906501614.europe-central2.run.app/health

# 2) Verify (jak Meta)
curl -s "https://bizchat-api-702906501614.europe-central2.run.app/webhooks/meta?hub.mode=subscribe&hub.verify_token=bizchat-verify&hub.challenge=test123"
# oczekiwane: test123

# 3) Env Meta
gcloud run services describe bizchat-api \
  --project=bizchat-504420 --region=europe-central2 \
  --format='yaml(spec.template.spec.containers[0].env)' | grep META_
```

Po napisaniu do Page w logach powinien być `POST /webhooks/meta` → `200`.

---

## 11. Role i bezpieczeństwo

| Rola | Może |
|------|------|
| `owner` / `admin` | Pełny panel salonu, użytkownicy, powiadomienia |
| `pracownik` | Ograniczony dostęp (bez zarządzania użytkownikami) |
| `is_platform_admin` | `/platform` — wszystkie konta/firmy, pageviews |

Nie commituj tokenów Meta / OAuth secretów do gita. Trzymaj je w Cloud Run env (docelowo Secret Manager).

---

## 12. Checklist „bot działa na produkcji”

- [ ] `GET /health` → 200  
- [ ] Meta Verify and save OK  
- [ ] Subskrypcje `messages` + `messaging_postbacks`  
- [ ] `META_PAGE_ACCESS_TOKEN` + `META_DEFAULT_BUSINESS_ID` na API  
- [ ] Wiadomość testowa w Messengerze → odpowiedź + wpis w Inbox  
- [ ] Rezerwacja: „umów wizytę” → usługa → „jutro” → slot → „tak”  
- [ ] Wizyta w panelu (Wizyty / Kalendarz)  
- [ ] „Powiadom” przy wizycie z Messengera → wiadomość w czacie  

---

## 13. Powiązane dokumenty

- [README.md](../README.md) — overview, OAuth, deploy  
- [widget/README.md](../widget/README.md) — embed widgetu  
- `.env.example` — komplet zmiennych  

---

*Ostatnia aktualizacja treści: sierpień 2026 — obejmuje naturalne daty PL, Messenger na Cloud Run, powiadomienia po kanale rezerwacji.*
