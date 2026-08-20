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
                        ? "Plan i Limity"
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
              { id: "plan", label: "Plan", icon: "credit_card" },
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

      {!active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
          <Link to="/settings/salon" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">store</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Salon</p>
              <p className="text-xs text-[var(--muted)]">Podstawowe dane, nazwa, strefa i zaliczka</p>
            </div>
          </Link>
          <Link to="/settings/services" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">spa</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Usługi</p>
              <p className="text-xs text-[var(--muted)]">Cennik, czasy trwania i opisy</p>
            </div>
          </Link>
          <Link to="/settings/faq" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">psychology</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">FAQ & Gemini AI</p>
              <p className="text-xs text-[var(--muted)]">Asystent Gemini 2.0 i baza wiedzy salonu</p>
            </div>
          </Link>
          <Link to="/settings/plan" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">credit_card</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Plan i limity</p>
              <p className="text-xs text-[var(--muted)]">Subskrypcja, zużycie wiadomości i rezerwacji</p>
            </div>
          </Link>
          <Link to="/settings/appearance" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
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

      {active === "plan" && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">Plan i limity</p>
          {!usage ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Ładowanie limitów…</p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-control bg-[var(--primary)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">
                  Plan: {usage.plan}
                </span>
                <span
                  className={`rounded-control px-2.5 py-0.5 text-xs font-semibold uppercase ${
                    usage.license_status === "active" || usage.license_status === "trial"
                      ? "border border-emerald-500/40 text-emerald-300"
                      : "border border-red-500/40 text-red-300"
                  }`}
                >
                  Status: {usage.license_status}
                </span>
                {usage.license_expires_at && (
                  <span className="text-xs text-[var(--muted)]">
                    Wygasa: {usage.license_expires_at.slice(0, 10)}
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Wizyty w tym miesiącu",
                    used: usage.appointments_month,
                    max: usage.max_appointments_month,
                  },
                  {
                    title: "Wiadomości w tym miesiącu",
                    used: usage.messages_month,
                    max: usage.max_messages_month,
                  },
                  {
                    title: "Stanowiska (seats)",
                    used: usage.seats,
                    max: usage.max_seats,
                  },
                ].map((row) => (
                  <div
                    key={row.title}
                    className="rounded-soft border border-glass-border bg-glass-fill p-3"
                  >
                    <p className="text-xs text-[var(--muted)]">{row.title}</p>
                    <p className="mt-1 font-mono text-base font-semibold">
                      {fmtLimit(row.used, row.max)}
                    </p>
                    {row.max != null && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ink)]/10">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${usagePct(row.used, row.max)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Kanały: {usage.enabled_channels.join(", ") || "—"}
              </p>
            </>
          )}
        </GlassCard>
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
