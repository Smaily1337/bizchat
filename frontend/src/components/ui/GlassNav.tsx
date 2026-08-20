import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { clerkEnabled } from "@/auth/ClerkProvider";
import { useTheme } from "@/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const NAV_LINKS = [
  { to: "/", label: "Dziś", icon: "today", end: true },
  { to: "/calendar", label: "Kalendarz", icon: "calendar_month" },
  { to: "/appointments", label: "Wizyty", icon: "event_note" },
  { to: "/inbox", label: "Wiadomości", icon: "chat" },
  { to: "/customers", label: "Klienci", icon: "group" },
  { to: "/staff", label: "Zespół", icon: "badge" },
  { to: "/channels", label: "Kanały", icon: "hub" },
  { to: "/hours", label: "Godziny", icon: "schedule" },
  { to: "/reports", label: "Raporty", icon: "analytics" },
  { to: "/settings", label: "Ustawienia", icon: "settings" },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Pulpit Dziś",
  "/calendar": "Kalendarz Wizyt",
  "/appointments": "Zarządzanie Wizytami",
  "/inbox": "Wiadomości i Czat",
  "/customers": "Baza Klientów",
  "/staff": "Zarządzanie Zespołem",
  "/channels": "Kanały i Integracje",
  "/hours": "Godziny Pracy",
  "/notifications": "Centrum Powiadomień",
  "/reports": "Raporty i Statystyki",
  "/settings": "Ustawienia Salonu",
  "/settings/account": "Moje Konto",
  "/users": "Użytkownicy",
  "/feedback": "Opinie i Feedback",
  "/platform": "Platform Admin",
};

export function GlassNav() {
  const { business, owner, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfileOpen(false);
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

  function handleLogout() {
    logout();
    if (clerkEnabled() && typeof window !== "undefined" && (window as unknown as { Clerk?: { signOut?: () => void } }).Clerk?.signOut) {
      void (window as unknown as { Clerk: { signOut: () => void } }).Clerk.signOut();
    }
  }

  const currentPath = "/" + (location.pathname.split("/")[1] || "");
  const pageTitle = PAGE_TITLES[location.pathname] || PAGE_TITLES[currentPath] || "Automovia";
  const userInitials = (owner?.name || owner?.email || "AD")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[var(--bg)] text-[var(--text)] font-sans relative select-none">
      {/* Permanent Left Sidebar Navigation */}
      <aside className="w-64 h-full shrink-0 flex flex-col bg-[var(--surface-solid)] border-r border-[var(--glass-border)] shadow-2xl z-30">
        {/* Brand / Salon Header */}
        <div className="p-5 pb-4 flex items-center gap-3 border-b border-white/5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 text-white">
            <span className="material-symbols-outlined text-[22px]">hub</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold tracking-tight text-[var(--text-bright)] truncate">
              {business?.name || "Automovia"}
            </h1>
            <p className="text-[11px] font-medium text-[var(--muted)] truncate">
              Panel zarządzania
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 group relative ${
                  isActive
                    ? "bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white shadow-lg shadow-blue-500/25 font-bold"
                    : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 hover:translate-x-1"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined text-[20px] transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? "text-white" : "text-[var(--muted)] group-hover:text-[var(--primary)]"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/5 space-y-2 bg-black/10 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[var(--glass-border)] bg-white/5 hover:bg-white/10 text-[var(--text-bright)] text-xs font-medium transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span>{theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>Wyloguj się</span>
          </button>
        </div>
      </aside>

      {/* Main Content View with Top Header */}
      <div className="flex-1 h-full flex flex-col overflow-hidden relative min-w-0 bg-[var(--bg)]">
        {/* Top Header */}
        <header className="h-16 px-6 sm:px-8 flex items-center justify-between border-b border-[var(--glass-border)] bg-[var(--surface-solid)]/60 backdrop-blur-xl shrink-0 z-20">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-bright)]">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">
                search
              </span>
              <input
                className="bg-[var(--surface-container)] border border-[var(--glass-border)] rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-[var(--primary)] transition-all text-[var(--text-bright)] placeholder:text-[var(--muted)] w-60"
                placeholder="Szukaj..."
                type="text"
              />
            </div>

            {/* Notifications */}
            <Link
              to="/notifications"
              className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 transition-colors relative"
              title="Powiadomienia"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </Link>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border border-white/20 text-white font-bold text-xs shadow-md"
              >
                {userInitials}
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 glass-panel rounded-xl p-2 shadow-2xl border border-[var(--glass-border)] text-xs z-50 animate-fade-in space-y-1">
                  <p className="px-3 py-1.5 font-bold text-[var(--text-bright)] truncate">
                    {owner?.name || owner?.email}
                  </p>
                  <p className="px-3 pb-1 text-[11px] text-[var(--muted)] truncate">
                    {owner?.role || "Właściciel"}
                  </p>
                  <div className="h-px bg-white/5 my-1" />
                  <Link
                    to="/settings/account"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text)] hover:text-[var(--text-bright)] hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-[16px]">account_circle</span>
                    Konto
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text)] hover:text-[var(--text-bright)] hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    Ustawienia
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Wyloguj się
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Main Outlet */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
