import { type FormEvent, useCallback, useEffect, useState } from "react";
import { platformApi } from "@/api";
import type {
  Business,
  PlatformAccount,
  PlatformPageviewStats,
  UserRole,
} from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Właściciel",
  admin: "Admin",
  pracownik: "Pracownik",
};

type Tab = "accounts" | "businesses" | "stats";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pl-PL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function PlatformPage() {
  const { owner } = useAuth();
  const canAccess = Boolean(owner?.is_platform_admin);
  const [tab, setTab] = useState<Tab>("accounts");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [stats, setStats] = useState<PlatformPageviewStats | null>(null);

  const [form, setForm] = useState({
    email: "",
    name: "",
    business_name: "",
    role: "owner" as UserRole,
  });

  const reloadAccounts = useCallback(async () => {
    setAccounts(await platformApi.listAccounts());
  }, []);

  const reloadBusinesses = useCallback(async () => {
    setBusinesses(await platformApi.listBusinesses());
  }, []);

  const reloadStats = useCallback(async () => {
    setStats(await platformApi.pageviewStats());
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    setError(null);
    const load = async () => {
      try {
        if (tab === "accounts") await reloadAccounts();
        else if (tab === "businesses") await reloadBusinesses();
        else await reloadStats();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd");
      }
    };
    void load();
  }, [canAccess, tab, reloadAccounts, reloadBusinesses, reloadStats]);

  if (!canAccess) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Platforma</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Brak uprawnień — ten panel jest tylko dla administratora platformy
          BizChat.
        </p>
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const res = await platformApi.createAccount({
        email: form.email,
        name: form.name || undefined,
        business_name: form.business_name || undefined,
        role: form.role,
      });
      setForm({ email: "", name: "", business_name: "", role: "owner" });
      setMsg(
        `Konto ${res.account.email} utworzone. Hasło tymczasowe: ${res.temporary_password}`,
      );
      await reloadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function toggleActive(account: PlatformAccount) {
    setError(null);
    try {
      await platformApi.updateAccount(account.id, {
        is_active: !account.is_active,
      });
      await reloadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function resetPassword(account: PlatformAccount) {
    setError(null);
    setMsg(null);
    try {
      const res = await platformApi.resetPassword(account.id);
      setMsg(
        res.temporary_password
          ? `Nowe hasło dla ${account.email}: ${res.temporary_password}`
          : res.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function renameBusiness(biz: Business) {
    const next = prompt("Nowa nazwa firmy", biz.name);
    if (next === null || !next.trim()) return;
    setError(null);
    try {
      await platformApi.updateBusiness(biz.id, { name: next.trim() });
      await reloadBusinesses();
      setMsg("Nazwa firmy zaktualizowana");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "accounts", label: "Konta" },
    { id: "businesses", label: "Firmy" },
    { id: "stats", label: "Statystyki" },
  ];

  const maxDay = Math.max(1, ...(stats?.by_day.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Platforma</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Superadmin BizChat — konta właścicieli, firmy i ruch na landingu
        </p>
      </header>

      <div className="flex flex-wrap gap-2 animate-fade-up">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setError(null);
              setMsg(null);
            }}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "bg-[var(--surface)]Strong text-[var(--text)]"
                : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      {tab === "accounts" && (
        <>
          <GlassCard className="animate-fade-up">
            <p className="font-display text-lg font-semibold">
              Nowe konto platformy
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Generuje firmę (jeśli podasz nazwę) i hasło tymczasowe — pokazywane
              raz.
            </p>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={onCreate}
            >
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">E-mail</span>
                <GlassInput
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">Imię / nazwa</span>
                <GlassInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">Nazwa firmy</span>
                <GlassInput
                  value={form.business_name}
                  onChange={(e) =>
                    setForm({ ...form, business_name: e.target.value })
                  }
                  placeholder="np. Salon Anny"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--muted)]">Rola w firmie</span>
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--focus)]"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserRole })
                  }
                >
                  {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <GlassButton type="submit">Utwórz konto</GlassButton>
              </div>
            </form>
          </GlassCard>

          <div className="space-y-3">
            {accounts.map((account) => (
              <GlassCard key={account.id} className="animate-fade-up">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold">
                      {account.name || account.email}
                      {account.is_platform_admin ? (
                        <span className="ml-2 text-xs font-medium text-[var(--text)]">
                          platform admin
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {account.email}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {account.business_name || "—"} ·{" "}
                      {ROLE_LABEL[account.role]} ·{" "}
                      {account.is_active ? "aktywny" : "nieaktywny"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GlassButton
                      type="button"
                      variant="ghost"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => void resetPassword(account)}
                    >
                      Reset hasła
                    </GlassButton>
                    <GlassButton
                      type="button"
                      variant="ghost"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => void toggleActive(account)}
                      disabled={account.id === owner?.id}
                    >
                      {account.is_active ? "Dezaktywuj" : "Aktywuj"}
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            ))}
            {accounts.length === 0 && (
              <p className="text-sm text-[var(--muted)]">Brak kont.</p>
            )}
          </div>
        </>
      )}

      {tab === "businesses" && (
        <div className="space-y-3">
          {businesses.map((biz) => (
            <GlassCard key={biz.id} className="animate-fade-up">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {biz.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {biz.timezone} · {biz.id}
                  </p>
                </div>
                <GlassButton
                  type="button"
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => void renameBusiness(biz)}
                >
                  Zmień nazwę
                </GlassButton>
              </div>
            </GlassCard>
          ))}
          {businesses.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Brak firm.</p>
          )}
        </div>
      )}

      {tab === "stats" && stats && (
        <div className="space-y-6 animate-fade-up">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Dziś", value: stats.visits_today },
              { label: "7 dni", value: stats.visits_7d },
              { label: "30 dni", value: stats.visits_30d },
              {
                label: "Sesje unikalne (7d)",
                value: stats.unique_sessions_7d,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <GlassCard>
            <p className="font-display text-lg font-semibold">
              Wizyty (30 dni)
            </p>
            <div className="mt-4 flex h-36 items-end gap-1">
              {stats.by_day.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Brak danych.</p>
              ) : (
                stats.by_day.map((d) => (
                  <div
                    key={d.day}
                    className="group flex flex-1 flex-col items-center justify-end"
                    title={`${d.day}: ${d.count}`}
                  >
                    <div
                      className="w-full max-w-[18px] rounded-t bg-[var(--text)] transition group-hover:bg-[var(--ink)]"
                      style={{
                        height: `${Math.max(4, (d.count / maxDay) * 100)}%`,
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <p className="font-display text-lg font-semibold">Top ścieżki</p>
              <ul className="mt-3 space-y-2 text-sm">
                {stats.top_paths.map((p) => (
                  <li
                    key={p.path}
                    className="flex justify-between gap-3 border-b border-[var(--border)]/60 pb-2"
                  >
                    <span className="truncate text-[var(--muted)]">
                      {p.path}
                    </span>
                    <span className="text-[var(--text)]">{p.count}</span>
                  </li>
                ))}
                {stats.top_paths.length === 0 && (
                  <li className="text-[var(--muted)]">Brak danych.</li>
                )}
              </ul>
            </GlassCard>

            <GlassCard>
              <p className="font-display text-lg font-semibold">
                Ostatnie wejścia
              </p>
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
                {stats.recent.map((r) => (
                  <li
                    key={r.id}
                    className="border-b border-[var(--border)]/60 pb-2"
                  >
                    <p className="text-[var(--text)]">
                      {r.path}{" "}
                      <span className="text-xs text-[var(--muted)]">
                        {formatWhen(r.created_at)}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {r.referrer || "bez referrera"}
                      {r.session_id ? ` · ${r.session_id.slice(0, 8)}…` : ""}
                    </p>
                  </li>
                ))}
                {stats.recent.length === 0 && (
                  <li className="text-[var(--muted)]">Brak wejść.</li>
                )}
              </ul>
            </GlassCard>
          </div>

          <GlassButton
            type="button"
            variant="ghost"
            onClick={() => void reloadStats().catch((e: Error) => setError(e.message))}
          >
            Odśwież
          </GlassButton>
        </div>
      )}
    </div>
  );
}
