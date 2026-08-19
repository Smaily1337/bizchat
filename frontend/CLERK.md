# Clerk w panelu Automovia (React / Vite)

Clerk jest podpięty do **`frontend/`** (Vite + React), nie tylko do Next (`web/`).

## Jak działa

1. Logujesz się przez Clerk (OTP / Google / Apple) na `/login`
2. Front bierze JWT Clerka → `POST /api/auth/clerk`
3. API weryfikuje JWT (JWKS) i wydaje **zwykły token BizChat**
4. Reszta panelu działa jak wcześniej (`apiFetch` + `ProtectedRoute`)

Demo login (hasło) nadal działa.

## Env

**Frontend** `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Backend** (`.env` w root lub `backend/`):
```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER=https://YOUR.clerk.accounts.dev
```

## Start lokalnie

```bash
# API
cd backend && uvicorn app.main:app --reload --port 8000

# Panel
cd frontend && npm install && npm run dev
```

Otwórz http://localhost:5173/login
