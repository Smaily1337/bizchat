# Clerk authentication (Next.js 14 App Router)

Self-contained Next.js app under `web/` with Clerk passwordless OTP + Google/Apple SSO,
Dark Glassmorphism auth pages, protected `/dashboard`, and a FastAPI JWT verification example.

## 1. Install Clerk (Next.js)

```bash
cd web
npm install @clerk/nextjs @clerk/themes
# or full deps:
npm install
```

Exact Clerk packages:

```bash
npm install @clerk/nextjs @clerk/themes
```

## 2. Clerk Dashboard configuration (OTP + SSO)

In [Clerk Dashboard](https://dashboard.clerk.com) → your application:

1. **User & Authentication → Email, Phone, Username**
   - Enable **Email address**
   - Enable **Email verification code** (OTP) for sign-in / sign-up
   - Disable **Password** if you want passwordless-only
2. **User & Authentication → Social Connections**
   - Enable **Google**
   - Enable **Apple** (requires Apple Developer credentials)
3. **Paths**
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in/up: `/dashboard`

Copy keys into `web/.env.local` (see `.env.example`).

## 3. Folder structure

```
web/
├── middleware.ts                          # Protect /dashboard (and non-public routes)
├── app/
│   ├── layout.tsx                         # <ClerkProvider>
│   ├── page.tsx                           # Marketing / entry
│   ├── globals.css
│   ├── sign-in/[[...sign-in]]/page.tsx    # Custom Dark Glass SignIn
│   ├── sign-up/[[...sign-up]]/page.tsx    # Custom Dark Glass SignUp
│   └── dashboard/page.tsx                 # Protected (middleware + auth())
├── components/
│   ├── AuthShell.tsx                      # bg-black/40 + backdrop-blur-md + border-white/10
│   └── ApiTokenDemo.tsx                   # getToken() → FastAPI Bearer
├── lib/clerk-appearance.ts
└── backend-examples/fastapi_clerk_auth.py
```

## 4. Run Next.js

```bash
cd web
cp .env.example .env.local   # paste real Clerk keys
npm install
npm run dev
```

Open http://localhost:3000/sign-in

## 5. Pass Clerk token to Python (FastAPI)

### Frontend (browser)

```ts
"use client";
import { useAuth } from "@clerk/nextjs";

const { getToken } = useAuth();
const token = await getToken(); // short-lived session JWT

await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Frontend (Server Component / Route Handler)

```ts
import { auth } from "@clerk/nextjs/server";

const { getToken } = await auth();
const token = await getToken();
```

### Backend

1. In Clerk Dashboard → **API Keys** / JWT, copy **JWKS URL** and **Issuer** (Frontend API URL).
2. Run the example:

```bash
export CLERK_JWKS_URL="https://YOUR_INSTANCE.clerk.accounts.dev/.well-known/jwks.json"
export CLERK_ISSUER="https://YOUR_INSTANCE.clerk.accounts.dev"
export CLERK_AUTHORIZED_PARTIES="http://localhost:3000"
pip install fastapi uvicorn "PyJWT[crypto]" httpx
uvicorn backend-examples.fastapi_clerk_auth:app --reload --port 8000
```

Never send `CLERK_SECRET_KEY` to the browser. Verify JWTs with JWKS on the API; use the secret only for Clerk Backend API (user lookup, etc.).

## Middleware summary

`middleware.ts` uses `clerkMiddleware` + `createRouteMatcher`. Public: `/`, `/sign-in`, `/sign-up`. Everything else (including `/dashboard`) calls `auth.protect()`.
