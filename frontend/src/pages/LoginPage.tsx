import { type FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { API_BASE, ApiError, setToken } from "@/api/client";
import { authApi } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

/** Credentials or JWT passed from landing / OAuth in the URL fragment. */
function readHashAuth(hash: string): {
  email?: string;
  password?: string;
  token?: string;
} | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const token = params.get("token") || undefined;
  const email = params.get("email") || undefined;
  const password = params.get("password") || undefined;
  if (!token && !(email && password)) return null;
  return { email, password, token };
}

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) {
    return "Nieprawidłowy e-mail lub hasło.";
  }
  if (err instanceof ApiError) {
    return err.detail || "Logowanie nieudane";
  }
  return "Logowanie nieudane — sprawdź połączenie z serwerem.";
}

export function LoginPage() {
  const { token, loading, login, acceptToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("owner@bizchat.local");
  const [password, setPassword] = useState("changeme");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const autoLoginTried = useRef(false);

  useEffect(() => {
    authApi
      .config()
      .then((c) => setGoogleEnabled(c.google_oauth_enabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("oauth_error")) {
      setError("Logowanie Google nie powiodło się. Sprawdź konfigurację OAuth.");
    }
  }, [location.search]);

  const hash = location.hash || window.location.hash;
  useEffect(() => {
    if (token || autoLoginTried.current) return;
    const creds = readHashAuth(hash);
    if (!creds) return;
    autoLoginTried.current = true;
    navigate(location.pathname, { replace: true });
    setSubmitting(true);
    if (creds.token) {
      acceptToken(creds.token)
        .catch((err: unknown) => setError(loginErrorMessage(err)))
        .finally(() => setSubmitting(false));
      return;
    }
    if (creds.email && creds.password) {
      setEmail(creds.email);
      setPassword(creds.password);
      login(creds.email, creds.password)
        .catch((err: unknown) => setError(loginErrorMessage(err)))
        .finally(() => setSubmitting(false));
    }
  }, [hash, token, login, acceptToken, navigate, location.pathname]);

  if (!loading && token) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname;
    return <Navigate to={from || "/"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const res = await authApi.register({
          email,
          password,
          name: name || undefined,
          business_name: businessName,
        });
        setToken(res.access_token);
        await acceptToken(res.access_token);
        setInfo(
          "Konto utworzone. Link weryfikacyjny e-mail jest w logach serwera (console mailer), dopóki nie ustawisz SMTP.",
        );
      }
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="animate-fade-up w-full max-w-md">
        <p className="font-display text-4xl font-extrabold tracking-tight">
          BizChat
        </p>
        <h1 className="mt-2 font-display text-xl font-semibold text-canary">
          {mode === "login" ? "Panel admina" : "Rejestracja"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === "login"
            ? "Zaloguj się, aby zarządzać wizytami i ustawieniami salonu. Panel Platforma wymaga konta z flagą platform admin."
            : "Załóż konto właściciela i nowy salon w kilka sekund."}
        </p>

        {mode === "login" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <GlassButton
              type="button"
              variant="ghost"
              className="!px-3 !py-1.5 text-xs"
              onClick={() => {
                setEmail("admin@bizchat.local");
                setPassword("changeme");
              }}
            >
              Superadmin platformy
            </GlassButton>
            <GlassButton
              type="button"
              variant="ghost"
              className="!px-3 !py-1.5 text-xs"
              onClick={() => {
                setEmail("owner@bizchat.local");
                setPassword("changeme");
              }}
            >
              Demo salon
            </GlassButton>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <GlassButton
            type="button"
            variant={mode === "login" ? "primary" : "ghost"}
            className="flex-1 !py-2"
            onClick={() => setMode("login")}
          >
            Logowanie
          </GlassButton>
          <GlassButton
            type="button"
            variant={mode === "register" ? "primary" : "ghost"}
            className="flex-1 !py-2"
            onClick={() => {
              setMode("register");
              setEmail("");
              setPassword("");
            }}
          >
            Rejestracja
          </GlassButton>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === "register" && (
            <>
              <label className="block space-y-1.5 text-sm">
                <span className="text-[var(--muted)]">Imię / nazwa</span>
                <GlassInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-[var(--muted)]">Nazwa salonu</span>
                <GlassInput
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </label>
            </>
          )}
          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">E-mail</span>
            <GlassInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">Hasło</span>
            <GlassInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-[var(--success)]" role="status">
              {info}
            </p>
          )}
          <GlassButton type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? "Chwila…"
              : mode === "login"
                ? "Zaloguj"
                : "Utwórz konto"}
          </GlassButton>
        </form>

        {googleEnabled ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <span className="h-px flex-1 bg-glass-border" />
              lub
              <span className="h-px flex-1 bg-glass-border" />
            </div>
            <a
              href={`${API_BASE}/api/auth/google/start`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-white px-4 py-2.5 text-sm font-semibold tracking-wide text-[var(--on-accent)] shadow-canary transition duration-200 ease-out hover:-translate-y-px hover:brightness-105 active:translate-y-0 active:brightness-95"
            >
              <GoogleMark />
              Zaloguj przez Google
            </a>
          </div>
        ) : (
          import.meta.env.DEV && (
            <p className="mt-4 text-[11px] text-[var(--muted)]/80">
              Google OAuth wyłączony lokalnie — ustaw GOOGLE_OAUTH_CLIENT_ID /
              SECRET.
            </p>
          )
        )}

        <p className="mt-5 text-xs text-[var(--muted)]">
          Demo salon: owner@bizchat.local / changeme
          <br />
          Platforma: admin@bizchat.local / changeme (albo Google z uprawnieniami
          platform admin)
        </p>
      </GlassCard>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.72.13-1.41.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}
