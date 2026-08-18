import { type FormEvent, useCallback, useEffect, useState } from "react";
import { usersApi } from "@/api";
import type { Owner, UserRole } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Właściciel",
  admin: "Admin",
  pracownik: "Pracownik",
};

export function UsersPage() {
  const { owner } = useAuth();
  const canManage = owner?.role === "owner" || owner?.role === "admin";
  const [users, setUsers] = useState<Owner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "pracownik" as UserRole,
  });

  const reload = useCallback(async () => {
    const list = await usersApi.list();
    setUsers(list);
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void reload().catch((e: Error) => setError(e.message));
  }, [canManage, reload]);

  if (!canManage) {
    return (
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Pracownicy</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Brak uprawnień — tylko właściciel i admin mogą zarządzać kontami.
        </p>
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await usersApi.create(form);
      setForm({ email: "", password: "", name: "", role: "pracownik" });
      setMsg("Konto utworzone");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function changeRole(user: Owner, role: UserRole) {
    setError(null);
    try {
      await usersApi.update(user.id, { role });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function toggleActive(user: Owner) {
    setError(null);
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function resetPassword(user: Owner) {
    setError(null);
    setMsg(null);
    try {
      const res = await usersApi.resetPassword(user.id);
      setMsg(
        res.temporary_password
          ? `Nowe hasło dla ${user.email}: ${res.temporary_password}`
          : res.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function removeUser(user: Owner) {
    if (!confirm(`Usunąć konto ${user.email}?`)) return;
    setError(null);
    try {
      await usersApi.remove(user.id);
      await reload();
      setMsg("Konto usunięte");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  const roleOptions: UserRole[] =
    owner?.role === "owner"
      ? ["owner", "admin", "pracownik"]
      : ["admin", "pracownik"];

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Pracownicy</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Dodawaj ludzi, nadawaj role i resetuj hasła. Stąd trafiają na listę przy przydzielaniu zadań.
        </p>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Nowe konto</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
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
            <span className="text-[var(--muted)]">Hasło startowe</span>
            <GlassInput
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Imię</span>
            <GlassInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Rola</span>
            <select
              className="w-full rounded-xl border border-glass-border bg-glass-fill px-3 py-2 text-sm text-white outline-none focus:border-canary/50"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as UserRole })
              }
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <GlassButton type="submit">Dodaj użytkownika</GlassButton>
          </div>
        </form>
      </GlassCard>

      <div className="space-y-3">
        {users.map((user) => (
          <GlassCard key={user.id} className="animate-fade-up">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold">
                  {user.name || user.email}
                </p>
                <p className="text-sm text-[var(--muted)]">{user.email}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {ROLE_LABEL[user.role]} ·{" "}
                  {user.is_active ? "aktywny" : "nieaktywny"} ·{" "}
                  {user.email_verified ? "e-mail OK" : "e-mail niepotwierdzony"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-xl border border-glass-border bg-glass-fill px-3 py-2 text-xs text-white"
                  value={user.role}
                  onChange={(e) =>
                    void changeRole(user, e.target.value as UserRole)
                  }
                  disabled={user.id === owner?.id}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <GlassButton
                  type="button"
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => void resetPassword(user)}
                >
                  Reset hasła
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => void toggleActive(user)}
                  disabled={user.id === owner?.id}
                >
                  {user.is_active ? "Dezaktywuj" : "Aktywuj"}
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="ghost"
                  className="!px-3 !py-1.5 text-xs text-[var(--danger)]"
                  onClick={() => void removeUser(user)}
                  disabled={user.id === owner?.id}
                >
                  Usuń
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        ))}
        {users.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Brak użytkowników.</p>
        )}
      </div>
    </div>
  );
}
