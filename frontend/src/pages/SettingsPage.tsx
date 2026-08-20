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

  return (
    <div className="space-y-6">
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
                      ? "FAQ i Baza wiedzy AI"
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
              { id: "faq", label: "FAQ AI", icon: "help" },
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
              <p className="font-semibold text-[var(--text-bright)]">FAQ Bota</p>
              <p className="text-xs text-[var(--muted)]">Baza wiedzy AI i odpowiedzi bota</p>
            </div>
          </Link>
          <Link to="/settings/plan" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">credit_card</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Plan i limity</p>
              <p className="text-xs text-[var(--muted)]">Subskrypcja, użycie i rozliczenia</p>
            </div>
          </Link>
          <Link to="/settings/appearance" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">palette</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Wygląd</p>
              <p className="text-xs text-[var(--muted)]">Motyw jasny / ciemny i widget</p>
            </div>
          </Link>
          <Link to="/settings/account" className="glass-panel glass-panel-interactive rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-400 shrink-0">
              <span className="material-symbols-outlined text-[26px]">account_circle</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Konto</p>
              <p className="text-xs text-[var(--muted)]">Twoje dane logowania i profil</p>
            </div>
          </Link>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{error}</span>
        </div>
      )}
      {msg && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{msg}</span>
        </div>
      )}

      {active === "account" && <AccountPage />}
      {active && !["salon", "services", "faq", "plan", "appearance", "account"].includes(active) && (
        <Navigate to="/settings/salon" replace />
      )}


      {active === "appearance" && (
      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Wygląd panelu</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Wybierz jasny lub ciemny motyw. Preferencja zapamiętuje się w tej
          przeglądarce.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <GlassButton
            type="button"
            variant={theme === "light" ? "primary" : "ghost"}
            className="!px-4 !py-2"
            onClick={() => setTheme("light")}
          >
            Jasny
          </GlassButton>
          <GlassButton
            type="button"
            variant={theme === "dark" ? "primary" : "ghost"}
            className="!px-4 !py-2"
            onClick={() => setTheme("dark")}
          >
            Ciemny
          </GlassButton>
        </div>
      </GlassCard>
      )}

      {active === "plan" && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">
            Licencja i limity
          </p>
          {!usage ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Brak danych użycia.</p>
          ) : (
            <>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Plan <span className="text-canary">{usage.plan}</span>
            {" · "}
            status{" "}
            <span className="text-canary">{usage.license_status}</span>
            {usage.is_active ? "" : " · nieaktywna"}
            {usage.license_expires_at
              ? ` · wygasa ${new Date(usage.license_expires_at).toLocaleDateString("pl-PL")}`
              : ""}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  label: "Rezerwacje (miesiąc)",
                  used: usage.appointments_month,
                  max: usage.max_appointments_month,
                },
                {
                  label: "Wiadomości (miesiąc)",
                  used: usage.messages_month,
                  max: usage.max_messages_month,
                },
                {
                  label: "Użytkownicy panelu",
                  used: usage.seats,
                  max: usage.max_seats,
                },
              ] as const
            ).map((row) => (
              <div
                key={row.label}
                className="rounded-soft border border-glass-border bg-glass-fill px-3 py-3"
              >
                <p className="text-xs text-[var(--muted)]">{row.label}</p>
                <p className="mt-1 font-display text-xl font-semibold">
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
      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">FAQ / baza wiedzy</p>
        <ul className="mt-3 space-y-2">
          {knowledge.map((k) => (
            <li
              key={k.id}
              className="rounded-soft border border-glass-border bg-glass-fill px-3 py-2 text-sm"
            >
              <div className="flex justify-between gap-2">
                <p className="font-medium">{k.question}</p>
                <GlassButton
                  variant="ghost"
                  className="!py-1 !px-3"
                  onClick={() => void knowledgeApi.remove(k.id).then(reload)}
                >
                  Usuń
                </GlassButton>
              </div>
              <p className="mt-1 text-[var(--muted)]">{k.answer}</p>
            </li>
          ))}
        </ul>
        <form className="mt-4 space-y-3" onSubmit={addFaq}>
          <GlassInput
            placeholder="Kategoria (opcjonalnie)"
            value={faqForm.category}
            onChange={(e) =>
              setFaqForm((f) => ({ ...f, category: e.target.value }))
            }
          />
          <GlassInput
            placeholder="Pytanie"
            value={faqForm.question}
            onChange={(e) =>
              setFaqForm((f) => ({ ...f, question: e.target.value }))
            }
            required
          />
          <GlassTextarea
            placeholder="Odpowiedź"
            value={faqForm.answer}
            onChange={(e) =>
              setFaqForm((f) => ({ ...f, answer: e.target.value }))
            }
            required
          />
          <GlassButton type="submit">Dodaj FAQ</GlassButton>
        </form>
      </GlassCard>
      )}
    </div>
  );
}
