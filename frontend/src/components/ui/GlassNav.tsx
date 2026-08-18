import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme";
import { GlassButton } from "./GlassButton";

type NavItem = {
  to: string;
  label: string;
  hint?: string;
  end?: boolean;
  tourId?: string;
  roles?: readonly ("owner" | "admin" | "pracownik")[];
  platformAdmin?: boolean;
  icon: ReactNode;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const iconClass = "h-4 w-4 shrink-0";

const primaryItems: NavItem[] = [
  {
    to: "/",
    label: "Start",
    end: true,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
      </svg>
    ),
  },
  {
    to: "/calendar",
    label: "Kalendarz",
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
    tourId: "nav-customers",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
];

const salonGroups: NavGroup[] = [
  {
    title: "Zespół",
    items: [
      {
        to: "/staff",
        label: "Pracownicy",
        hint: "Grafik i przypisania",
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
        hint: "Statystyki i eksport",
        tourId: "nav-reports",
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 19V5M10 19V9M16 19v-6M22 19H2" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Konfiguracja",
    items: [
      {
        to: "/channels",
        label: "Kanały",
        hint: "Messenger, Telegram, widget",
        tourId: "nav-channels",
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            <path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0" />
          </svg>
        ),
      },
      {
        to: "/hours",
        label: "Godziny",
        hint: "Otwarcie i dni wolne",
        tourId: "nav-hours",
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        ),
      },
      {
        to: "/notifications",
        label: "Powiadomienia",
        hint: "SMS, e-mail, przypomnienia",
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
        hint: "Salon, usługi, wygląd",
        tourId: "nav-settings",
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Konto",
    items: [
      {
        to: "/feedback",
        label: "Feedback",
        hint: "Zgłoś uwagę",
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z" />
          </svg>
        ),
      },
      {
        to: "/users",
        label: "Użytkownicy",
        hint: "Dostępy do panelu",
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
        hint: "Administracja BizChat",
        platformAdmin: true,
        icon: (
          <svg aria-hidden viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z" />
          </svg>
        ),
      },
    ],
  },
];

function linkClass(isActive: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-control px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-[var(--accent)] text-[var(--on-accent)] shadow-canary"
      : "text-[var(--muted)] hover:bg-[var(--surface-solid)] hover:text-[var(--text-bright)]",
  ].join(" ");
}

function visibleItem(
  item: NavItem,
  owner: { role?: string; is_platform_admin?: boolean } | null,
) {
  if (item.platformAdmin) return Boolean(owner?.is_platform_admin);
  if (!item.roles) return true;
  return Boolean(
    owner?.role &&
      item.roles.includes(owner.role as "owner" | "admin" | "pracownik"),
  );
}

function SalonMenuBody({
  groups,
}: {
  groups: NavGroup[];
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.title} className="mb-1 last:mb-0">
          <p className="label-caps px-2.5 py-1.5">{group.title}</p>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              role="menuitem"
              data-tour={item.tourId}
              className={({ isActive }) =>
                [
                  "flex w-full items-start gap-3 rounded-control px-2.5 py-2.5 transition",
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--text-bright)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-solid)] hover:text-[var(--text-bright)]",
                ].join(" ")
              }
            >
              <span className="mt-0.5 text-[var(--accent)]">{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                {item.hint && (
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {item.hint}
                  </span>
                )}
              </span>
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );
}

