import { type FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

/** Credentials passed from the landing page in the URL fragment (never sent to any server). */
function readHashCredentials(hash: string): { email: string; password: string } | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const email = params.get("email");
  const password = params.get("password");
  if (!email || !password) return null;
  return { email, password };
}

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) {
    return "Nieprawidłowy e-mail lub hasło.";
  }
  if (err instanceof ApiError) {
    return `Logowanie nieudane: ${err.detail}`;
  }
  return "Logowanie nieudane — sprawdź połączenie z serwerem.";
}

export function LoginPage() {
  const { token, loading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@bizchat.local");
  const [password, setPassword] = useState("changeme");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const autoLoginTried = useRef(false);

  // Auto-login with credentials from the landing page. Reacts to every hash
  // change (SPA navigation included), not just the initial mount. The hash is
  // read from both the router location and window.location because a hard
  // page load can surface it in either place first.
  const hash = location.hash || window.location.hash;
  useEffect(() => {
    if (token || autoLoginTried.current) return;
    const creds = readHashCredentials(hash);
    if (!creds) return;
    autoLoginTried.current = true;
    // Remove credentials from the address bar before attempting login
    navigate(location.pathname, { replace: true });
    setEmail(creds.email);
    setPassword(creds.password);
    setSubmitting(true);
    login(creds.email, creds.password)
      .catch((err: unknown) => setError(loginErrorMessage(err)))
      .finally(() => setSubmitting(false));
  }, [hash, token, login, navigate, location.pathname]);

  if (!loading && token) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname;
    return <Navigate to={from || "/"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
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
          Panel admina
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Zaloguj się, aby zarządzać wizytami i ustawieniami salonu.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <GlassButton type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Logowanie…" : "Zaloguj"}
          </GlassButton>
        </form>

        <p className="mt-5 text-xs text-[var(--muted)]">
          Demo: owner@bizchat.local / changeme
        </p>
      </GlassCard>
    </div>
  );
}
