import { type FormEvent, useCallback, useEffect, useState } from "react";
import { platformApi } from "@/api";
import type {
  LicenseKey,
  PlatformAccount,
  PlatformBusiness,
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

const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"] as const;
const STATUS_OPTIONS = ["trial", "active", "suspended", "expired"] as const;
const CHANNEL_OPTIONS = [
  "widget",
  "telegram",
  "messenger",
  "instagram",
  "whatsapp",
  "admin",
] as const;

type Tab = "licenses" | "businesses" | "accounts" | "stats";

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

function fmtLimit(used: number, max: number | null | undefined) {
  if (max == null) return `${used} / ∞ (Bez limitu)`;
  return `${used} / ${max}`;
}

export function PlatformPage() {
  const { owner } = useAuth();
  const canAccess = Boolean(owner?.is_platform_admin);
  const [tab, setTab] = useState<Tab>("licenses");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [businesses, setBusinesses] = useState<PlatformBusiness[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);
  const [stats, setStats] = useState<PlatformPageviewStats | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [grantBusy, setGrantBusy] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);

  // Quick Grant Form
  const [grantEmail, setGrantEmail] = useState("");
  const [grantPlan, setGrantPlan] = useState<string>("pro");
  const [grantDuration, setGrantDuration] = useState<string>("365");
  const [grantCustomDays, setGrantCustomDays] = useState("30");
  const [showCustomOverrides, setShowCustomOverrides] = useState(false);
  const [customMaxAppts, setCustomMaxAppts] = useState("");
  const [customMaxMsgs, setCustomMaxMsgs] = useState("");
  const [customMaxSeats, setCustomMaxSeats] = useState("");
  const [customChannels, setCustomChannels] = useState<string[]>([...CHANNEL_OPTIONS]);

  // Key Generator Form
  const [newKeyPlan, setNewKeyPlan] = useState("pro");
  const [newKeyDuration, setNewKeyDuration] = useState("365");
  const [newKeyMaxUses, setNewKeyMaxUses] = useState("1");
  const [newKeyNotes, setNewKeyNotes] = useState("");

  const [licenseForm, setLicenseForm] = useState({
    plan: "free",
    license_status: "active",
    license_expires_at: "",
    max_appointments_month: "",
    max_messages_month: "",
    max_seats: "",
    enabled_channels: [] as string[],
    apply_plan_defaults: false,
    clear_expiry: false,
  });

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

  const reloadKeys = useCallback(async () => {
    setLicenseKeys(await platformApi.listLicenseKeys());
  }, []);

  const reloadStats = useCallback(async () => {
    setStats(await platformApi.pageviewStats());
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    setError(null);
    const load = async () => {
      try {
        if (tab === "licenses") {
          await Promise.all([reloadBusinesses(), reloadAccounts(), reloadKeys()]);
        } else if (tab === "accounts") {
          await reloadAccounts();
        } else if (tab === "businesses") {
          await reloadBusinesses();
        } else {
          await reloadStats();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd ładowania danych platformy");
      }
    };
    void load();
  }, [canAccess, tab, reloadAccounts, reloadBusinesses, reloadKeys, reloadStats]);

  if (!canAccess) {
    return (
      <div className="animate-fade-up p-8 text-center glass-panel rounded-2xl max-w-xl mx-auto mt-12">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-bright)]">
          Strefa Superadmina (Platforma)
        </h1>
        <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">
          Brak uprawnień platform admina. Aby zarządzać licencjami i kontami na platformie, zaloguj się kontem z flagą administratora.
        </p>
      </div>
    );
  }

  async function handleQuickGrant(e: FormEvent) {
    e.preventDefault();
    if (!grantEmail.trim()) {
      setError("Wpisz adres e-mail konta lub wybierz z listy");
      return;
    }
    setGrantBusy(true);
    setError(null);
    setMsg(null);
    try {
      let days: number | null = null;
      if (grantDuration === "lifetime") {
        days = null;
      } else if (grantDuration === "custom") {
        days = Number(grantCustomDays) || 30;
      } else {
        days = Number(grantDuration);
      }

      const res = await platformApi.grantLicense({
        email: grantEmail.trim(),
        plan: grantPlan,
        duration_days: days,
        custom_max_appointments: showCustomOverrides && customMaxAppts ? Number(customMaxAppts) : undefined,
        custom_max_messages: showCustomOverrides && customMaxMsgs ? Number(customMaxMsgs) : undefined,
        custom_max_seats: showCustomOverrides && customMaxSeats ? Number(customMaxSeats) : undefined,
        custom_channels: showCustomOverrides ? customChannels : undefined,
      });

      setMsg(`🚀 ${res.message}`);
      await Promise.all([reloadBusinesses(), reloadAccounts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd nadawania licencji");
    } finally {
      setGrantBusy(false);
    }
  }

  async function handleCreateKey(e: FormEvent) {
    e.preventDefault();
    setKeyBusy(true);
    setError(null);
    setMsg(null);
    try {
      const days = newKeyDuration === "lifetime" ? null : Number(newKeyDuration);
      const res = await platformApi.createLicenseKey({
        plan: newKeyPlan,
        duration_days: days,
        max_uses: Number(newKeyMaxUses) || 1,
        notes: newKeyNotes.trim() || undefined,
      });
      setMsg(`🎉 Wygenerowano klucz licencyjny: ${res.key}`);
      setNewKeyNotes("");
      await reloadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd generowania klucza");
    } finally {
      setKeyBusy(false);
    }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("Czy na pewno chcesz usunąć ten klucz licencyjny?")) return;
    try {
      await platformApi.deleteLicenseKey(id);
      await reloadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd usuwania klucza");
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const res = await platformApi.createAccount({
        email: form.email.trim(),
        name: form.name.trim() || undefined,
        business_name: form.business_name.trim() || undefined,
        role: form.role,
      });
      setMsg(
        `Konto ${res.account.email} utworzone. Hasło jednorazowe: ${res.temporary_password}`,
      );
      setForm({ email: "", name: "", business_name: "", role: "owner" });
      await reloadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tworzenia konta");
    }
  }

  async function onResetPassword(account: PlatformAccount) {
    if (
      !confirm(
        `Zresetować hasło dla ${account.email}? Zostanie wygenerowane hasło tymczasowe.`,
      )
    ) {
      return;
    }
    setError(null);
    setMsg(null);
    try {
      const res = await platformApi.resetPassword(account.id);
      setMsg(
        `Nowe hasło dla ${account.email}: ${res.temporary_password ?? "(brak)"}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd resetu hasła");
    }
  }

  async function onTogglePlatformAdmin(account: PlatformAccount) {
    const next = !account.is_platform_admin;
    if (
      !confirm(
        `${next ? "Nadać" : "Odebrać"} uprawnienia platform admin dla ${account.email}?`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await platformApi.updateAccount(account.id, { is_platform_admin: next });
      await reloadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zmiany uprawnień");
    }
  }

  function startEditBusiness(b: PlatformBusiness) {
    setEditingId(b.id);
    const exp = b.license_expires_at
      ? b.license_expires_at.slice(0, 10)
      : "";
    setLicenseForm({
      plan: b.plan || "free",
      license_status: b.license_status || "trial",
      license_expires_at: exp,
      max_appointments_month:
        b.max_appointments_month == null ? "" : String(b.max_appointments_month),
      max_messages_month:
        b.max_messages_month == null ? "" : String(b.max_messages_month),
      max_seats: b.max_seats == null ? "" : String(b.max_seats),
      enabled_channels: b.enabled_channels?.length
        ? [...b.enabled_channels]
        : [...CHANNEL_OPTIONS],
      apply_plan_defaults: false,
      clear_expiry: !b.license_expires_at,
    });
  }

  async function saveBusinessLicense(e: FormEvent, businessId: string) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const appt =
        licenseForm.max_appointments_month.trim() === ""
          ? null
          : Number(licenseForm.max_appointments_month);
      const msgMax =
        licenseForm.max_messages_month.trim() === ""
          ? null
          : Number(licenseForm.max_messages_month);
      const seats =
        licenseForm.max_seats.trim() === ""
          ? null
          : Number(licenseForm.max_seats);

      await platformApi.updateBusiness(businessId, {
        plan: licenseForm.plan,
        license_status: licenseForm.license_status,
        license_expires_at: licenseForm.clear_expiry
          ? null
          : licenseForm.license_expires_at
            ? new Date(licenseForm.license_expires_at).toISOString()
            : null,
        max_appointments_month: appt,
        max_messages_month: msgMax,
        max_seats: seats,
        enabled_channels: licenseForm.enabled_channels,
        apply_plan_defaults: licenseForm.apply_plan_defaults,
        clear_expiry: licenseForm.clear_expiry,
      });
      setMsg("Zapisano licencję firmy");
      setEditingId(null);
      await reloadBusinesses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu licencji");
    }
  }

  const maxDay = Math.max(1, ...(stats?.by_day.map((d) => d.count) || [1]));

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)] flex items-center gap-2">
              Superadmin & Licencje
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Enterprise
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Centralne zarządzanie licencjami PRO, kluczami aktywacyjnymi i kontami klientów
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[var(--surface-container)] p-1 rounded-xl border border-glass-border">
          {[
            { id: "licenses", label: "Licencje & Pakiety", icon: "workspace_premium" },
            { id: "businesses", label: "Salony i Firmy", icon: "store" },
            { id: "accounts", label: "Użytkownicy", icon: "group" },
            { id: "stats", label: "Statystyki", icon: "analytics" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as Tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                tab === t.id
                  ? "bg-[var(--primary-container)] text-white shadow-md font-bold"
                  : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {msg && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm flex items-center gap-2 animate-fade-in shadow-lg">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span className="font-medium">{msg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2 animate-fade-in shadow-lg">
          <span className="material-symbols-outlined text-lg">error</span>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {tab === "licenses" && (
        <div className="space-y-6">
          <GlassCard className="p-6 border border-[var(--primary)]/30 bg-gradient-to-br from-blue-900/15 via-transparent to-amber-900/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined text-[22px]">bolt</span>
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[var(--text-bright)]">
                  ⚡ Szybkie nadanie licencji / Upgrade konta
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Wpisz e-mail klienta, wybierz pakiet i ważność. Limity i funkcje zostaną natychmiast odblokowane na jego koncie.
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickGrant} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-bright)]">
                    Adres e-mail konta klienta
                  </label>
                  <div className="relative">
                    <GlassInput
                      type="email"
                      value={grantEmail}
                      onChange={(e) => setGrantEmail(e.target.value)}
                      placeholder="np. klient@salon.pl"
                      required
                    />
                  </div>
                  {accounts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-[var(--muted)]">Szybki wybór:</span>
                      {accounts.slice(0, 4).map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setGrantEmail(acc.email)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[var(--text-bright)] transition-colors cursor-pointer"
                        >
                          {acc.email}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-bright)]">
                    Okres ważności licencji
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "30", label: "1 Miesiąc" },
                      { id: "90", label: "3 Miesiące" },
                      { id: "180", label: "6 Miesięcy" },
                      { id: "365", label: "1 Rok" },
                      { id: "lifetime", label: "👑 Dożywotnia" },
                      { id: "custom", label: "Własna data" },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setGrantDuration(d.id)}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                          grantDuration === d.id
                            ? "bg-[var(--primary-container)] border-[var(--primary)] text-white shadow font-bold"
                            : "bg-white/5 border-white/10 text-[var(--muted)] hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {grantDuration === "custom" && (
                    <div className="pt-2">
                      <GlassInput
                        type="number"
                        min="1"
                        placeholder="Liczba dni ważności (np. 45)"
                        value={grantCustomDays}
                        onChange={(e) => setGrantCustomDays(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-bright)]">
                  Wybierz Pakiet i Limity
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    {
                      id: "free",
                      title: "FREE",
                      desc: "30 rezerwacji / 200 wiadomości / 2 stanowiska",
                      color: "border-gray-500/30 text-gray-400",
                      badge: "Podstawowy",
                    },
                    {
                      id: "starter",
                      title: "STARTER",
                      desc: "150 rezerwacji / 2 000 wiadomości / 5 stanowisk",
                      color: "border-blue-500/40 text-blue-400",
                      badge: "Dla małych firm",
                    },
                    {
                      id: "pro",
                      title: "PRO",
                      desc: "Nielimitowane rezerwacje & wiadomości / 20 stanowisk / Wszystkie kanały",
                      color: "border-purple-500/50 text-purple-300 bg-purple-500/10",
                      badge: "⭐ Rekomendowany",
                    },
                    {
                      id: "enterprise",
                      title: "ENTERPRISE",
                      desc: "Pełny pakiet VIP / Nielimitowane stanowiska / Dedykowana opieka",
                      color: "border-amber-500/50 text-amber-300 bg-amber-500/10",
                      badge: "👑 VIP / Korporacja",
                    },
                  ].map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setGrantPlan(p.id)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        grantPlan === p.id
                          ? `${p.color} ring-2 ring-white/30 scale-[1.02] shadow-xl`
                          : "border-white/10 bg-white/5 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-[var(--text-bright)]">{p.title}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10">{p.badge}</span>
                        </div>
                        <p className="text-[11px] text-[var(--muted)] leading-relaxed">{p.desc}</p>
                      </div>
                      <div className="mt-2 text-right">
                        <span className={`material-symbols-outlined text-sm ${grantPlan === p.id ? "text-white" : "text-transparent"}`}>
                          check_circle
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomOverrides((v) => !v)}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showCustomOverrides ? "expand_less" : "tune"}
                  </span>
                  {showCustomOverrides ? "Ukryj niestandardowe modyfikatory limitów" : "Opcjonalnie: Zmodyfikuj ręcznie limity (Overrides)"}
                </button>

                {showCustomOverrides && (
                  <div className="mt-3 p-4 rounded-xl bg-black/20 border border-white/10 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">
                          Max rezerwacji/mc (puste = wg planu)
                        </label>
                        <GlassInput
                          type="number"
                          placeholder="np. 500"
                          value={customMaxAppts}
                          onChange={(e) => setCustomMaxAppts(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">
                          Max wiadomości/mc (puste = wg planu)
                        </label>
                        <GlassInput
                          type="number"
                          placeholder="np. 10000"
                          value={customMaxMsgs}
                          onChange={(e) => setCustomMaxMsgs(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">
                          Max stanowisk w zespole (puste = wg planu)
                        </label>
                        <GlassInput
                          type="number"
                          placeholder="np. 50"
                          value={customMaxSeats}
                          onChange={(e) => setCustomMaxSeats(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[var(--muted)] mb-1.5">
                        Włączone kanały komunikacji:
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {CHANNEL_OPTIONS.map((ch) => (
                          <label key={ch} className="flex items-center gap-1.5 text-xs text-[var(--text-bright)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={customChannels.includes(ch)}
                              onChange={(e) => {
                                setCustomChannels((prev) =>
                                  e.target.checked ? [...prev, ch] : prev.filter((c) => c !== ch),
                                );
                              }}
                            />
                            {ch}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-white/10">
                <GlassButton type="submit" variant="primary" disabled={grantBusy} className="!py-3 !px-6 text-sm font-bold shadow-xl">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  {grantBusy ? "Aktywowanie licencji..." : `Aktywuj Pakiet ${grantPlan.toUpperCase()} dla konta`}
                </GlassButton>
              </div>
            </form>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">key</span>
                </div>
                <h3 className="font-display text-sm font-bold text-[var(--text-bright)]">
                  Generator Kodów Licencyjnych
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
                Wygeneruj jednorazowy kod licencyjny, który klient może sam aktywować w Ustawieniach.
              </p>

              <form onSubmit={handleCreateKey} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">Pakiet licencji</label>
                  <select
                    value={newKeyPlan}
                    onChange={(e) => setNewKeyPlan(e.target.value)}
                    className="w-full bg-[var(--surface-container)] border border-white/10 rounded-xl px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="pro">PRO (Nielimitowany)</option>
                    <option value="starter">STARTER</option>
                    <option value="enterprise">ENTERPRISE (VIP)</option>
                    <option value="free">FREE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">Czas trwania</label>
                  <select
                    value={newKeyDuration}
                    onChange={(e) => setNewKeyDuration(e.target.value)}
                    className="w-full bg-[var(--surface-container)] border border-white/10 rounded-xl px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="365">1 Rok (365 dni)</option>
                    <option value="180">6 Miesięcy (180 dni)</option>
                    <option value="90">3 Miesiące (90 dni)</option>
                    <option value="30">1 Miesiąc (30 dni)</option>
                    <option value="lifetime">Dożywotnia (Lifetime)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">Maksymalna liczba aktywacji</label>
                  <GlassInput
                    type="number"
                    min="1"
                    placeholder="1"
                    value={newKeyMaxUses}
                    onChange={(e) => setNewKeyMaxUses(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">Notatka / Dla kogo</label>
                  <GlassInput
                    placeholder="np. Salon Piękna Warszawa - Umowa Roczna"
                    value={newKeyNotes}
                    onChange={(e) => setNewKeyNotes(e.target.value)}
                  />
                </div>

                <GlassButton type="submit" variant="primary" disabled={keyBusy} className="w-full justify-center !py-2.5 text-xs">
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  {keyBusy ? "Generowanie..." : "Wygeneruj Kod Licencji"}
                </GlassButton>
              </form>
            </GlassCard>

            <GlassCard className="p-6 lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-bold text-[var(--text-bright)] flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">vpn_key</span>
                    Kody Licencyjne ({licenseKeys.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => void reloadKeys()}
                    className="text-xs text-[var(--muted)] hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    Odśwież
                  </button>
                </div>

                {licenseKeys.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-8 text-center">Brak wygenerowanych kodów licencyjnych.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {licenseKeys.map((k) => (
                      <div
                        key={k.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-300 tracking-wider select-all">{k.key}</span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                              {k.plan}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${k.is_active ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-400"}`}>
                              {k.is_active ? "Aktywny" : "Zużyty"}
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate">
                            {k.duration_days ? `${k.duration_days} dni` : "Dożywotnia (Lifetime)"} · Użycia: {k.times_used}/{k.max_uses} · Utworzono: {formatWhen(k.created_at)}
                            {k.notes ? ` · ${k.notes}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(k.key);
                              alert(`Skopiowano kod do schowka: ${k.key}`);
                            }}
                            className="p-1.5 text-[var(--muted)] hover:text-white rounded hover:bg-white/10 cursor-pointer"
                            title="Kopiuj kod"
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteKey(k.id)}
                            className="p-1.5 text-[var(--muted)] hover:text-red-400 rounded hover:bg-red-500/10 cursor-pointer"
                            title="Usuń klucz"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-6">
            <h3 className="font-display text-sm font-bold text-[var(--text-bright)] mb-3">
              Wszystkie Salony i Stan Licencji ({businesses.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[var(--muted)] font-semibold">
                    <th className="py-2.5 px-3">Nazwa Salonu</th>
                    <th className="py-2.5 px-3">Pakiet</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Ważność</th>
                    <th className="py-2.5 px-3">Wykorzystanie (Wizyty / Msg)</th>
                    <th className="py-2.5 px-3 text-right">Szybka akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {businesses.map((b) => (
                    <tr key={b.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-semibold text-[var(--text-bright)]">{b.name}</td>
                      <td className="py-3 px-3">
                        <span className={`uppercase font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          b.plan === "pro"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : b.plan === "enterprise"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : b.plan === "starter"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-gray-500/20 text-gray-300"
                        }`}>
                          {b.plan || "free"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[11px] font-semibold ${b.license_status === "active" ? "text-emerald-400" : "text-amber-400"}`}>
                          ● {b.license_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[var(--muted)]">
                        {b.license_expires_at ? b.license_expires_at.slice(0, 10) : "👑 Dożywotnia (Lifetime)"}
                      </td>
                      <td className="py-3 px-3 text-[var(--muted)] font-mono">
                        {b.usage
                          ? `${fmtLimit(b.usage.appointments_month, b.usage.max_appointments_month)} appt`
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setTab("businesses");
                              startEditBusiness(b);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[10px] transition-colors cursor-pointer"
                          >
                            Edytuj limity
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {tab === "accounts" && (
        <div className="space-y-6 animate-fade-up">
          <GlassCard className="p-6">
            <h2 className="font-display text-base font-bold text-[var(--text-bright)] mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">person_add</span>
              Nowe konto użytkownika
            </h2>
            <p className="text-xs text-[var(--muted)] mb-4">
              Utwórz nowe konto. Jeśli pole nazwy salonu zostanie wypełnione, zostanie utworzona nowa instancja biznesu.
            </p>
            <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GlassInput
                type="email"
                placeholder="E-mail"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <GlassInput
                placeholder="Imię i nazwisko"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <GlassInput
                placeholder="Nazwa salonu (opcjonalnie)"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full bg-[var(--surface-container)] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="owner">Właściciel</option>
                  <option value="admin">Admin</option>
                  <option value="pracownik">Pracownik</option>
                </select>
                <GlassButton type="submit" variant="primary" className="shrink-0">
                  Utwórz
                </GlassButton>
              </div>
            </form>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="font-display text-base font-bold text-[var(--text-bright)] mb-4">
              Wszystkie konta ({accounts.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[var(--muted)] font-semibold">
                    <th className="py-2.5 px-3">E-mail</th>
                    <th className="py-2.5 px-3">Imię</th>
                    <th className="py-2.5 px-3">Firma</th>
                    <th className="py-2.5 px-3">Rola</th>
                    <th className="py-2.5 px-3">Superadmin</th>
                    <th className="py-2.5 px-3 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-semibold text-[var(--text-bright)]">{a.email}</td>
                      <td className="py-3 px-3 text-[var(--muted)]">{a.name || "—"}</td>
                      <td className="py-3 px-3 text-[var(--text-bright)]">{a.business_name || "—"}</td>
                      <td className="py-3 px-3">{ROLE_LABEL[a.role]}</td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => void onTogglePlatformAdmin(a)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                            a.is_platform_admin
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-white/5 text-[var(--muted)] border-white/10 hover:text-white"
                          }`}
                        >
                          {a.is_platform_admin ? "SUPERADMIN" : "Użytkownik"}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setGrantEmail(a.email);
                              setTab("licenses");
                            }}
                            className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            Nadaj PRO
                          </button>
                          <button
                            type="button"
                            onClick={() => void onResetPassword(a)}
                            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[var(--text-bright)] text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            Reset hasła
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {tab === "businesses" && (
        <div className="space-y-4 animate-fade-up">
          {businesses.map((b) => {
            const isEditing = editingId === b.id;
            return (
              <GlassCard key={b.id} className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
                      {b.name}
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[var(--primary-container)] text-white">
                        {b.plan || "free"}
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      ID: <span className="font-mono">{b.id}</span> · Strefa: {b.timezone}
                    </p>
                  </div>

                  <GlassButton
                    type="button"
                    variant={isEditing ? "ghost" : "primary"}
                    onClick={() => (isEditing ? setEditingId(null) : startEditBusiness(b))}
                  >
                    {isEditing ? "Anuluj" : "Edytuj licencję i limity"}
                  </GlassButton>
                </div>

                {isEditing ? (
                  <form onSubmit={(e) => void saveBusinessLicense(e, b.id)} className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1 text-xs">
                      <span className="font-semibold text-[var(--muted)]">Plan</span>
                      <select
                        value={licenseForm.plan}
                        onChange={(e) => setLicenseForm({ ...licenseForm, plan: e.target.value })}
                        className="w-full bg-[var(--surface-container)] border border-white/10 rounded-xl px-3 py-2 text-xs text-[var(--text-bright)]"
                      >
                        {PLAN_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs">
                      <span className="font-semibold text-[var(--muted)]">Status</span>
                      <select
                        value={licenseForm.license_status}
                        onChange={(e) => setLicenseForm({ ...licenseForm, license_status: e.target.value })}
                        className="w-full bg-[var(--surface-container)] border border-white/10 rounded-xl px-3 py-2 text-xs text-[var(--text-bright)]"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs">
                      <span className="font-semibold text-[var(--muted)]">Wygasa (data)</span>
                      <GlassInput
                        type="date"
                        value={licenseForm.license_expires_at}
                        onChange={(e) => setLicenseForm({ ...licenseForm, license_expires_at: e.target.value, clear_expiry: false })}
                        disabled={licenseForm.clear_expiry}
                      />
                    </label>

                    <label className="flex items-center gap-2 text-xs pt-5">
                      <input
                        type="checkbox"
                        checked={licenseForm.clear_expiry}
                        onChange={(e) => setLicenseForm({ ...licenseForm, clear_expiry: e.target.checked })}
                      />
                      <span className="text-[var(--text-bright)]">Dożywotnia (Bez daty wygaśnięcia)</span>
                    </label>

                    <div className="sm:col-span-2 pt-2 flex justify-end">
                      <GlassButton type="submit" variant="primary">
                        Zapisz zmiany w licencji
                      </GlassButton>
                    </div>
                  </form>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="p-3 rounded-xl bg-white/5">
                      <p className="text-[var(--muted)]">Wizyty w tym miesiącu</p>
                      <p className="font-bold text-sm text-[var(--text-bright)] mt-0.5">
                        {fmtLimit(b.usage?.appointments_month ?? 0, b.max_appointments_month)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5">
                      <p className="text-[var(--muted)]">Wiadomości w tym miesiącu</p>
                      <p className="font-bold text-sm text-[var(--text-bright)] mt-0.5">
                        {fmtLimit(b.usage?.messages_month ?? 0, b.max_messages_month)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5">
                      <p className="text-[var(--muted)]">Miejsca w zespole</p>
                      <p className="font-bold text-sm text-[var(--text-bright)] mt-0.5">
                        {fmtLimit(b.usage?.seats ?? 0, b.max_seats)}
                      </p>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {tab === "stats" && stats && (
        <div className="space-y-6 animate-fade-up">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Dziś", value: stats.visits_today },
              { label: "7 dni", value: stats.visits_7d },
              { label: "30 dni", value: stats.visits_30d },
              { label: "Sesje unikalne (7d)", value: stats.unique_sessions_7d },
            ].map((item) => (
              <div key={item.label} className="glass-panel p-4 rounded-xl border border-white/10">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{item.label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-[var(--text-bright)]">{item.value}</p>
              </div>
            ))}
          </div>

          <GlassCard className="p-6">
            <p className="font-display text-sm font-bold text-[var(--text-bright)] mb-4">Wizyty w ciągu ostatnich 30 dni</p>
            <div className="flex h-36 items-end gap-1">
              {stats.by_day.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end group" title={`${d.day}: ${d.count}`}>
                  <div
                    className="w-full rounded-t bg-[var(--primary)] group-hover:bg-amber-400 transition-colors"
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