export function GlassNav() {
  const { business, owner, logout, resendVerification } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [salonOpen, setSalonOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const salonRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const groups = salonGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => visibleItem(i, owner)),
    }))
    .filter((g) => g.items.length > 0);

  const salonPaths = groups.flatMap((g) => g.items.map((i) => i.to));
  const salonActive = salonPaths.some(
    (to) => location.pathname === to || location.pathname.startsWith(`${to}/`),
  );

  useEffect(() => {
    setSalonOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    function onDoc(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSalonOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!salonOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSalonOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [salonOpen]);

  const initials =
    (business?.name || "B")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "B";

  return (
    <header className="nav-shell sticky top-0 z-40">
      <div className="mx-auto flex max-w-shell items-center gap-3 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[var(--accent)] text-[var(--on-accent)] shadow-canary">
            <span className="font-display text-base font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-none tracking-tight text-[var(--text-bright)]">
              BizChat
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {business?.name || "Panel salonu"}
            </p>
          </div>
        </NavLink>

        <nav
          className="ml-auto hidden items-center gap-1 lg:flex"
          aria-label="Główna nawigacja"
        >
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-tour={item.tourId}
              className={({ isActive }) => linkClass(isActive)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          <div className="relative" ref={salonRef}>
            <button
              type="button"
              aria-expanded={salonOpen}
              onClick={() => {
                setSalonOpen((v) => !v);
                setAccountOpen(false);
              }}
              className={linkClass(salonActive || salonOpen)}
            >
              Salon
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {salonOpen && (
              <div
                role="menu"
                className="menu-panel absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,320px)] p-2 animate-soft-pop"
              >
                <SalonMenuBody groups={groups} />
              </div>
            )}
          </div>
        </nav>

        <div className="relative ml-auto lg:ml-2" ref={accountRef}>
          <button
            type="button"
            aria-expanded={accountOpen}
            aria-label="Konto"
            onClick={() => {
              setAccountOpen((v) => !v);
              setSalonOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-control border border-glass-border bg-[var(--bg-elevated)] px-2.5 py-1.5 text-sm font-semibold text-[var(--text-bright)] shadow-glass hover:border-[var(--accent)]"
          >
            <span className="avatar-chip !h-8 !w-8 !text-sm">
              {(owner?.email || "U").slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[140px] truncate sm:inline">
              {owner?.email?.split("@")[0] || "Konto"}
            </span>
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {accountOpen && (
            <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-64 p-3 animate-soft-pop">
              <p className="break-all text-sm font-semibold text-[var(--text-bright)]">
                {owner?.email}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {owner?.is_platform_admin
                  ? "Administrator platformy"
                  : owner?.role
                    ? `Rola: ${owner.role}`
                    : "Konto"}
              </p>
              <div className="mt-3 space-y-2 border-t border-glass-border pt-3">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-between rounded-control px-2 py-2 text-sm text-[var(--text-bright)] hover:bg-[var(--surface-solid)]"
                >
                  Motyw
                  <span className="text-[var(--muted)]">
                    {theme === "dark" ? "Ciemny" : "Jasny"}
                  </span>
                </button>
                <GlassButton variant="subtle" className="!w-full" onClick={logout}>
                  Wyloguj
                </GlassButton>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-glass-border lg:hidden">
        <nav
          className="mx-auto flex max-w-shell items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6"
          aria-label="Szybka nawigacja"
        >
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-tour={item.tourId}
              className={({ isActive }) => `${linkClass(isActive)} shrink-0`}
            >
              {item.icon}
              <span className="hidden xs:inline sm:inline">{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            aria-expanded={salonOpen}
            onClick={() => {
              setSalonOpen((v) => !v);
              setAccountOpen(false);
            }}
            className={`${linkClass(salonActive || salonOpen)} shrink-0`}
          >
            Salon
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </nav>

        {salonOpen && (
          <div className="border-t border-glass-border bg-[var(--bg-elevated)] px-4 py-3 sm:px-6">
            <div className="mx-auto max-w-shell">
              <SalonMenuBody groups={groups} />
            </div>
          </div>
        )}
      </div>

      {owner && !owner.email_verified && (
        <div className="border-t border-glass-border bg-[var(--accent-soft)] px-4 py-2 text-center text-xs text-[var(--text-bright)]">
          Potwierdź e-mail, żeby włączyć pełne powiadomienia.{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void resendVerification()}
          >
            Wyślij ponownie
          </button>
        </div>
      )}
    </header>
  );
}
