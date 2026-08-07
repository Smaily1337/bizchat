# BizChat

Omnichannel booking + panel admina (Liquid Glass) dla lokalnych usług. Przyjmuje wiadomości z Telegram / Meta / widgetu WWW przez **Core Bot Engine**, zarządza wizytami, godzinami, feedbackiem i kolejką oczekujących.

## Stack

| Warstwa | Technologie |
|---------|-------------|
| Backend | FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL 16, httpx |
| Auth | PyJWT + bcrypt |
| Frontend | React, Vite, TypeScript, Tailwind — Liquid Glass (`#121417` / `#F4E04D`) |
| Widget | Vanilla JS embed (`widget/bizchat-widget.js`) |
| Infra | Docker Compose (Postgres + backend + frontend/nginx) |

## Szybki start (lokalnie)

```bash
cp .env.example .env

# Postgres (Docker) lub lokalny
docker compose up -d postgres

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload --port 8000
```

W drugim terminalu:

```bash
cd frontend
npm install
npm run dev
```

| Usługa | URL |
|--------|-----|
| Panel admin | http://localhost:5173 |
| API / docs | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| Widget demo | otwórz `widget/index.html` |

**Demo login:** `owner@bizchat.local` / `changeme`

## Docker (pełny stack)

```bash
cp .env.example .env
docker compose up --build
```

- API: http://localhost:8000  
- Panel (nginx): http://localhost:8080  
- Seed uruchamia się automatycznie przy starcie backendu  

## Panel admina — funkcje

- Logowanie JWT, chronione trasy
- **Kalendarz** dzień/tydzień z wizytami z API
- **Wizyty** — lista, dodawanie, edycja, anulowanie
- **Godziny otwarcia** + urlopy (time off)
- **Ustawienia** — nazwa/timezone, usługi, FAQ
- **Feedback** — opinie + alerty (score ≤2) + waitlist FIFO
- **Powiadomienia** — ręczna wysyłka do klienta (szablon lub własna treść), automatyczne przypomnienia (24h/2h/30min + własne czasy, limit na wizytę, kanał SMS/e-mail/Telegram/Widget — mock bez providera), edytowalne szablony z podglądem „jak zobaczy klient", log wysyłek; przycisk „Powiadom" przy każdej wizycie
- **Kanały** — wskazówki webhooków + snippet widgetu

## API (wybrane)

| Metoda | Ścieżka |
|--------|---------|
| POST | `/api/auth/login/json` |
| GET | `/api/auth/me` |
| GET/PATCH | `/api/business` |
| CRUD | `/api/appointments` |
| CRUD | `/api/services`, `/api/customers` |
| GET/PUT | `/api/working-hours` |
| GET/POST/DELETE | `/api/time-off` |
| CRUD | `/api/knowledge` |
| GET/POST | `/api/feedback` |
| GET/POST | `/api/waitlist` |
| GET | `/api/availability` |
| GET | `/api/dashboard/summary` |
| GET/PUT | `/api/notifications/settings` |
| CRUD | `/api/notifications/templates` |
| POST | `/api/notifications/send`, `/api/notifications/preview` |
| GET | `/api/notifications/log` |
| POST | `/webhooks/telegram`, `/webhooks/meta`, `/webhooks/widget` |

## Bot

- FAQ z `knowledge_items` (dopasowanie tokenów)
- Rezerwacja wielokrokowa: usługa → dzień → slot → potwierdzenie
- „moje wizyty”, „anuluj”, lista oczekujących
- OpenAI (`OPENAI_API_KEY`) opcjonalnie poprawia klasyfikację intencji — bez klucza działa rule-based

## Widget

Zobacz [widget/README.md](widget/README.md).

```html
<script src="/widget/bizchat-widget.js"
  data-api="http://localhost:8000"
  data-business-id="YOUR_BUSINESS_UUID"></script>
```

## Google Calendar

1. Ustaw `GOOGLE_CALENDAR_ENABLED=true`
2. OAuth (zalecane): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
   - Utwórz OAuth client w Google Cloud, uzyskaj refresh token ze scope `https://www.googleapis.com/auth/calendar`
3. Albo service account: `GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/sa.json` (+ udostępnij kalendarz kontu SA)
4. Opcjonalnie `GOOGLE_CALENDAR_ID` (domyślnie `primary`)

