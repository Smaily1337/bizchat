import { type FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { API_BASE, ApiError, setToken } from "@/api/client";
import { authApi } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { clerkEnabled } from "@/auth/ClerkProvider";
import { useTheme } from "@/theme";

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
  const { theme, toggleTheme } = useTheme();
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
  const [showDemo, setShowDemo] = useState(!clerkEnabled());
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
    <div className="mesh-bg relative flex min-h-screen items-center justify-center px-4 py-10">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-container/60 px-3 py-1.5 text-sm font-semibold text-on-surface backdrop-blur-xl transition hover:border-white/20 sm:right-8 sm:top-8"
        aria-label={theme === "dark" ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      >
        {theme === "dark" ? "Jasny" : "Ciemny"}
      </button>
      <div className="glass-panel animate-fade-up w-full max-w-md p-8 rounded-[28px]">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary-container/20">
            <span className="material-symbols-outlined text-primary text-3xl">spa</span>
          </div>
        </div>

        <div className="text-center">
          <p className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-[#494bd6] to-tertiary-container bg-clip-text text-transparent">
            Automovia
          </p>
          <h1 className="mt-2 font-display text-xl font-semibold text-on-surface">
            {mode === "login" ? "Panel salonu" : "Rejestracja"}
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {mode === "login"
              ? "Zaloguj się przez Clerk (OTP / Google / Apple) albo kontem demo."
              : "Załóż konto właściciela i nowy salon w kilka sekund."}
          </p>
        </div>

        {clerkEnabled() && mode === "login" && (
          <div className="mt-6">
            <ClerkAuthPanel />
          </div>
        )}

        {clerkEnabled() && mode === "login" && (
          <div className="mt-5 flex items-center gap-3 text-xs text-on-surface-variant">
            <span className="h-px flex-1 bg-white/10" />
            <button
              type="button"
              className="shrink-0 underline-offset-2 hover:underline"
              onClick={() => setShowDemo((v) => !v)}
            >
              {showDemo ? "Ukryj logowanie hasłem" : "Konto demo / hasło"}
            </button>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        )}

        {(showDemo || mode === "register") && (
        <>

        <div className="mt-5 flex justify-center text-sm">
          {mode === "login" ? (
            <span className="text-on-surface-variant">
              Nie masz konta?{" "}
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => {
                  setMode("register");
                  setEmail("");
                  setPassword("");
                }}
              >
                Rejestracja
              </button>
            </span>
          ) : (
            <span className="text-on-surface-variant">
              Masz już konto?{" "}
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => setMode("login")}
              >
                Logowanie
              </button>
            </span>
          )}
        </div>

        {mode === "login" && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-surface-container/60 px-3 py-1.5 text-xs text-on-surface hover:border-white/20 transition-all"
              onClick={() => {
                setEmail("admin@bizchat.local");
                setPassword("changeme");
              }}
            >
              Superadmin platformy
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-surface-container/60 px-3 py-1.5 text-xs text-on-surface hover:border-white/20 transition-all"
              onClick={() => {
                setEmail("owner@bizchat.local");
                setPassword("changeme");
              }}
            >
              Demo salon
            </button>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === "register" && (
            <>
              <label className="block space-y-1.5 text-sm">
                <span className="text-on-surface-variant mb-1.5 block">Imię / nazwa</span>
                <input
                  className="glass-input w-full px-4 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-on-surface-variant mb-1.5 block">Nazwa salonu</span>
                <input
                  className="glass-input w-full px-4 py-2"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </label>
            </>
          )}
          <label className="block space-y-1.5 text-sm relative">
            <span className="text-on-surface-variant mb-1.5 block">E-mail</span>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">mail</span>
              <input
                type="email"
                className="glass-input w-full pl-10 pr-4 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </label>
          <label className="block space-y-1.5 text-sm relative">
            <span className="text-on-surface-variant mb-1.5 block">Hasło</span>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">lock</span>
              <input
                type="password"
                className="glass-input w-full pl-10 pr-4 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          </label>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-secondary" role="status">
              {info}
            </p>
          )}
          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2 py-2" disabled={submitting}>
            {submitting ? "Chwila…" : mode === "login" ? "Zaloguj" : "Utwórz konto"}
            {!submitting && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
          </button>
        </form>

        {googleEnabled ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-xs text-on-surface-variant">
              <span className="h-px flex-1 bg-white/10" />
              lub
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <a
              href={`${API_BASE}/api/auth/google/start`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold tracking-wide text-black shadow-canary transition duration-200 ease-out hover:-translate-y-px hover:brightness-105 active:translate-y-0 active:brightness-95"
            >
              <GoogleMark />
              Zaloguj przez Google
            </a>
          </div>
        ) : (
          import.meta.env.DEV && (
            <p className="mt-4 text-[11px] text-on-surface-variant/80">
              Google OAuth wyłączony lokalnie — ustaw GOOGLE_OAUTH_CLIENT_ID /
              SECRET.
            </p>
          )
        )}

        <p className="mt-5 text-xs text-on-surface-variant text-center">
          Demo salon: owner@bizchat.local / changeme
          <br />
          Platforma: admin@bizchat.local / changeme (albo Google z uprawnieniami
          platform admin)
        </p>
        </>
        )}
      </div>
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
