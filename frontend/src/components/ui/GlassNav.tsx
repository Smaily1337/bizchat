import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { useAuth } from "@/auth/AuthContext";
import { clerkEnabled } from "@/auth/ClerkProvider";
import { useTheme } from "@/theme";
import { GlassButton } from "./GlassButton";
import { SidebarExpandable } from "./SidebarExpandable";
import { ErrorBoundary } from "@/components/ErrorBoundary";


function LogoutButton({ className = "!w-full" }: { className?: string }) {
  const { logout } = useAuth();
  if (clerkEnabled()) return <LogoutButtonClerk className={className} />;
  return (
    <GlassButton variant="subtle" className={className} onClick={logout}>
      Wyloguj
    </GlassButton>
  );
}

function LogoutButtonClerk({ className = "!w-full" }: { className?: string }) {
  const { logout } = useAuth();
  const { signOut } = useClerk();
  return (
    <GlassButton
      variant="subtle"
      className={className}
      onClick={() => {
        logout();
        void signOut();
      }}
    >
      Wyloguj
    </GlassButton>
  );
}

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  tourId?: string;
  roles?: readonly ("owner" | "admin" | "pracownik")[];
  platformAdmin?: boolean;
  icon: ReactNode;
};

const ic = "h-4 w-4 shrink-0";

const todayItems: NavItem[] = [
  {
    to: "/",
    label: "Dziś",
    end: true,
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
      </svg>
    ),
  },
  {
    to: "/calendar",
    label: "Kalendarz",
    tourId: "nav-calendar",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 7 9-7" />
      </svg>
    ),
  },
];

const peopleItems: NavItem[] = [
  {
    to: "/customers",
    label: "Klienci",
    tourId: "nav-customers",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
];

const salonItems: NavItem[] = [
  {
    to: "/channels",
    label: "Kanały",
    tourId: "nav-channels",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    to: "/hours",
    label: "Godziny",
    tourId: "nav-hours",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    to: "/notifications",
    label: "Powiadomienia",
    tourId: "nav-notifications",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Raporty",
    tourId: "nav-reports",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 19V5M10 19V9M16 19v-6M22 19H2" />
      </svg>
    ),
  },
  {
    to: "/account",
    label: "Konto",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Ustawienia",
    tourId: "nav-settings",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    to: "/feedback",
    label: "Feedback",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z" />
      </svg>
    ),
  },
  {
    to: "/users",
    label: "Użytkownicy",
    roles: ["owner", "admin"],
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
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
      <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z" />
      </svg>
    ),
  },
];

const mobilePrimary = [
  todayItems[0], // Dziś
  todayItems[1], // Kalendarz
  todayItems[2], // Wizyty
  todayItems[3], // Wiadomości
];