Bez credentials backend loguje jasny stub i zapisuje `stub-gcal-…` — aplikacja działa normalnie.

## Auth i role

- Rejestracja właściciela (`POST /api/auth/register`) + weryfikacja e-mail
- Google OAuth (`/api/auth/google/start`) — wymaga `GOOGLE_OAUTH_CLIENT_ID` / `SECRET`
- Role: `owner` / `admin` / `pracownik` — panel **Użytkownicy** (CRUD, reset hasła)
- Bez SMTP: linki weryfikacyjne lecą do logów (console mailer / Cloud Logging)

### Google OAuth — instrukcja (konsola Google Cloud)

Client ID **nie da się** utworzyć w pełni non-interactively (Google nie udostępnia publicznego API do tworzenia Web OAuth Client). Consent screen (brand „BizChat”) już istnieje w projekcie.

1. Otwórz bezpośrednio: [Utwórz OAuth client](https://console.cloud.google.com/apis/credentials/oauthclient?project=bizchat-504420)
2. Typ: **Web application**, nazwa: `BizChat Panel`
3. **Authorized JavaScript origins**:
   - `https://bizchat-panel-702906501614.europe-central2.run.app`
4. **Authorized redirect URIs**:
   - `https://bizchat-api-702906501614.europe-central2.run.app/api/auth/google/callback`
5. Utwórz → skopiuj **Client ID** i **Client secret**
6. Ustaw env na Cloud Run API i wypchnij nową revision:

```bash
gcloud run services update bizchat-api \
  --project=bizchat-504420 --region=europe-central2 \
  --update-env-vars="GOOGLE_OAUTH_CLIENT_ID=PASTE_ID,GOOGLE_OAUTH_CLIENT_SECRET=PASTE_SECRET,PUBLIC_API_URL=https://bizchat-api-702906501614.europe-central2.run.app,PUBLIC_FRONTEND_URL=https://bizchat-panel-702906501614.europe-central2.run.app"
```

7. Weryfikacja: `curl -s https://bizchat-api-702906501614.europe-central2.run.app/api/auth/config` → `"google_oauth_enabled":true`

## Deploy (Google Cloud Run — scale-to-zero)

Backend używa **SQLite na volume GCS** (bez Cloud SQL / VM). Panel i API: Cloud Run, `--max-instances=1`, `--allow-unauthenticated`.

```bash
# Bucket na plik SQLite
gcloud storage buckets create gs://bizchat-sqlite-504420 \
  --project=bizchat-504420 --location=europe-central2 --uniform-bucket-level-access

# API
gcloud run deploy bizchat-api \
  --project=bizchat-504420 --region=europe-central2 --source=./backend \
  --allow-unauthenticated --max-instances=1 --min-instances=0 \
  --add-volume=name=data,type=cloud-storage,bucket=bizchat-sqlite-504420 \
  --add-volume-mount=volume=data,mount-path=/data \
  --set-env-vars="DATABASE_URL=sqlite+aiosqlite:////data/bizchat.db,ENVIRONMENT=production,DEBUG=false,AUTO_MIGRATE=true,AUTO_SEED=true,..."

# Panel (po poznaniu URL API)
gcloud run deploy bizchat-panel \
  --project=bizchat-504420 --region=europe-central2 --source=. \
  --dockerfile=frontend/Dockerfile \
  --allow-unauthenticated --max-instances=1 --min-instances=0 \
  --set-build-env-vars=VITE_API_URL=https://bizchat-api-....run.app
```

Demo login po seedzie: `owner@bizchat.local` / `changeme`

Alternatywa lokalna / VPS: `docker compose up --build -d` + silne sekrety i `CORS_ORIGINS`.

## Ograniczenia v1 (OK)

- Brak trenowanego modelu no-show (heurystyki / ręczne statusy)
- Meta/Telegram wymagają realnych tokenów z env, by wysyłać na żywo
- Billing multi-tenant poza zakresem
- Sync GCal bez credentials = stub

## Struktura

```
bizchat/
├── backend/          # FastAPI
├── frontend/         # Admin React
├── widget/           # Embed chat
├── docker-compose.yml
└── .env.example
```
