import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useParams, Link } from "react-router-dom";
import { businessApi, knowledgeApi, servicesApi } from "@/api";
import type { KnowledgeItem, LicenseUsage, Service } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassTextarea } from "@/components/ui/GlassInput";
import { useTheme } from "@/theme";
import { AccountPage } from "@/pages/AccountPage";

function fmtLimit(used: number, max: number | null) {
  if (max == null) return `${used} / ∞`;
  return `${used} / ${max}`;
}

function usagePct(used: number, max: number | null) {
  if (max == null || max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  const active = section;
  const { business, refreshBusiness } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [publicSlug, setPublicSlug] = useState("");
  const [depositPercent, setDepositPercent] = useState("0");
  const [gcalId, setGcalId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [usage, setUsage] = useState<LicenseUsage | null>(null);
  const [svcForm, setSvcForm] = useState({
    name: "",
    duration_min: 45,
    price: "80",
    description: "",
  });
  const [faqForm, setFaqForm] = useState({
    category: "",
    question: "",
    answer: "",
  });
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash");
  const [geminiBusy, setGeminiBusy] = useState(false);

  const [redeemKey, setRedeemKey] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [s, k] = await Promise.all([
      servicesApi.list(),
      knowledgeApi.list(),
    ]);
    setServices(s);
    setKnowledge(k);
    try {
      setUsage(await businessApi.usage());
    } catch {
      setUsage(null);
    }
  }

  useEffect(() => {
    if (business) {
      setName(business.name);
      setTimezone(business.timezone);
      setPublicSlug(business.public_slug || "");
      setDepositPercent(String(business.deposit_percent ?? 0));
      setGcalId(business.google_calendar_id || "");
      const bSet = (business.settings || {}) as Record<string, string>;
      setGeminiKey(bSet.gemini_api_key || "");
      setGeminiModel(bSet.gemini_model || "gemini-2.0-flash");
    }
  }, [business]);

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  async function saveBusiness(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await businessApi.update({
        name,
        timezone,
        public_slug: publicSlug.trim().toLowerCase() || null,
        deposit_percent: Number(depositPercent) || 0,
        google_calendar_id: gcalId.trim() || null,
      });
      await refreshBusiness();
      setMsg("Zapisano ustawienia biznesu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function addService(e: FormEvent) {
    e.preventDefault();
    await servicesApi.create({
      name: svcForm.name,
      duration_min: Number(svcForm.duration_min),
      price: svcForm.price,
      description: svcForm.description || null,
    });
    setSvcForm({ name: "", duration_min: 45, price: "80", description: "" });
    await reload();
  }

  async function addFaq(e: FormEvent) {
    e.preventDefault();
    await knowledgeApi.create(faqForm);
    setFaqForm({ category: "", question: "", answer: "" });
    await reload();
  }

  async function saveGemini(e: FormEvent) {
    e.preventDefault();
    setGeminiBusy(true);
    setError(null);
    setMsg(null);
    try {
      await businessApi.saveGeminiConfig({
        gemini_api_key: geminiKey,
        gemini_model: geminiModel,
      });
      await refreshBusiness();
      setMsg("Konfiguracja Gemini AI została pomyślnie zapisana.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu konfiguracji Gemini");
    } finally {
      setGeminiBusy(false);
    }
  }

  async function handleRedeemLicense(e: FormEvent) {
    e.preventDefault();
    if (!redeemKey.trim()) return;
    setRedeemBusy(true);
    setRedeemError(null);
    setRedeemMsg(null);
    try {
      const res = await businessApi.redeemLicense(redeemKey.trim());
      setRedeemMsg(res.message);
      setRedeemKey("");
      await reload();
      await refreshBusiness();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Błąd aktywacji kodu licencji");
    } finally {
      setRedeemBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{msg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {active === "account" ? null : (
        <header className="animate-fade-up flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
              <span className="material-symbols-outlined text-[24px]">settings</span>
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
                {!active 
                  ? "Ustawienia systemu"
                  : active === "services"
                    ? "Katalog Usług"
                    : active === "faq"
                      ? "FAQ & Gemini AI"
                      : active === "plan"
                        ? "Pakiet i Licencja"
                        : active === "appearance"
                          ? "Wygląd i Motyw"
                          : "Dane Salonu"}
              </h1>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {!active ? "Wybierz sekcję, którą chcesz skonfigurować" : "Zarządzaj konfiguracją swojego profilu"}
              </p>
            </div>
          </div>

          {/* Subnav Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[var(--surface-container)] p-1 rounded-xl border border-glass-border">
            {[
              { id: "salon", label: "Salon", icon: "store" },
              { id: "services", label: "Usługi", icon: "spa" },
              { id: "faq", label: "FAQ & Gemini AI", icon: "psychology" },
              { id: "plan", label: "Pakiet & Licencja", icon: "workspace_premium" },
              { id: "appearance", label: "Wygląd", icon: "palette" },
              { id: "account", label: "Konto", icon: "account_circle" },
            ].map((tab) => (
              <Link
                key={tab.id}
                to={`/settings/${tab.id}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  active === tab.id
                    ? "bg-[var(--primary-container)] text-white shadow"
                    : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                {tab.label}
              </Link>
            ))}
          </div>
        </header>
      )}

      {/* Grid of Main Settings Navigation Cards */}
      {!active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
          <Link to="/settings/salon" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">store</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Dane Salonu</p>
              <p className="text-xs text-[var(--muted)]">Nazwa, strefa, rezerwacje i zaliczki</p>
            </div>
          </Link>
          <Link to="/settings/services" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">spa</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Usługi i Cennik</p>
              <p className="text-xs text-[var(--muted)]">Zarządzanie ofertą i czasem trwania</p>
            </div>
          </Link>
          <Link to="/settings/faq" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">psychology</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">FAQ & Gemini AI</p>
              <p className="text-xs text-[var(--muted)]">Baza wiedzy i klucz Gemini API</p>
            </div>
          </Link>
          <Link to="/settings/plan" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4 border border-amber-500/30 bg-amber-500/5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">workspace_premium</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Pakiet & Licencja</p>
              <p className="text-xs text-[var(--muted)]">Twój aktualny plan, limity i kody</p>
            </div>
          </Link>
          <Link to="/settings/appearance" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">palette</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Wygląd</p>
              <p className="text-xs text-[var(--muted)]">Ciemny / jasny motyw panelu</p>
            </div>
          </Link>
          <Link to="/settings/account" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">account_circle</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Konto</p>
              <p className="text-xs text-[var(--muted)]">Profil właściciela i hasło</p>
            </div>
          </Link>
        </div>
      )}

      {active === "account" && <AccountPage />}
      {active && !["salon", "services", "faq", "plan", "appearance", "account"].includes(active) && (
        <Navigate to="/settings/salon" replace />
      )}


      {active === "appearance" && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">Wygląd</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Wybierz motyw interfejsu (ciemny domyślny lub jasny).
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className={`rounded-control px-4 py-2 text-sm font-medium transition-colors ${
                theme === "dark"
                  ? "bg-[var(--primary)] text-ink font-semibold"
                  : "border border-glass-border bg-glass-fill text-[var(--text)] hover:bg-white/5"
              }`}
              onClick={() => setTheme("dark")}
            >
              Ciemny (Dark)
            </button>
            <button
              type="button"
              className={`rounded-control px-4 py-2 text-sm font-medium transition-colors ${
                theme === "light"
                  ? "bg-[var(--primary)] text-ink font-semibold"
                  : "border border-glass-border bg-glass-fill text-[var(--text)] hover:bg-white/5"
              }`}
              onClick={() => setTheme("light")}
            >
              Jasny (Light)
            </button>
          </div>
        </GlassCard>
      )}

      {/* PLAN & LICENSE TAB */}
      {active === "plan" && (
        <div className="space-y-6 animate-fade-up">
          {redeemMsg && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span className="font-medium">{redeemMsg}</span>
            </div>
          )}
          {redeemError && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              <span className="font-medium">{redeemError}</span>
            </div>
          )}

          {/* Active Plan Showcase Banner */}
          <GlassCard className="p-6 border border-purple-500/30 bg-gradient-to-r from-purple-900/20 via-blue-900/10 to-transparent shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/20">
                  <span className="material-symbols-outlined text-[32px]">workspace_premium</span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">
                      Aktualny Pakiet:
                    </span>
                    <span className="font-display text-xl font-bold uppercase tracking-wide bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
                      {usage?.plan || business?.plan || "PRO"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      (usage?.license_status || business?.license_status) === "active"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      ● {usage?.license_status || business?.license_status || "aktywna"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-bright)] mt-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-400 text-[16px]">schedule</span>
                    {usage?.license_expires_at ? (
                      <span>Ważność licencji: <strong>{usage.license_expires_at.slice(0, 10)}</strong></span>
                    ) : (
                      <span className="text-amber-300 font-bold">👑 Dożywotnia Licencja VIP (Lifetime - Bez limitu czasu)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Gauges */}
            <div className="mt-6 pt-5 border-t border-white/10 grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: "Wizyty w tym miesiącu",
                  used: usage?.appointments_month ?? 0,
                  max: usage?.max_appointments_month ?? null,
                  icon: "calendar_month",
                },
                {
                  title: "Wiadomości czatu / bota",
                  used: usage?.messages_month ?? 0,
                  max: usage?.max_messages_month ?? null,
                  icon: "chat",
                },
                {
                  title: "Stanowiska w zespole",
                  used: usage?.seats ?? 0,
                  max: usage?.max_seats ?? 20,
                  icon: "badge",
                },
              ].map((row) => (
                <div
                  key={row.title}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>{row.title}</span>
                    <span className="material-symbols-outlined text-[16px]">{row.icon}</span>
                  </div>
                  <p className="mt-2 text-base font-bold font-mono text-[var(--text-bright)]">
                    {fmtLimit(row.used, row.max)}
                  </p>
                  {row.max != null && (
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-purple-400"
                        style={{ width: `${usagePct(row.used, row.max)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
              <span>Włączone kanały: <strong className="text-[var(--text-bright)]">{usage?.enabled_channels.join(", ") || "Wszystkie (Widget, Messenger, Instagram, WhatsApp, Telegram)"}</strong></span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                Pełny dostęp do modułów
              </span>
            </div>
          </GlassCard>

          {/* Self-Service Key Activation Box */}
          <GlassCard className="p-6 border border-amber-500/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">vpn_key</span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
                  Aktywuj Kod Licencji
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Otrzymałeś kod licencyjny od administratora? Wklej go poniżej, aby natychmiast uaktualnić pakiet i podnieść limity.
                </p>
              </div>
            </div>

            <form onSubmit={handleRedeemLicense} className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <GlassInput
                  placeholder="Wpisz kod licencji (np. BIZ-PRO-XXXX-XXXX)"
                  value={redeemKey}
                  onChange={(e) => setRedeemKey(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <GlassButton type="submit" variant="primary" disabled={redeemBusy} className="shrink-0">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                {redeemBusy ? "Aktywowanie..." : "Aktywuj licencję"}
              </GlassButton>
            </form>
          </GlassCard>
        </div>
      )}

      {active === "salon" && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">Salon</p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={saveBusiness}>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Nazwa</span>
              <GlassInput value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Strefa czasowa</span>
              <GlassInput
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Warsaw"
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Slug publicznej rezerwacji</span>
              <GlassInput
                value={publicSlug}
                onChange={(e) => setPublicSlug(e.target.value)}
                placeholder="moj-salon"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Zaliczka %</span>
              <GlassInput
                type="number"
                min={0}
                max={100}
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Google Calendar ID</span>
              <GlassInput
                value={gcalId}
                onChange={(e) => setGcalId(e.target.value)}
                placeholder="primary lub ID kalendarza"
              />
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Wymaga GOOGLE_CALENDAR_ENABLED + refresh token na API.
              </span>
            </label>
            {business?.id && (
              <p className="sm:col-span-2 text-xs text-[var(--muted)]">
                Link:{" "}
                <a
                  className="underline"
                  href={`/book/${publicSlug || business.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /book/{publicSlug || business.id}
                </a>
              </p>
            )}
            <GlassButton type="submit" className="sm:w-fit">
              Zapisz
            </GlassButton>
          </form>
        </GlassCard>
      )}

      {active === "services" && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">Usługi</p>
          <ul className="mt-3 space-y-2">
            {services.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-soft border border-glass-border bg-glass-fill px-3 py-2 text-sm"
              >
                <span>
                  {s.name} · {s.duration_min} min · {s.price} zł
                </span>
                <GlassButton
                  variant="ghost"
                  className="!py-1 !px-3"
                  onClick={() =>
                    void servicesApi
                      .remove(s.id)
                      .then(reload)
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  Usuń
                </GlassButton>
              </li>
            ))}
          </ul>
          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={addService}>
            <GlassInput
              placeholder="Nazwa"
              value={svcForm.name}
              onChange={(e) => setSvcForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <GlassInput
              type="number"
              placeholder="Minuty"
              value={svcForm.duration_min}
              onChange={(e) =>
                setSvcForm((f) => ({ ...f, duration_min: Number(e.target.value) }))
              }
              required
            />
            <GlassInput
              placeholder="Cena"
              value={svcForm.price}
              onChange={(e) => setSvcForm((f) => ({ ...f, price: e.target.value }))}
              required
            />
            <GlassButton type="submit">Dodaj usługę</GlassButton>
          </form>
        </GlassCard>
      )}

      {active === "faq" && (
        <div className="space-y-6 animate-fade-up">
          {/* Gemini AI Configuration Card */}
          <GlassCard className="border border-blue-500/20 bg-gradient-to-r from-blue-900/15 via-transparent to-purple-900/15 shadow-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg">
                  <span className="material-symbols-outlined text-[26px]">psychology</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-[var(--text-bright)]">
                      Silnik AI: Google Gemini (2.0 Flash)
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        geminiKey
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                      }`}
                    >
                      {geminiKey ? "AI Aktywne" : "Domyślny bot (Wpisz klucz)"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Inteligentny asystent AI prowadzi naturalne rozmowy, dopytuje o usługi, sprawdza wolne terminy i zapisuje rezerwacje w kalendarzu.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={saveGemini} className="space-y-4 pt-4 border-t border-white/5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                    Google Gemini API Key
                  </label>
                  <GlassInput
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="Wklej klucz API Gemini (np. AIzaSy...)"
                  />
                  <p className="text-[11px] text-[var(--muted)] mt-1">
                    Klucz możesz pobrać za darmo na{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--primary)] underline font-semibold"
                    >
                      Google AI Studio (aistudio.google.com)
                    </a>
                    .
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                    Model AI
                  </label>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Zalecany / Najszybszy)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
                  <span>Obsługuje wolne terminy, rezerwacje, odwoływanie, przekładanie i pytania z FAQ.</span>
                </div>

                <GlassButton type="submit" variant="primary" disabled={geminiBusy} className="!py-2 !px-4 text-xs shrink-0">
                  {geminiBusy ? "Zapisywanie..." : "Zapisz klucz Gemini AI"}
                </GlassButton>
              </div>
            </form>
          </GlassCard>

          {/* FAQ Knowledge Base */}
          <GlassCard className="animate-fade-up p-6">
            <p className="font-display text-lg font-semibold text-[var(--text-bright)]">Baza wiedzy i pytania FAQ</p>
            <p className="text-xs text-[var(--muted)] mb-4">
              Wpisy z tej listy są automatycznie przekazywane do bota Gemini AI, aby odpowiadał na niestandardowe pytania klientów.
            </p>
            <ul className="space-y-2 mb-6">
              {knowledge.map((k) => (
                <li
                  key={k.id}
                  className="rounded-soft border border-glass-border bg-glass-fill px-4 py-3 text-sm"
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-[var(--text-bright)]">{k.question}</p>
                    <GlassButton
                      variant="ghost"
                      className="!py-1 !px-3 text-xs"
                      onClick={() => void knowledgeApi.remove(k.id).then(reload)}
                    >
                      Usuń
                    </GlassButton>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">{k.answer}</p>
                </li>
              ))}
            </ul>
            <form className="space-y-3 pt-4 border-t border-white/5" onSubmit={addFaq}>
              <GlassInput
                placeholder="Kategoria (np. Cennik, Dojazd, Parking)"
                value={faqForm.category}
                onChange={(e) =>
                  setFaqForm((f) => ({ ...f, category: e.target.value }))
                }
              />
              <GlassInput
                placeholder="Pytanie klienta (np. Gdzie zaparkować auto?)"
                value={faqForm.question}
                onChange={(e) =>
                  setFaqForm((f) => ({ ...f, question: e.target.value }))
                }
                required
              />
              <GlassTextarea
                placeholder="Odpowiedź salonu (np. Mamy bezpłatny parking podziemny dla klientów...)"
                value={faqForm.answer}
                onChange={(e) =>
                  setFaqForm((f) => ({ ...f, answer: e.target.value }))
                }
                required
              />
              <GlassButton type="submit" variant="primary">Dodaj wpis do bazy wiedzy</GlassButton>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
