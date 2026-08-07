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
            ? "Zaloguj się, aby zarządzać wizytami i ustawieniami salonu."
            : "Załóż konto właściciela i nowy salon w kilka sekund."}
        </p>

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

        {googleEnabled && (
          <a
            href={`${API_BASE}/api/auth/google/start`}
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-glass-border bg-glass-fill px-4 py-2.5 text-sm font-medium text-white transition hover:border-canary/40 hover:bg-glass-fillStrong"
          >
            Kontynuuj z Google
          </a>
        )}

        {!googleEnabled && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Google OAuth: ustaw <code>GOOGLE_OAUTH_CLIENT_ID</code> i secret w
            backendzie (instrukcja w README).
          </p>
        )}

        <p className="mt-5 text-xs text-[var(--muted)]">
          Demo: owner@bizchat.local / changeme
        </p>
      </GlassCard>
    </div>
  );
}
