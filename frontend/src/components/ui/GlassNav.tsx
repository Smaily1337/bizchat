import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeProvider";
import { GlassButton } from "./GlassButton";

const baseNavItems = [
  { to: "/", label: "Kalendarz", end: true, group: "Praca" },
  { to: "/appointments", label: "Wizyty", group: "Praca" },
  { to: "/inbox", label: "Inbox", group: "Praca" },
  { to: "/customers", label: "Klienci", group: "Praca" },
  { to: "/hours", label: "Godziny", group: "Salon" },
  { to: "/notifications", label: "Powiadomienia", group: "Salon" },
  { to: "/channels", label: "Kanały", group: "Salon" },
  { to: "/feedback", label: "Opinie", group: "Salon" },
  { to: "/settings", label: "Ustawienia", group: "Salon" },
  { to: "/users", label: "Zespół", group: "Admin", roles: ["owner", "admin"] as const },
  { to: "/platform", label: "Platforma", group: "Admin", platformAdmin: true },
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
      <aside className="sticky top-0 z-40 hidden h-screen w-[232px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] lg:flex">
        <NavLink to="/" className="flex items-center gap-2.5 px-4 py-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--ink)] text-[11px] font-semibold text-[var(--on-ink)]">
            A
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
                        "block rounded-md px-2 py-1.5 text-[13px] transition",
                        isActive
                          ? "bg-[var(--surface-hover)] font-medium text-[var(--text-bright)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
                      ].join(" ")
                    }
                  >
                    {item.label}
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
          <p className="truncate px-2 text-[11px] text-[var(--muted)]">
            {owner?.email}
          </p>
          <div className="mt-2 flex gap-1">
            <GlassButton
              variant="ghost"
              className="!flex-1 !px-2 !py-1.5 !text-xs"
              onClick={toggle}
            >
              {theme === "dark" ? "Jasny" : "Ciemny"}
            </GlassButton>
            <GlassButton
              variant="ghost"
              className="!flex-1 !px-2 !py-1.5 !text-xs"
              onClick={logout}
            >
              Wyloguj
            </GlassButton>
          </div>
          <p className="mt-2 px-2 text-[10px] text-[var(--muted)]">⌘K paleta poleceń</p>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)] lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="text-sm font-semibold">
            Automovia
          </NavLink>
          <div className="flex items-center gap-2">
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
                  "shrink-0 rounded-md px-2.5 py-1 text-xs",
                  isActive
                    ? "bg-[var(--surface-hover)] font-medium"
                    : "text-[var(--muted)]",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
    </>
  );
}
