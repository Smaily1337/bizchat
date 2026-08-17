import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton } from "./GlassButton";

const baseNavItems = [
  { to: "/", label: "Kalendarz", end: true },
  { to: "/appointments", label: "Wizyty" },
  { to: "/inbox", label: "Inbox" },
  { to: "/hours", label: "Godziny" },
  { to: "/settings", label: "Ustawienia" },
  { to: "/users", label: "Użytkownicy", roles: ["owner", "admin"] as const },
  { to: "/platform", label: "Platforma", platformAdmin: true },
  { to: "/feedback", label: "Feedback" },
  { to: "/notifications", label: "Powiadomienia" },
  { to: "/channels", label: "Kanały" },
] as const;

export function GlassNav() {
  const { business, owner, logout, resendVerification } = useAuth();
  const navItems = baseNavItems.filter((item) => {
    if ("platformAdmin" in item && item.platformAdmin) {
      return Boolean(owner?.is_platform_admin);
    }
    if (!("roles" in item) || !item.roles) return true;
    return owner?.role && (item.roles as readonly string[]).includes(owner.role);
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
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                [
                  "rounded-control px-3 py-2 text-sm font-medium transition duration-200",
                  isActive
                    ? "bg-glass-fillStrong text-white shadow-active"
                    : "text-[var(--muted)] hover:bg-glass-fill hover:text-white",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative z-10 flex items-center gap-3">
          <span className="hidden max-w-[180px] truncate font-mono text-[11px] text-[var(--muted)] sm:inline">
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
            end={"end" in item ? item.end : false}
            className={({ isActive }) =>
              [
                "relative z-10 shrink-0 rounded-control px-3 py-1.5 text-xs font-medium",
                isActive
                  ? "bg-glass-fillStrong text-white"
                  : "text-[var(--muted)]",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
