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
  { to: "/notifications", label: "Powiadomienia", icon: "notifications" },
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
  "/hours": "Godziny Pracy Salonu",
  "/notifications": "Centrum Powiadomień",
  "/reports": "Raporty i Statystyki",
  "/settings": "Ustawienia Salonu",
  "/users": "Użytkownicy",
  "/feedback": "Opinie i Feedback",
  "/platform": "Platform Admin",
};

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

  const currentPath = "/" + (location.pathname.split("/")[1] || "");
  const pageTitle = PAGE_TITLES[currentPath] || PAGE_TITLES[location.pathname] || "Automovia";
  const userInitials = (owner?.name || owner?.email || "AD")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="bg-background text-on-surface font-sans h-screen flex overflow-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* SideNavBar Desktop */}
      <nav className="hidden md:flex flex-col h-full py-4 overflow-y-auto bg-surface-container-low/60 backdrop-blur-2xl border-r border-white/10 shadow-2xl w-64 h-screen shrink-0 z-20">
        <div className="px-6 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center shrink-0 border border-white/10">
            <span className="material-symbols-outlined text-primary text-[22px]">hub</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight leading-none">Automovia</h1>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">
              {business?.name || "Salon Dashboard"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 px-2">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary-container text-on-primary-container shadow-md shadow-primary-container/30"
                    : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="mt-auto px-4 pt-4 border-t border-white/5 space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 btn-secondary py-2 rounded-lg text-on-surface text-xs font-medium"
          >
            <span className="material-symbols-outlined text-sm">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            {theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 btn-secondary py-2 rounded-lg text-red-400 hover:text-red-300 text-xs font-medium"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Wyloguj się
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 h-full bg-[#0d1c2d] border-r border-white/10 p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">hub</span>
                <span className="font-bold text-lg text-primary">Automovia</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1 flex-1">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isActive
                        ? "bg-primary-container text-on-primary-container"
                        : "text-on-surface-variant hover:bg-white/5"
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 btn-secondary py-2 rounded-lg text-on-surface text-xs font-medium"
              >
                <span className="material-symbols-outlined text-sm">
                  {theme === "dark" ? "light_mode" : "dark_mode"}
                </span>
                {theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 btn-secondary py-2 rounded-lg text-red-400 text-xs font-medium"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                Wyloguj się
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Abstract Background Glows */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none -z-10 translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-secondary-container/10 rounded-full blur-[100px] pointer-events-none -z-10 translate-y-1/3" />

        {/* TopAppBar */}
        <header className="flex justify-between items-center px-6 sm:px-8 py-3.5 w-full bg-surface/40 backdrop-blur-md border-b border-white/10 shrink-0 z-10">
          <div className="flex items-center gap-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-1"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <span className="text-lg text-primary font-bold">Automovia</span>
          </div>

          <div className="hidden md:block">
            <h2 className="text-xl font-semibold text-on-surface">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                search
              </span>
              <input
                className="bg-surface-container/50 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-on-surface placeholder:text-on-surface-variant/50 w-64"
                placeholder="Szukaj..."
                type="text"
              />
            </div>

            <Link
              to="/notifications"
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-2 rounded-full hover:bg-white/5 relative"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </Link>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-container to-secondary-container flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border border-white/20 text-white font-bold text-xs shadow-md"
              >
                {userInitials}
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 glass-panel rounded-xl p-2 shadow-2xl border border-white/10 text-xs z-50 animate-fade-in space-y-1">
                  <p className="px-3 py-1.5 font-bold text-on-surface truncate">
                    {owner?.name || owner?.email}
                  </p>
                  <p className="px-3 pb-1 text-[11px] text-on-surface-variant truncate">
                    {owner?.role || "Właściciel"}
                  </p>
                  <div className="h-px bg-white/5 my-1" />
                  <Link
                    to="/settings/account"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-[16px]">account_circle</span>
                    Konto
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    Ustawienia
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Wyloguj się
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 z-0">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
