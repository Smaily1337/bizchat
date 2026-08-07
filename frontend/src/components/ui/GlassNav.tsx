import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton } from "./GlassButton";

const navItems = [
  { to: "/", label: "Kalendarz", end: true },
  { to: "/appointments", label: "Wizyty" },
  { to: "/inbox", label: "Inbox" },
  { to: "/hours", label: "Godziny" },
  { to: "/settings", label: "Ustawienia" },
  { to: "/feedback", label: "Feedback" },
  { to: "/notifications", label: "Powiadomienia" },
  { to: "/channels", label: "Kanały" },
] as const;

export function GlassNav() {
  const { business, owner, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 animate-fade-in border-b border-glass-border bg-[rgba(18,20,23,0.55)] backdrop-blur-glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <NavLink to="/" className="group flex items-center gap-3">
          <div className="animate-glow-pulse flex h-11 w-11 items-center justify-center rounded-xl border border-glass-border bg-glass-fill transition group-hover:border-canary/40">
            <span className="font-display text-base font-extrabold text-canary">
              B
            </span>
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold tracking-tight text-white transition group-hover:text-canary">
              BizChat
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              {business?.name || "Admin"}
            </p>
          </div>
        </NavLink>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Główna nawigacja"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                [
                  "rounded-xl px-3 py-2 text-sm font-medium transition duration-200",
                  isActive
                    ? "bg-glass-fillStrong text-canary"
                    : "text-[var(--muted)] hover:bg-glass-fill hover:text-white",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[140px] truncate text-xs text-[var(--muted)] sm:inline">
            {owner?.email}
          </span>
          <GlassButton variant="ghost" className="!px-3 !py-1.5" onClick={logout}>
            Wyloguj
          </GlassButton>
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto border-t border-glass-border px-4 py-2 lg:hidden"
        aria-label="Nawigacja mobilna"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : false}
            className={({ isActive }) =>
              [
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium",
                isActive
                  ? "bg-glass-fillStrong text-canary"
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
