import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { clerkEnabled } from "@/auth/ClerkProvider";
import { useTheme } from "@/theme";
import { GlassButton } from "./GlassButton";
import { SidebarExpandable } from "./SidebarExpandable";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function LogoutButton({ className = "!w-full" }: { className?: string }) {
  const { logout } = useAuth();
  return (
    <GlassButton
      variant="subtle"
      className={className}
      onClick={() => {
        logout();
        if (clerkEnabled()) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof window !== "undefined" && (window as any).Clerk) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              void (window as any).Clerk.signOut();
            }
          } catch {
            /* ignore if clerk signout is unavailable */
          }
        }
      }}
    >
      <span className="material-symbols-outlined mr-2 text-[18px]">logout</span>
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

const todayItems: NavItem[] = [
  {
    to: "/",
    label: "Dziś",
    end: true,
    icon: <span className="material-symbols-outlined">dashboard</span>,
  },
  {
    to: "/calendar",
    label: "Kalendarz",
    tourId: "nav-calendar",
    icon: <span className="material-symbols-outlined">calendar_month</span>,
  },
  {
    to: "/appointments",
    label: "Wizyty",
    tourId: "nav-appointments",
    icon: <span className="material-symbols-outlined">event_note</span>,
  },
  {
    to: "/inbox",
    label: "Wiadomości",
    tourId: "nav-inbox",
    icon: <span className="material-symbols-outlined">chat</span>,
  },
];

const peopleItems: NavItem[] = [
  {
    to: "/customers",
    label: "Klienci",
    tourId: "nav-customers",
    icon: <span className="material-symbols-outlined">group</span>,
  },
  {
    to: "/staff",
    label: "Zespół",
    tourId: "nav-staff",
    icon: <span className="material-symbols-outlined">badge</span>,
  },
];

