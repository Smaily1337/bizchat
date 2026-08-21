import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { clerkEnabled } from "@/auth/ClerkProvider";
import { useTheme } from "@/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

const NAV_LINKS: NavItem[] = [
  { to: "/", label: "Dziś", icon: "today", end: true },
  { to: "/calendar", label: "Kalendarz", icon: "calendar_month" },
  { to: "/appointments", label: "Wizyty", icon: "event_note" },
  { to: "/inbox", label: "Wiadomości", icon: "chat" },
  { to: "/customers", label: "Klienci", icon: "group" },
  { to: "/staff", label: "Zespół & Pracownicy", icon: "badge" },
  { to: "/channels", label: "Kanały", icon: "hub" },
  { to: "/hours", label: "Godziny", icon: "schedule" },
  { to: "/reports", label: "Raporty & Statystyki", icon: "analytics" },
  { to: "/settings", label: "Ustawienia", icon: "settings" },
];

const MOBILE_TABS: NavItem[] = [
  { to: "/", label: "Dziś", icon: "today", end: true },
  { to: "/calendar", label: "Kalendarz", icon: "calendar_month" },
  { to: "/inbox", label: "Czat", icon: "chat" },
  { to: "/appointments", label: "Wizyty", icon: "event_note" },
];

const MORE_LINKS: NavItem[] = [
  { to: "/customers", label: "Klienci", icon: "group" },
  { to: "/staff", label: "Zespół", icon: "badge" },
  { to: "/channels", label: "Kanały", icon: "hub" },
  { to: "/hours", label: "Godziny", icon: "schedule" },
  { to: "/reports", label: "Raporty", icon: "analytics" },
  { to: "/notifications", label: "Powiadomienia", icon: "notifications" },
  { to: "/settings", label: "Ustawienia", icon: "settings" },
];

const MORE_PREFIXES = [
  "/customers",
  "/staff",
  "/channels",
  "/hours",
  "/reports",
  "/notifications",
  "/settings",
  "/platform",
  "/users",
  "/feedback",
  "/account",
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Pulpit Dziś",
  "/calendar": "Kalendarz Wizyt",
  "/appointments": "Zarządzanie Wizytami",
  "/inbox": "Wiadomości i Czat",
  "/customers": "Baza Klientów",
  "/staff": "Zespół & Statystyki Pracowników",
  "/channels": "Kanały i Integracje",
  "/hours": "Godziny Pracy",
  "/notifications": "Centrum Powiadomień",
  "/reports": "Raporty & Statystyki AI",
  "/settings": "Ustawienia Salonu",
  "/settings/account": "Moje Konto",
  "/users": "Użytkownicy",
  "/feedback": "Opinie i Feedback",
  "/platform": "Platform Admin",
};

