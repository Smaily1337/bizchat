import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useTour } from "@/tour/TourContext";
import { GlassButton } from "./GlassButton";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  tourId?: string;
  roles?: readonly ("owner" | "admin" | "pracownik")[];
  platformAdmin?: boolean;
  icon: ReactNode;
};

const baseNavItems: NavItem[] = [
  {
    to: "/",
    label: "Kalendarz",
    end: true,
    tourId: "nav-calendar",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    ),
  },
  {
    to: "/appointments",
    label: "Wizyty",
    tourId: "nav-appointments",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11h6M9 15h3" />
        <path d="M8 3h8v3H8z" />
        <path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    to: "/inbox",
    label: "Inbox",
    tourId: "nav-inbox",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 7 9-7" />
      </svg>
    ),
  },
  {
    to: "/customers",
    label: "Klienci",
    tourId: "nav-customers",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 19a4.5 4.5 0 0 1 5 0" />
      </svg>
    ),
  },
  {
    to: "/hours",
    label: "Godziny",
    tourId: "nav-hours",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Ustawienia",
    tourId: "nav-settings",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    to: "/users",
    label: "Użytkownicy",
    roles: ["owner", "admin"],
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z" />
      </svg>
    ),
  },
  {
    to: "/feedback",
    label: "Feedback",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z" />
      </svg>
    ),
  },
  {
    to: "/notifications",
    label: "Powiadomienia",
    tourId: "nav-notifications",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    to: "/channels",
    label: "Kanały",
    tourId: "nav-channels",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
];

export function GlassNav() {
  const { business, owner, logout, resendVerification } = useAuth();
  const { start } = useTour();
  const navItems = baseNavItems.filter((item) => {
    if (item.platformAdmin) return Boolean(owner?.is_platform_admin);
    if (!item.roles) return true;
    return owner?.role && item.roles.includes(owner.role);
  });

  return (
    <header className="sticky top-0 z-40 animate-fade-in px-3 pt-3 sm:px-5 lg:px-8">
      <div className="glass-panel mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <NavLink to="/" className="group relative z-10 flex items-center gap-3">
          <div className="animate-glow-pulse flex h-11 w-11 items-center justify-center rounded-control border border-glass-border bg-glass-fillStrong transition group-hover:border-white/35">
            <span className="font-display text-base font-bold tracking-tight text-white">
              B
            </span>
          </div>
          <div>
            <p className="font-display text-2xl font-bold tracking-[-0.03em] text-white transition group-hover:text-frost">
              BizChat
            </p>
            <p className="label-caps mt-1 text-[10px] text-[var(--muted)]">
              {business?.name || "Admin"}
            </p>
          </div>
        </NavLink>

        <nav
          className="relative z-10 hidden items-center gap-1 lg:flex"
          aria-label="Główna nawigacja"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-tour={item.tourId}
              className={({ isActive }) =>
                [
                  "inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium transition duration-200",
                  isActive
                    ? "bg-glass-fillStrong text-white shadow-active"
                    : "text-[var(--muted)] hover:bg-glass-fill hover:text-white",
                ].join(" ")
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative z-10 flex items-center gap-2 sm:gap-3">
          <GlassButton
            variant="subtle"
            className="!px-2.5 !py-1.5 hidden sm:inline-flex"
            onClick={start}
            data-tour="nav-tour"
          >
            Samouczek
          </GlassButton>
          <span className="hidden max-w-[140px] truncate font-mono text-[11px] text-[var(--muted)] lg:inline">
            {owner?.email}
            {owner?.is_platform_admin
              ? " · platforma"
              : owner?.role
                ? ` · ${owner.role}`
                : ""}
          </span>
          <GlassButton variant="ghost" className="!px-3 !py-1.5" onClick={logout}>
            Wyloguj
          </GlassButton>
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

      <nav
        className="glass-panel relative z-10 mx-auto mt-2 flex max-w-shell gap-1 overflow-x-auto px-3 py-2 lg:hidden"
        aria-label="Nawigacja mobilna"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-tour={item.tourId}
            className={({ isActive }) =>
              [
                "relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium",
                isActive
                  ? "bg-glass-fillStrong text-white"
                  : "text-[var(--muted)]",
              ].join(" ")
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={start}
          className="relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium text-[var(--muted)]"
        >
          Samouczek
        </button>
      </nav>
    </header>
  );
}
