import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar } from "./Avatar";
import { GlassButton } from "./GlassButton";
import { Icon } from "./Icon";

const baseNavItems = [
  { to: "/", label: "Kalendarz", icon: "calendar_month", end: true, group: "Praca" },
  { to: "/appointments", label: "Wizyty", icon: "event", group: "Praca" },
  { to: "/inbox", label: "Inbox", icon: "chat", group: "Praca" },
  { to: "/customers", label: "Klienci", icon: "group", group: "Praca" },
  { to: "/hours", label: "Godziny", icon: "schedule", group: "Salon" },
  { to: "/notifications", label: "Powiadomienia", icon: "notifications", group: "Salon" },
  { to: "/channels", label: "Kanały", icon: "hub", group: "Salon" },
  { to: "/feedback", label: "Opinie", icon: "star", group: "Salon" },
  { to: "/settings", label: "Ustawienia", icon: "settings", group: "Salon" },
  { to: "/users", label: "Zespół", icon: "badge", group: "Admin" },
  { to: "/platform", label: "Platforma", icon: "admin_panel_settings", group: "Admin", platformAdmin: true },
] as const;

export function GlassNav() {
  const { business, owner, logout, resendVerification } = useAuth();
  const { theme, toggle } = useTheme();
  const navItems = baseNavItems.filter((item) => {
    if ("platformAdmin" in item && item.platformAdmin) {
      return Boolean(owner?.is_platform_admin);
    }
    if (!("roles" in item) || !item.roles) return true;
    return owner?.role && (item.roles as readonly string[]).includes(owner.role);
  });

  const groups = ["Praca", "Salon", "Admin"] as const;
  const grouped = groups
    .map((group) => ({
      group,
      items: navItems.filter((item) => item.group === group),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <aside className="glass-nav sticky top-0 z-40 hidden h-screen w-[248px] shrink-0 flex-col border-r lg:flex">
        <NavLink to="/" className="flex items-center gap-2.5 px-4 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--accent)] shadow-glass backdrop-blur-glass">
            <Icon name="auto_awesome" className="!text-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight">Automovia</span>
            <span className="block truncate text-[11px] text-[var(--muted)]">
              {business?.name || "Panel"}
            </span>
          </span>
        </NavLink>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Główna nawigacja">
          {grouped.map(({ group, items }) => (
            <div key={group} className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={"end" in item ? item.end : false}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition duration-200",
                        isActive
                          ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
                      ].join(" ")
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon name={item.icon} filled={isActive} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          {owner && !owner.email_verified ? (
            <p className="mb-2 px-2 text-[11px] text-[var(--muted)]">
              Potwierdź e-mail.{" "}
              <button type="button" className="underline" onClick={() => void resendVerification()}>
                Wyślij
              </button>
            </p>
          ) : null}
          <div className="mb-2 flex items-center gap-2 px-1">
            <Avatar src={owner?.avatar_url} name={owner?.name || owner?.email} size="sm" />
            <p className="min-w-0 truncate text-[11px] text-[var(--muted)]">{owner?.email}</p>
          </div>
          <div className="flex gap-1">
            <GlassButton
              variant="ghost"
              className="!flex-1 !px-2 !py-1.5 !text-xs"
              onClick={toggle}
            >
              <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} className="!text-sm" />
              {theme === "dark" ? "Jasny" : "Ciemny"}
            </GlassButton>
            <GlassButton
              variant="ghost"
              className="!flex-1 !px-2 !py-1.5 !text-xs"
              onClick={logout}
            >
              <Icon name="logout" className="!text-sm" />
              Wyloguj
            </GlassButton>
          </div>
          <p className="mt-2 px-2 text-[10px] text-[var(--muted)]">⌘K paleta poleceń</p>
        </div>
      </aside>

      <header className="glass-nav sticky top-0 z-40 border-b lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="auto_awesome" className="text-[var(--accent)]" />
            Automovia
          </NavLink>
          <div className="flex items-center gap-2">
            <Avatar src={owner?.avatar_url} name={owner?.name || owner?.email} size="sm" />
            <GlassButton variant="ghost" className="!px-2 !py-1 !text-xs" onClick={toggle}>
              {theme === "dark" ? "Jasny" : "Ciemny"}
            </GlassButton>
            <GlassButton variant="ghost" className="!px-2 !py-1 !text-xs" onClick={logout}>
              Wyloguj
            </GlassButton>
          </div>
        </div>
        {owner && !owner.email_verified && (
          <div className="border-t border-[var(--border)] px-4 py-2 text-center text-xs text-[var(--muted)]">
            Potwierdź e-mail.{" "}
            <button type="button" className="underline" onClick={() => void resendVerification()}>
              Wyślij ponownie
            </button>
          </div>
        )}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Nawigacja mobilna">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                [
                  "flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs",
                  isActive
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                    : "text-[var(--muted)]",
                ].join(" ")
              }
            >
              <Icon name={item.icon} className="!text-[16px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
    </>
  );
}