function isMoreRoute(pathname: string) {
  return MORE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function navClass(isActive: boolean) {
  return `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors duration-150 ${
    isActive
      ? "bg-[var(--accent-soft)] text-[var(--text-bright)] font-bold"
      : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-[var(--surface-container)]"
  }`;
}

export function GlassNav() {
  const { business, owner, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfileOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  function handleLogout() {
    logout();
    if (clerkEnabled() && typeof window !== "undefined" && (window as unknown as { Clerk?: { signOut?: () => void } }).Clerk?.signOut) {
      void (window as unknown as { Clerk: { signOut: () => void } }).Clerk.signOut();
    }
  }

  const currentPath = "/" + (location.pathname.split("/")[1] || "");
  const pageTitle = PAGE_TITLES[location.pathname] || PAGE_TITLES[currentPath] || "Automovia";
  const moreActive = isMoreRoute(location.pathname);
  const userInitials = (owner?.name || owner?.email || "AD")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--bg)] font-sans text-[var(--text)]">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-[var(--glass-border)] bg-[var(--surface-solid)] lg:flex">
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--glass-border)] p-5 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-container)] text-white">
            <span className="material-symbols-outlined text-[22px]">hub</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight text-[var(--text-bright)]">
              {business?.name || "Automovia"}
            </h1>
            <p className="truncate text-[11px] font-medium text-[var(--muted)]">
              Panel zarządzania
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => navClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {owner?.is_platform_admin && (
            <NavLink
              to="/platform"
              className={({ isActive }) =>
                `mt-3 flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
                  isActive
                    ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
                    : "border-amber-500/25 bg-amber-500/10 text-amber-400"
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
              <span className="truncate">Superadmin & Licencje</span>
            </NavLink>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-[var(--glass-border)] p-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-container)] px-3 py-2 text-xs font-medium text-[var(--text-bright)]"
          >
            <span className="material-symbols-outlined text-sm">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span>{theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>Wyloguj się</span>
          </button>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
        <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-[var(--glass-border)] bg-[var(--surface-solid)] px-4 lg:h-16 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-[var(--muted)] lg:hidden">
              {business?.name || "Automovia"}
            </p>
            <h2 className="truncate text-base font-bold text-[var(--text-bright)] lg:text-lg">
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
                search
              </span>
              <input
                className="w-60 rounded-full border border-[var(--glass-border)] bg-[var(--surface-container)] py-1.5 pl-9 pr-4 text-xs text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
                placeholder="Szukaj..."
                type="text"
              />
            </div>

            <Link
              to="/notifications"
              className="relative hidden rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-bright)] lg:inline-flex"
              title="Powiadomienia"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </Link>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--primary-container)] text-xs font-bold text-white"
              >
                {userInitials}
              </button>

              {profileOpen && (
                <div className="glass-panel absolute right-0 z-50 mt-2 w-56 space-y-1 rounded-xl p-2 text-xs">
                  <p className="truncate px-3 py-1.5 font-bold text-[var(--text-bright)]">
                    {owner?.name || owner?.email}
                  </p>
                  <p className="truncate px-3 pb-1 text-[11px] text-[var(--muted)]">
                    {owner?.role || "Właściciel"}
                  </p>
                  <div className="my-1 h-px bg-[var(--glass-border)]" />
                  {owner?.is_platform_admin && (
                    <Link
                      to="/platform"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 font-bold text-amber-300"
                    >
                      <span className="material-symbols-outlined text-[16px]">verified_user</span>
                      Superadmin & Licencje
                    </Link>
                  )}
                  <Link
                    to="/settings/account"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[var(--text)] hover:bg-[var(--surface-container)]"
                  >
                    <span className="material-symbols-outlined text-[16px]">account_circle</span>
                    Konto
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[var(--text)] hover:bg-[var(--surface-container)]"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    Ustawienia
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-red-400"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Wyloguj się
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Zamknij menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--glass-border)] bg-[var(--surface-solid)] pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--muted)]/40" />
            <p className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Więcej
            </p>
            <nav className="grid grid-cols-3 gap-2 px-4 pb-4">
              {MORE_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-bright)]"
                        : "border-[var(--glass-border)] bg-[var(--surface-container)] text-[var(--text)]"
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                  <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
                </NavLink>
              ))}
              {owner?.is_platform_admin && (
                <NavLink
                  to="/platform"
                  className={({ isActive }) =>
                    `flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center ${
                      isActive
                        ? "border-amber-400 bg-amber-500/20 text-amber-200"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[22px]">verified_user</span>
                  <span className="text-[11px] font-semibold leading-tight">Licencje</span>
                </NavLink>
              )}
            </nav>
            <div className="flex gap-2 border-t border-[var(--glass-border)] px-4 py-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-container)] text-xs font-medium text-[var(--text-bright)]"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {theme === "dark" ? "light_mode" : "dark_mode"}
                </span>
                {theme === "dark" ? "Jasny" : "Ciemny"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-medium text-red-400"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Wyloguj
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-[70] grid grid-cols-5 border-t border-[var(--glass-border)] bg-[var(--surface-solid)] px-1 pt-1 lg:hidden"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      >
        {MOBILE_TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold ${
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isActive ? "filled-icon" : ""
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold ${
            moreOpen || moreActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={
              moreOpen || moreActive ? { fontVariationSettings: "'FILL' 1" } : undefined
            }
          >
            {moreOpen ? "expand_more" : "menu"}
          </span>
          <span>Więcej</span>
        </button>
      </nav>
    </div>
  );
}
