# Automovia Web — Clerk auth (Next.js 14)

## Dlaczego localhost „nie działał”

Bez pliku **`.env.local`** z kluczami Clerka Next.js nie odpala logowania (puste `pk_` / brak kluczy → błąd na `/sign-in`).

W Cloud Agent nie da się otworzyć `clerk auth login` w przeglądarce, więc używamy **keyless** (tymczasowe klucze deweloperskie). Na Twoim laptopie podłączysz właściwą aplikację Clerka.

## Odpalanie u Ciebie (zalecane)

```bash
# 1) CLI
curl -fsSL https://clerk.com/install | bash
export PATH="$HOME/.local/bin:$PATH"

# 2) Wejdź w projekt
cd web
npm install

# 3) Zaloguj się do Clerka (otworzy przeglądarkę)
clerk auth login

# 4) Podłącz TWOJĄ aplikację Clerk
clerk init --app app_3I7o5cifFaWX3i8CFJx6VpzFOr8 -y --no-skills

# 5) Start
npm run dev
```

Otwórz:
- http://localhost:3000 — przyciski **Sign up / Sign in** u góry
- http://localhost:3000/sign-up — rejestracja
- http://localhost:3000/sign-in — logowanie

Po rejestracji w nav pojawi się avatar (`UserButton`).

## Szybki start bez logowania do Clerka (keyless)

```bash
cd web
npm install
clerk init --framework next --pm npm --keyless -y --no-skills
npm run dev
```

albo:

```bash
./start-dev.sh
```

## Dashboard Clerka (OTP + Google/Apple)

W aplikacji `app_3I7o5cifFaWX3i8CFJx6VpzFOr8`:
1. Email → **Email verification code** ON, Password OFF (opcjonalnie)
2. Social → Google + Apple ON

## Health check

```bash
clerk doctor
```
