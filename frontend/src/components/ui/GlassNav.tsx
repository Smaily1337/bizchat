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

export function GlassNav() {
  const { business, owner, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
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

  const userInitials = (owner?.name || owner?.email || "AD")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans flex flex-col selection:bg-[var(--primary-container)] selection:text-white">
      {/* Top Glass Navigation Bar (Always Visible!) */}
      <header className="sticky top-0 z-40 w-full bg-[var(--surface-solid)]/90 backdrop-blur-2xl border-b border-[var(--glass-border)] shadow-md select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
          {/* Left: Brand / Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-[var(--text-bright)]">
                  {business?.name || "Automovia"}
                </span>
                <span className="hidden sm:block text-[10px] text-[var(--muted)] font-medium">
                  Panel biznesowy
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Full Horizontal Navigation Tabs (Always Visible across all screens!) */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 max-w-[65vw] scrollbar-none">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap select-none ${
                    isActive
                      ? "bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white shadow-md shadow-blue-500/25 font-bold"
                      : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5"
                  }`
                }
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right: Actions + Theme + Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notifications Link */}
            <Link
              to="/notifications"
              className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 transition-colors relative"
              title="Powiadomienia"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </Link>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 transition-colors cursor-pointer"
              title={theme === "dark" ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {theme === "dark" ? "light_mode" : "dark_mode"}
              </span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border border-white/20 text-white font-bold text-xs shadow-md"
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
        </div>
      </header>

      {/* Mobile Fullscreen Drawer Menu (z-index 100) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 h-full bg-[var(--surface-solid)] border-r border-[var(--glass-border)] p-4 overflow-y-auto z-10 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">hub</span>
                </div>
                <span className="font-bold text-base text-[var(--text-bright)] truncate">
                  {business?.name || "Automovia"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white shadow font-bold"
                        : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5"
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="pt-3 border-t border-white/10 space-y-2 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[var(--glass-border)] bg-white/5 text-[var(--text-bright)] text-xs font-medium cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {theme === "dark" ? "light_mode" : "dark_mode"}
                </span>
                <span>{theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-medium cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                <span>Wyloguj się</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
