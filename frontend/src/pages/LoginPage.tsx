import { type FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { API_BASE, ApiError, setToken } from "@/api/client";
import { authApi } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { ClerkAuthPanel } from "@/auth/ClerkAuthPanel";
import { clerkEnabled } from "@/auth/ClerkProvider";
import { GlassButton } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";
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
          "Konto utworzone. Link weryfikacyjny e-mail jest w logach serwera.",
        );
      }
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Ambience & Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--primary)]/10 blur-[130px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--secondary)]/10 blur-[130px] pointer-events-none -z-10" />

      {/* Theme Toggle Top Right */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-xl border border-glass-border bg-[var(--surface-container)] px-3 py-1.5 text-xs font-semibold text-[var(--text-bright)] backdrop-blur-glass transition hover:bg-white/10 sm:right-8 sm:top-8 shadow-md"
        aria-label={theme === "dark" ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      >
        <span className="material-symbols-outlined text-[16px]">
          {theme === "dark" ? "light_mode" : "dark_mode"}
        </span>
        {theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
      </button>

      {/* Glass Card Container */}
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-glass-border relative animate-fade-up">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[28px]">auto_awesome</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-bright)]">
              Automovia
            </h1>
            <p className="text-xs text-[var(--muted)]">
              Smart Booking & Multi-channel SaaS
            </p>
          </div>
        </div>

        {clerkEnabled() && mode === "login" && (
          <div className="mb-5">
            <ClerkAuthPanel />
          </div>
        )}

        {clerkEnabled() && mode === "login" && (
          <div className="my-4 flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="h-px flex-1 bg-glass-border" />
            <button
              type="button"
              className="shrink-0 underline-offset-2 hover:underline"
              onClick={() => setShowDemo((v) => !v)}
            >
              {showDemo ? "Ukryj logowanie hasłem" : "Logowanie hasłem / demo"}
            </button>
            <span className="h-px flex-1 bg-glass-border" />
          </div>
        )}

        {(showDemo || mode === "register") && (
          <>
            {/* Quick Demo Credentials */}
            {mode === "login" && (
              <div className="mb-5 p-3 rounded-xl bg-[var(--surface-container)] border border-glass-border">
                <p className="text-[11px] font-semibold text-[var(--muted)] mb-2 uppercase tracking-wider">
                  Szybkie konta demonstracyjne:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("owner@bizchat.local");
                      setPassword("changeme");
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--primary-container)]/20 text-[var(--primary)] border border-[var(--primary-container)]/30 hover:bg-[var(--primary-container)]/30 transition-all"
                  >
                    Właściciel salonu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@bizchat.local");
                      setPassword("changeme");
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--secondary-container)]/20 text-[var(--secondary)] border border-[var(--secondary-container)]/30 hover:bg-[var(--secondary-container)]/30 transition-all"
                  >
                    Superadmin platformy
                  </button>
                </div>
              </div>
            )}

            {/* Mode Switch Tabs */}
            <div className="flex rounded-xl bg-[var(--surface-container)] p-1 border border-glass-border mb-6">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-[var(--primary-container)] text-white shadow"
                    : "text-[var(--muted)] hover:text-[var(--text-bright)]"
                }`}
              >
                Logowanie
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setEmail("");
                  setPassword("");
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === "register"
                    ? "bg-[var(--primary-container)] text-white shadow"
                    : "text-[var(--muted)] hover:text-[var(--text-bright)]"
                }`}
              >
                Rejestracja
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div className="mb-4 p-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{info}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={onSubmit}>
              {mode === "register" && (
                <>
                  <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                    <span>Twoje imię i nazwisko</span>
                    <GlassInput
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="np. Anna Nowak"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                    <span>Nazwa Twojego salonu *</span>
                    <GlassInput
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="np. Glamour Studio"
                      required
                    />
                  </label>
                </>
              )}

              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Adres e-mail *</span>
                <GlassInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@salon.pl"
                  required
                  autoComplete="username"
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Hasło *</span>
                <GlassInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>

              <div className="pt-2">
                <GlassButton
                  type="submit"
                  variant="primary"
                  className="w-full !py-3"
                  disabled={submitting}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {mode === "login" ? "login" : "how_to_reg"}
                  </span>
                  {submitting
                    ? "Logowanie…"
                    : mode === "login"
                      ? "Zaloguj się do panelu"
                      : "Utwórz konto salonu"}
                </GlassButton>
              </div>
            </form>

            {googleEnabled && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                  <span className="h-px flex-1 bg-glass-border" />
                  lub
                  <span className="h-px flex-1 bg-glass-border" />
                </div>
                <a
                  href={`${API_BASE}/api/auth/google/start`}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-gray-900 shadow-lg hover:bg-gray-50 transition-all active:scale-[0.99]"
                >
                  <GoogleMark />
                  Kontynuuj przez Google
                </a>
              </div>
            )}
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

