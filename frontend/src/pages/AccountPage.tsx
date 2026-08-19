import { type FormEvent, useState } from "react";
import { authApi } from "@/api";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

export function AccountPage() {
  const { owner, acceptToken, token, resendVerification } = useAuth();
  const [name, setName] = useState(owner?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await authApi.updateMe({ name: name.trim() || null });
      if (token) await acceptToken(token);
      setMsg("Profil zapisany");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.detail : "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      setMsg(res.message);
      setCurrentPassword("");
      setNewPassword("");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.detail : "Nie udało się zmienić hasła");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--text-bright)]">
          Moje konto
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Profil, hasło i weryfikacja e-mail — Automovia.
        </p>
      </div>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-bright)]">Profil</h2>
        <p className="text-sm text-[var(--muted)]">
          E-mail: <strong className="text-[var(--text-bright)]">{owner?.email}</strong>
          {owner?.role ? ` · ${owner.role}` : ""}
          {owner?.email_verified ? " · zweryfikowany" : " · e-mail niepotwierdzony"}
        </p>
        {!owner?.email_verified && (
          <GlassButton
            type="button"
            variant="ghost"
            className="!px-3 !py-1.5 text-xs"
            onClick={() => void resendVerification()}
          >
            Wyślij ponownie link weryfikacyjny
          </GlassButton>
        )}
        <form className="space-y-3" onSubmit={saveProfile}>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">Imię / nazwa wyświetlana</span>
            <GlassInput value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <GlassButton type="submit" disabled={busy}>
            Zapisz profil
          </GlassButton>
        </form>
      </GlassCard>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-bright)]">Hasło</h2>
        <p className="text-xs text-[var(--muted)]">
          Konta Clerk/Google bez lokalnego hasła — zmiana tylko w dostawcy logowania.
        </p>
        <form className="space-y-3" onSubmit={changePassword}>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">Obecne hasło</span>
            <GlassInput
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">Nowe hasło</span>
            <GlassInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <GlassButton type="submit" disabled={busy}>
            Zmień hasło
          </GlassButton>
        </form>
      </GlassCard>

      {(msg || err) && (
        <p
          className={`text-sm ${err ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
          role={err ? "alert" : "status"}
        >
          {err || msg}
        </p>
      )}
    </div>
  );
}
