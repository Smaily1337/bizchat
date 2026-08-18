import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
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

const iconClass = "h-4 w-4 shrink-0";

const baseNavItems: NavItem[] = [
  {
    to: "/",
    label: "Start",
    end: true,
    primary: true,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
      </svg>
    ),
  },
  {
    to: "/calendar",
    label: "Kalendarz",
    primary: true,
    tourId: "nav-calendar",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M9 11h6M9 15h3" />
        <path d="M8 3h8v3H8z" />
        <path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    to: "/inbox",
    label: "Wiadomości",
    primary: true,
    tourId: "nav-inbox",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    to: "/staff",
    label: "Zespół",
    tourId: "nav-staff",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Raporty",
    tourId: "nav-reports",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 19V5M10 19V9M16 19v-6M22 19H2" />
      </svg>
    ),
  },
  {
    to: "/hours",
    label: "Godziny",
    tourId: "nav-hours",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    to: "/feedback",
    label: "Feedback",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z" />
      </svg>
    ),
  },
  {
    to: "/users",
    label: "Użytkownicy",
    roles: ["owner", "admin"],
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    to: "/platform",
    label: "Platforma",
    platformAdmin: true,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z" />
      </svg>
    ),
  },
];

function linkClass(isActive: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-[var(--accent)] text-[var(--on-accent)]"
      : "text-[var(--muted)] hover:bg-[var(--surface-solid)] hover:text-[var(--text-bright)]",
  ].join(" ");
}

export function GlassNav() {
  const { business, owner, logout, resendVerification } = useAuth();
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
    <header className="sticky top-0 z-40 border-b border-glass-border bg-[var(--nav-bg)]">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--accent)] text-[var(--on-accent)]">
            <span className="font-display text-sm font-bold">B</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tracking-tight text-[var(--text-bright)]">
              BizChat
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {business?.name || "Panel"}
            </p>
          </div>
        </NavLink>

        <div className="flex shrink-0 items-center gap-2">
          <GlassButton variant="subtle" className="!px-3 !py-2" onClick={logout}>
            Wyloguj
          </GlassButton>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-control border border-glass-border px-3 py-2 text-sm font-medium text-[var(--text-bright)] hover:bg-[var(--surface-solid)]"
            aria-label={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
          >
            {theme === "dark" ? "Jasny" : "Ciemny"}
          </button>
        </div>
      </div>

      {owner && !owner.email_verified && (
        <div className="border-t border-glass-border bg-[var(--surface-solid)] px-4 py-2 text-center text-xs text-[var(--muted)]">
          Potwierdź e-mail.{" "}
          <button
            type="button"
            className="font-mono underline underline-offset-2"
            onClick={() => void resendVerification()}
          >
            Wyślij ponownie
          </button>
        </div>
      )}

      <nav
        className="mx-auto flex max-w-shell items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6"
        aria-label="Główna nawigacja"
      >
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-tour={item.tourId}
            className={({ isActive }) => `${linkClass(isActive)} shrink-0`}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        <div className="relative shrink-0" ref={moreRef}>
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={linkClass(moreActive || moreOpen)}
          >
            Więcej
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {moreOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-soft border border-glass-border bg-[var(--bg-elevated)] p-1.5"
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
                      "flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-sm",
                      isActive
                        ? "bg-[var(--surface-solid)] font-semibold text-[var(--text-bright)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-solid)] hover:text-[var(--text-bright)]",
                    ].join(" ")
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      {owner?.email && (
        <p className="mx-auto max-w-shell break-all px-4 pb-2 font-mono text-[11px] text-[var(--muted)] sm:px-6">
          {owner.email}
          {owner.is_platform_admin ? " · platforma" : owner.role ? ` · ${owner.role}` : ""}
        </p>
      )}
    </header>
  );
}