function visible(
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

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-tour={item.tourId}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? "is-active" : ""}`
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}

function AccountMenu({
  open,
  onToggle,
  menuRef,
}: {
  open: boolean;
  onToggle: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { owner, resendVerification } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div ref={menuRef}>
      {owner && !owner.email_verified && (
        <p className="mb-2 px-1 text-[11px] leading-snug text-[var(--muted)]">
          Potwierdź e-mail.{" "}
          <button
            type="button"
            className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={() => void resendVerification()}
          >
            Wyślij ponownie
          </button>
        </p>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-left hover:bg-[var(--surface-container)]"
      >
        <span className="avatar-chip">
          {(owner?.email || "U").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--text-bright)]">
            {owner?.email?.split("@")[0] || "Konto"}
          </span>
          <span className="block truncate text-[11px] text-[var(--muted)]">
            {owner?.is_platform_admin ? "Platforma" : owner?.role || "Konto"}
          </span>
        </span>
      </button>
      {open && (
        <div className="menu-panel mt-2 space-y-1 p-2">
          <p className="break-all px-2 py-1 text-xs text-[var(--muted)]">
            {owner?.email}
          </p>
          <Link
            to="/settings/account"
            onClick={onToggle}
            className="flex w-full items-center rounded-control px-2 py-2 text-sm text-[var(--text-bright)] hover:bg-[var(--surface-solid)]"
          >
            Ustawienia konta
          </Link>
          <Link
            to="/settings/salon"
            onClick={onToggle}
            className="flex w-full items-center rounded-control px-2 py-2 text-sm text-[var(--text-bright)] hover:bg-[var(--surface-solid)]"
          >
            Ustawienia salonu
          </Link>
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
          <LogoutButton />
        </div>
      )}
    </div>
  );
}

function MobileAccountDropdown() {
  const { owner } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-56 space-y-1 p-2">
      <p className="break-all px-2 py-1 text-xs text-[var(--muted)]">
        {owner?.email}
      </p>
      <Link
        to="/settings/account"
        className="flex w-full items-center rounded-control px-2 py-2 text-sm text-[var(--text-bright)] hover:bg-[var(--surface-solid)]"
      >
        Ustawienia konta
      </Link>
      <Link
        to="/settings/salon"
        className="flex w-full items-center rounded-control px-2 py-2 text-sm text-[var(--text-bright)] hover:bg-[var(--surface-solid)]"
      >
        Ustawienia salonu
      </Link>
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
      <LogoutButton />
    </div>
  );
}

/** Full authenticated chrome: sidebar + main + mobile nav. */
export function GlassNav() {
  const { business, owner } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileAccountRef = useRef<HTMLDivElement>(null);

  const salon = salonItems.filter((i) => visible(i, owner));
  const moreActive = salon.some(
    (i) =>
      location.pathname === i.to || location.pathname.startsWith(`${i.to}/`),
  );

  useEffect(() => {
    setMoreOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const inDesk = accountRef.current?.contains(t);
      const inMob = mobileAccountRef.current?.contains(t);
      if (!inDesk && !inMob) setAccountOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Nawigacja">
        <div className="border-b border-glass-border px-4 py-4">
          <NavLink to="/" className="block min-w-0">
            <p className="font-display text-lg font-semibold text-[var(--text-bright)]">
              Automovia
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {business?.name || "Panel salonu"}
            </p>
          </NavLink>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div>
            <p className="label-caps mb-1.5 px-2">Praca</p>
            <div className="space-y-0.5">
              {todayItems.map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
            </div>
          </div>
          <div>
            <p className="label-caps mb-1.5 px-2">Ludzie</p>
            <div className="space-y-0.5">
              {peopleItems.map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
            </div>
          </div>
          <div>
            <p className="label-caps mb-1.5 px-2">Salon</p>
            <div className="space-y-0.5">
              {salon.filter((i) => !["/channels", "/notifications", "/settings", "/account"].includes(i.to)).map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
              <SidebarExpandable
                to="/channels"
                label="Kanały"
                matchPrefixes={["/channels"]}
                icon={
                  <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                    <path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0" />
                  </svg>
                }
                items={[
                  { to: "/channels", label: "Przegląd", end: true },
                  { to: "/channels/integrations", label: "Integracje" },
                ]}
              />
              <SidebarExpandable
                to="/notifications"
                label="Powiadomienia"
                matchPrefixes={["/notifications"]}
                icon={
                  <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                  </svg>
                }
                items={[
                  { to: "/notifications/send", label: "Wysyłka" },
                  { to: "/notifications/reminders", label: "Przypomnienia" },
                  { to: "/notifications/templates", label: "Szablony" },
                  { to: "/notifications/log", label: "Historia" },
                ]}
              />
              <SidebarExpandable
                to="/settings"
                label="Ustawienia"
                matchPrefixes={["/settings", "/account"]}
                icon={
                  <svg aria-hidden viewBox="0 0 24 24" className={ic} fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                }
                items={[
                  { to: "/settings/salon", label: "Salon" },
                  { to: "/settings/services", label: "Usługi" },
                  { to: "/settings/faq", label: "FAQ bota" },
                  { to: "/settings/plan", label: "Plan i limity" },
                  { to: "/settings/appearance", label: "Wygląd" },
                  { to: "/settings/account", label: "Konto" },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-glass-border p-3">
          <AccountMenu
            open={accountOpen}
            onToggle={() => setAccountOpen((v) => !v)}
            menuRef={accountRef}
          />
        </div>
      </aside>

      <div className="app-main">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-glass-border bg-[var(--glass-fill-strong)] px-4 py-3 backdrop-blur-glass lg:hidden">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-[var(--text-bright)]">
              Automovia
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {business?.name || "Panel"}
            </p>
          </div>
          <div className="relative" ref={mobileAccountRef}>
            <button
              type="button"
              aria-label="Konto"
              onClick={() => setAccountOpen((v) => !v)}
              className="avatar-chip"
            >
              {(owner?.email || "U").slice(0, 1).toUpperCase()}
            </button>
            {accountOpen && (
              <MobileAccountDropdown />
            )}
          </div>
        </div>

        <main className="mx-auto w-full max-w-shell flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <nav className="mobile-tabbar" aria-label="Szybka nawigacja">
          {mobilePrimary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center gap-0.5 rounded-control px-1 py-1.5 text-[10px] font-medium",
                  isActive ? "text-[var(--accent)]" : "text-[var(--muted)]",
                ].join(" ")
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={[
              "flex flex-col items-center gap-0.5 rounded-control px-1 py-1.5 text-[10px] font-medium",
              moreOpen || moreActive
                ? "text-[var(--accent)]"
                : "text-[var(--muted)]",
            ].join(" ")}
          >
            <svg
              viewBox="0 0 24 24"
              className={ic}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Więcej
          </button>
        </nav>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Zamknij"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-soft border border-glass-border bg-[var(--bg-elevated)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <p className="label-caps mb-2">Więcej</p>
            <div className="grid grid-cols-2 gap-1">
              {[...peopleItems, ...salon.filter((i) => !["/notifications", "/settings", "/account"].includes(i.to))].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  data-tour={item.tourId}
                  onClick={() => setMoreOpen(false)}
                  className="sidebar-link"
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
              <NavLink to="/notifications" onClick={() => setMoreOpen(false)} className="sidebar-link">Powiadomienia</NavLink>
              <NavLink to="/settings" onClick={() => setMoreOpen(false)} className="sidebar-link">Ustawienia</NavLink>
              <NavLink to="/settings/account" onClick={() => setMoreOpen(false)} className="sidebar-link">Konto</NavLink>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