const salonItems: NavItem[] = [
  {
    to: "/channels",
    label: "Kanały",
    tourId: "nav-channels",
    icon: <span className="material-symbols-outlined">hub</span>,
  },
  {
    to: "/hours",
    label: "Godziny",
    tourId: "nav-hours",
    icon: <span className="material-symbols-outlined">schedule</span>,
  },
  {
    to: "/notifications",
    label: "Powiadomienia",
    tourId: "nav-notifications",
    icon: <span className="material-symbols-outlined">notifications</span>,
  },
  {
    to: "/reports",
    label: "Raporty",
    tourId: "nav-reports",
    icon: <span className="material-symbols-outlined">query_stats</span>,
  },
  {
    to: "/account",
    label: "Konto",
    icon: <span className="material-symbols-outlined">account_circle</span>,
  },
  {
    to: "/settings",
    label: "Ustawienia",
    tourId: "nav-settings",
    icon: <span className="material-symbols-outlined">settings</span>,
  },
  {
    to: "/feedback",
    label: "Feedback",
    icon: <span className="material-symbols-outlined">reviews</span>,
  },
  {
    to: "/users",
    label: "Użytkownicy",
    roles: ["owner", "admin"],
    icon: <span className="material-symbols-outlined">manage_accounts</span>,
  },
  {
    to: "/platform",
    label: "Platforma",
    platformAdmin: true,
    icon: <span className="material-symbols-outlined">admin_panel_settings</span>,
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
        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          isActive
            ? "bg-primary/10 text-primary font-bold border-r-4 border-primary"
            : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
        }`
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
        <p className="mb-2 px-1 text-[11px] leading-snug text-on-surface-variant">
          Potwierdź e-mail.{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline"
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
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-medium">
          {(owner?.email || "U").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-on-surface">
            {owner?.email?.split("@")[0] || "Konto"}
          </span>
          <span className="block truncate text-[11px] text-on-surface-variant">
            {owner?.is_platform_admin ? "Platforma" : owner?.role || "Konto"}
          </span>
        </span>
      </button>
      {open && (
        <div className="glass-panel mt-2 space-y-1 p-2">
          <p className="break-all px-2 py-1 text-xs text-on-surface-variant">
            {owner?.email}
          </p>
          <Link
            to="/settings/account"
            onClick={onToggle}
            className="flex w-full items-center rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-white/10"
          >
            Ustawienia konta
          </Link>
          <Link
            to="/settings/salon"
            onClick={onToggle}
            className="flex w-full items-center rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-white/10"
          >
            Ustawienia salonu
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-white/10"
          >
            Motyw
            <span className="text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">
                {theme === "dark" ? "dark_mode" : "light_mode"}
              </span>
              {theme === "dark" ? "Ciemny" : "Jasny"}
            </span>
          </button>
          <LogoutButton className="!w-full mt-2" />
        </div>
      )}
    </div>
  );
}

function MobileAccountDropdown() {
  const { owner } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="glass-panel absolute right-0 top-full z-50 mt-2 w-56 space-y-1 p-2">
      <p className="break-all px-2 py-1 text-xs text-on-surface-variant">
        {owner?.email}
      </p>
      <Link
        to="/settings/account"
        className="flex w-full items-center rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-white/10"
      >
        Ustawienia konta
      </Link>
      <Link
        to="/settings/salon"
        className="flex w-full items-center rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-white/10"
      >
        Ustawienia salonu
      </Link>
      <button
        type="button"
        onClick={toggleTheme}
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-white/10"
      >
        Motyw
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">
            {theme === "dark" ? "dark_mode" : "light_mode"}
          </span>
          {theme === "dark" ? "Ciemny" : "Jasny"}
        </span>
      </button>
      <LogoutButton className="!w-full mt-2" />
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
        <div className="border-b border-white/10 px-4 py-4">
          <NavLink to="/" className="block min-w-0">
            <p className="font-display text-lg font-semibold text-primary">
              Automovia
            </p>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">
              {business?.name || "Panel salonu"}
            </p>
          </NavLink>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div>
            <p className="font-label-caps text-label-caps uppercase tracking-wider mb-1.5 px-2 text-on-surface-variant">Praca</p>
            <div className="space-y-0.5">
              {todayItems.map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
            </div>
          </div>
          <div>
            <p className="font-label-caps text-label-caps uppercase tracking-wider mb-1.5 px-2 text-on-surface-variant">Ludzie</p>
            <div className="space-y-0.5">
              {peopleItems.map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
            </div>
          </div>
          <div>
            <p className="font-label-caps text-label-caps uppercase tracking-wider mb-1.5 px-2 text-on-surface-variant">Salon</p>
            <div className="space-y-0.5">
              {salon.filter((i) => !["/channels", "/notifications", "/settings", "/account"].includes(i.to)).map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
              <SidebarExpandable
                to="/channels"
                label="Kanały"
                matchPrefixes={["/channels"]}
                icon={<span className="material-symbols-outlined">hub</span>}
                items={[
                  { to: "/channels", label: "Przegląd", end: true },
                  { to: "/channels/integrations", label: "Integracje" },
                ]}
              />
              <SidebarExpandable
                to="/notifications"
                label="Powiadomienia"
                matchPrefixes={["/notifications"]}
                icon={<span className="material-symbols-outlined">notifications</span>}
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
                icon={<span className="material-symbols-outlined">settings</span>}
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

        <div className="border-t border-white/10 p-3">
          <AccountMenu
            open={accountOpen}
            onToggle={() => setAccountOpen((v) => !v)}
            menuRef={accountRef}
          />
        </div>
      </aside>

      <div className="app-main">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 glass-panel px-4 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-primary">
              Automovia
            </p>
            <p className="truncate text-xs text-on-surface-variant">
              {business?.name || "Panel"}
            </p>
          </div>
          <div className="relative" ref={mobileAccountRef}>
            <button
              type="button"
              aria-label="Konto"
              onClick={() => setAccountOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-medium"
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

        <nav className="fixed bottom-4 left-4 right-4 rounded-full glass-panel flex items-center justify-around px-2 py-2 z-40 lg:hidden shadow-lg" aria-label="Szybka nawigacja">
          {mobilePrimary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-all",
                  isActive ? "bg-primary-container text-on-primary-container rounded-full" : "text-on-surface-variant hover:text-on-surface",
                ].join(" ")
              }
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={[
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-all",
              moreOpen || moreActive
                ? "bg-primary-container text-on-primary-container rounded-full"
                : "text-on-surface-variant hover:text-on-surface",
            ].join(" ")}
          >
            <span className="material-symbols-outlined">more_horiz</span>
            <span className="mt-0.5">Więcej</span>
          </button>
        </nav>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Zamknij"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-24 left-4 right-4 max-h-[60vh] overflow-y-auto glass-panel p-4 shadow-xl">
            <p className="font-label-caps text-label-caps uppercase tracking-wider mb-3 text-on-surface-variant">Więcej opcji</p>
            <div className="grid grid-cols-2 gap-2">
              {[...peopleItems, ...salon].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  data-tour={item.tourId}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-bold border-l-4 border-primary"
                        : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                    }`
                  }
                >
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
