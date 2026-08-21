import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { authApi, usersApi } from "@/api";
import type { Owner, UserRole } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { fileToAvatarDataUrl } from "@/lib/avatar";
import { Avatar, GlassButton, GlassCard, Icon, PageHeader } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Właściciel",
  admin: "Admin",
  pracownik: "Pracownik",
};

export function UsersPage() {
  const { owner, refreshOwner } = useAuth();
  const canManage = owner?.role === "owner" || owner?.role === "admin";
  const [users, setUsers] = useState<Owner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
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
    void reload().catch((e: Error) => setError(e.message));
  }, [reload]);

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

  async function onPickPhoto(file: File | undefined, user: Owner) {
    if (!file) return;
    setError(null);
    setUploadingId(user.id);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      if (user.id === owner?.id) {
        await authApi.updateMe({ avatar_url: dataUrl });
        await refreshOwner();
      } else {
        await usersApi.update(user.id, { avatar_url: dataUrl });
      }
      await reload();
      setMsg("Zdjęcie zapisane");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wgrać zdjęcia");
    } finally {
      setUploadingId(null);
    }
  }

  const roleOptions: UserRole[] =
    owner?.role === "owner"
      ? ["owner", "admin", "pracownik"]
      : ["admin", "pracownik"];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="badge"
        title="Zespół"
        subtitle="Zdjęcia, role i konta ludzi w salonie"
      />

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const user = users.find((u) => u.id === targetId);
          const file = e.target.files?.[0];
          e.target.value = "";
          if (user) void onPickPhoto(file, user);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {users.map((user, i) => {
          const canEditPhoto = canManage || user.id === owner?.id;
          return (
            <GlassCard
              key={user.id}
              className="animate-pop"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="relative shrink-0"
                  disabled={!canEditPhoto || uploadingId === user.id}
                  onClick={() => {
                    setTargetId(user.id);
                    fileRef.current?.click();
                  }}
                  title={canEditPhoto ? "Zmień zdjęcie" : undefined}
                >
                  <Avatar src={user.avatar_url} name={user.name || user.email} size="lg" />
                  {canEditPhoto ? (
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-ink)]">
                      <Icon name="photo_camera" className="!text-[14px]" />
                    </span>
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{user.name || user.email}</p>
                  <p className="truncate text-sm text-[var(--muted)]">{user.email}</p>
                  <p className="mt-1 text-xs text-[var(--accent)]">
                    {ROLE_LABEL[user.role]} · {user.is_active ? "aktywny" : "nieaktywny"}
                  </p>
                </div>
              </div>
              {canManage ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs"
                    value={user.role}
                    onChange={(e) => void changeRole(user, e.target.value as UserRole)}
                    disabled={user.id === owner?.id}
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <GlassButton
                    variant="ghost"
                    className="!px-2 !py-1 text-xs"
                    onClick={() => void resetPassword(user)}
                  >
                    Reset hasła
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    className="!px-2 !py-1 text-xs"
                    onClick={() => void toggleActive(user)}
                    disabled={user.id === owner?.id}
                  >
                    {user.is_active ? "Dezaktywuj" : "Aktywuj"}
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    className="!px-2 !py-1 text-xs text-[var(--danger)]"
                    onClick={() => void removeUser(user)}
                    disabled={user.id === owner?.id}
                  >
                    Usuń
                  </GlassButton>
                </div>
              ) : null}
            </GlassCard>
          );
        })}
      </div>

      {canManage ? (
        <GlassCard className="animate-fade-up">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="person_add" className="text-[var(--accent)]" />
            Nowe konto
          </p>
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
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--focus)]"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <GlassButton type="submit">Dodaj do zespołu</GlassButton>
            </div>
          </form>
        </GlassCard>
      ) : null}
    </div>
  );
}
