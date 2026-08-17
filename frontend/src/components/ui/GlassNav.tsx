import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useTour } from "@/tour/TourContext";
import { useTheme } from "@/theme";
import { GlassButton } from "./GlassButton";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  tourId?: string;
  roles?: readonly ("owner" | "admin" | "pracownik")[];
  platformAdmin?: boolean;
  primary?: boolean;
  icon: ReactNode;
};

const iconClass = "h-3.5 w-3.5 shrink-0";

const baseNavItems: NavItem[] = [
  {
    to: "/",
    label: "Kalendarz",
    end: true,
    primary: true,
    tourId: "nav-calendar",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    ),
  },
  {
    to: "/appointments",
    label: "Wizyty",
    primary: true,
    tourId: "nav-appointments",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11h6M9 15h3" />
        <path d="M8 3h8v3H8z" />
        <path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    to: "/inbox",
    label: "Inbox",
    primary: true,
    tourId: "nav-inbox",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 7 9-7" />
      </svg>
    ),
  },
  {
    to: "/customers",
    label: "Klienci",
    primary: true,
    tourId: "nav-customers",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 19a4.5 4.5 0 0 1 5 0" />
      </svg>
    ),
  },
  {
    to: "/staff",
    label: "Zespół",
    primary: true,
    tourId: "nav-staff",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Raporty",
    primary: true,
    tourId: "nav-reports",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5M10 19V9M16 19v-6M22 19H2" />
      </svg>
    ),
  },
  {
    to: "/hours",
    label: "Godziny",
    tourId: "nav-hours",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    to: "/channels",
    label: "Kanały",
    tourId: "nav-channels",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    to: "/notifications",
    label: "Powiadomienia",
    tourId: "nav-notifications",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Ustawienia",
    tourId: "nav-settings",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    to: "/feedback",
    label: "Feedback",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z" />
      </svg>
    ),
  },
  {
    to: "/users",
    label: "Użytkownicy",
    roles: ["owner", "admin"],
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 19a4.5 4.5 0 0 1 5 0" />
      </svg>
    ),
  },
  {
    to: "/platform",
    label: "Platforma",
    platformAdmin: true,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z" />
      </svg>
    ),
  },
];

function linkClass(isActive: boolean, compact = false) {
  return [
    "inline-flex items-center gap-1.5 rounded-control font-medium transition duration-200",
    compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
    isActive
      ? "bg-glass-fillStrong text-white shadow-active"
      : "text-[var(--muted)] hover:bg-glass-fill hover:text-white",
  ].join(" ");
}

export function GlassNav() {
  const { business, owner, logout, resendVerification } = useAuth();
  const { start } = useTour();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const navItems = baseNavItems.filter((item) => {
    if (item.platformAdmin) return Boolean(owner?.is_platform_admin);
    if (!item.roles) return true;
    return owner?.role && item.roles.includes(owner.role);
  });

  const primary = navItems.filter((i) => i.primary);
  const more = navItems.filter((i) => !i.primary);
  const moreActive = more.some(
    (i) =>
      location.pathname === i.to ||
      (i.to !== "/" && location.pathname.startsWith(i.to)),
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <header className="sticky top-0 z-40 animate-fade-in px-3 pt-3 sm:px-5 lg:px-8">
      {/* Top bar: brand + Wyloguj — always visible, never clipped by nav links */}
      <div className="glass-panel !overflow-visible mx-auto flex max-w-shell items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <NavLink to="/" className="group relative z-10 flex min-w-0 items-center gap-3">
          <div className="animate-glow-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-glass-border bg-glass-fillStrong transition group-hover:border-white/35 sm:h-11 sm:w-11">
            <span className="font-display text-base font-bold tracking-tight text-white">
              B
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold tracking-[-0.03em] text-white transition group-hover:text-frost sm:text-2xl">
              BizChat
            </p>
            <p className="label-caps mt-0.5 truncate text-[10px] text-[var(--muted)]">
              {business?.name || "Admin"}
            </p>
          </div>
        </NavLink>

        <div className="relative z-20 flex shrink-0 items-center gap-2">
          <GlassButton
            variant="subtle"
            className="!hidden !px-2.5 !py-1.5 md:!inline-flex"
            onClick={start}
            data-tour="nav-tour"
          >
            Samouczek
          </GlassButton>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-control border border-glass-border bg-glass-fill px-2.5 py-1.5 text-sm font-semibold text-[var(--text-bright)] transition hover:bg-glass-fillStrong"
            aria-label={theme === "dark" ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
            title={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
          >
            {theme === "dark" ? (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
              </svg>
            )}
            <span className="hidden sm:inline">
              {theme === "dark" ? "Jasny" : "Ciemny"}
            </span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-control border border-glass-border bg-glass-fillStrong px-3 py-1.5 text-sm font-semibold text-[var(--text-bright)] backdrop-blur-glass transition hover:bg-glass-fill"
            aria-label="Wyloguj"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Wyloguj
          </button>
        </div>
      </div>

      {owner && !owner.email_verified && (
        <div className="mx-auto mt-2 max-w-shell rounded-control border border-glass-border bg-white/[0.05] px-4 py-2 text-center text-xs text-frost backdrop-blur-glass sm:px-5">
          Potwierdź e-mail — link jest w logach API (console mailer) albo SMTP.{" "}
          <button
            type="button"
            className="font-mono underline underline-offset-2"
            onClick={() => void resendVerification()}
          >
            Wyślij ponownie
          </button>
        </div>
      )}

      {/* Links: primary scroll; Więcej pinned so dropdown isn't clipped */}
      <nav
        className="glass-panel !overflow-visible relative z-10 mx-auto mt-2 flex max-w-shell items-center gap-1 px-2 py-2 sm:px-3"
        aria-label="Główna nawigacja"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-tour={item.tourId}
              className={({ isActive }) =>
                `${linkClass(isActive, true)} shrink-0`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="relative shrink-0" ref={moreRef}>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((v) => !v)}
            className={linkClass(moreActive || moreOpen, true)}
          >
            Więcej
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {moreOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] min-w-[220px] overflow-y-auto rounded-soft border border-glass-border bg-[var(--bg-elevated)] p-1.5 shadow-glass backdrop-blur-glass"
            >
              {more.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  role="menuitem"
                  data-tour={item.tourId}
                  className={({ isActive }) =>
                    [
                      "flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm",
                      isActive
                        ? "bg-glass-fillStrong text-white"
                        : "text-[var(--muted)] hover:bg-glass-fill hover:text-white",
                    ].join(" ")
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  start();
                }}
                className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-glass-fill hover:text-white md:hidden"
              >
                Samouczek
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
