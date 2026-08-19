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
      <header className="animate-fade-up flex flex-col items-start gap-3">
        {active && (
          <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-[var(--on-surface-variant)] hover:text-[var(--text)] transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Wróć do ustawień
          </Link>
        )}
        <div>
          <h1 className="font-display text-display-lg-mobile md:text-display-lg font-bold">
          {!active 
              ? "Ustawienia"
              : active === "services"
                ? "Usługi"
                : active === "faq"
                  ? "FAQ bota"
                  : active === "plan"
                    ? "Plan i limity"
                    : active === "appearance"
                      ? "Wygląd"
                      : "Ustawienia salonu"}
        </h1>
        <p className="mt-1 text-body-md text-[var(--on-surface-variant)]">
          {!active ? "Skonfiguruj system" : "Zarządzaj ustawieniami"}
        </p>
        </div>
      </header>
      )}

      {!active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
          <Link to="/settings/salon" className="glass-panel rounded-[28px] p-6 hover:border-white/20 hover:shadow-glow transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">storefront</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">Salon</p>
              <p className="text-sm text-[var(--on-surface-variant)]">Podstawowe dane</p>
            </div>
          </Link>
          <Link to="/settings/services" className="glass-panel rounded-[28px] p-6 hover:border-white/20 hover:shadow-glow transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary shrink-0">
              <span className="material-symbols-outlined">design_services</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">Usługi</p>
              <p className="text-sm text-[var(--on-surface-variant)]">Twój cennik</p>
            </div>
          </Link>
          <Link to="/settings/faq" className="glass-panel rounded-[28px] p-6 hover:border-white/20 hover:shadow-glow transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">help_center</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">FAQ Bota</p>
              <p className="text-sm text-[var(--on-surface-variant)]">Baza wiedzy AI</p>
            </div>
          </Link>
          <Link to="/settings/plan" className="glass-panel rounded-[28px] p-6 hover:border-white/20 hover:shadow-glow transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary shrink-0">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">Plan i limity</p>
              <p className="text-sm text-[var(--on-surface-variant)]">Subskrypcja</p>
            </div>
          </Link>
          <Link to="/settings/appearance" className="glass-panel rounded-[28px] p-6 hover:border-white/20 hover:shadow-glow transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary shrink-0">
              <span className="material-symbols-outlined">palette</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">Wygląd</p>
              <p className="text-sm text-[var(--on-surface-variant)]">Motyw i widget</p>
            </div>
          </Link>
          <Link to="/settings/account" className="glass-panel rounded-[28px] p-6 hover:border-white/20 hover:shadow-glow transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">Konto</p>
              <p className="text-sm text-[var(--on-surface-variant)]">Twoje dane logowania</p>
            </div>
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      {active === "account" && <AccountPage />}
      {active && !["salon", "services", "faq", "plan", "appearance", "account"].includes(active) && (
        <Navigate to="/settings/salon" replace />
      )}


      {active === "appearance" && (
        <div className="glass-panel rounded-[28px] p-6 animate-fade-up">
          <p className="font-headline-md text-headline-md">Wygląd panelu</p>
          <p className="mt-1 text-body-md text-[var(--on-surface-variant)]">
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
        </div>
      )}

      {active === "plan" && (
        <div className="glass-panel rounded-[28px] p-6 animate-fade-up">
          <p className="font-headline-md text-headline-md">
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
                className="glass-panel rounded-2xl p-4"
              >
                <p className="text-label-caps font-label-caps text-[var(--on-surface-variant)]">{row.label}</p>
                <p className="mt-1 font-kpi-stat text-kpi-stat">
                  {fmtLimit(row.used, row.max)}
                </p>
                {row.max != null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-container to-tertiary-container"
                      style={{ width: `${usagePct(row.used, row.max)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-body-md text-[var(--on-surface-variant)]">
            Kanały: {usage.enabled_channels.join(", ") || "—"}
          </p>
            </>
          )}
        </div>
      )}

      {active === "salon" && (
      <div className="glass-panel rounded-[28px] p-6 animate-fade-up">
        <p className="font-headline-md text-headline-md">Salon</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={saveBusiness}>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--on-surface-variant)]">Nazwa</span>
            <GlassInput value={name} onChange={(e) => setName(e.target.value)} required className="glass-input" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--on-surface-variant)]">Strefa czasowa</span>
            <GlassInput
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Warsaw"
              required
              className="glass-input"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--on-surface-variant)]">Slug publicznej rezerwacji</span>
            <GlassInput
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder="moj-salon"
              className="glass-input"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--on-surface-variant)]">Zaliczka %</span>
            <GlassInput
              type="number"
              min={0}
              max={100}
              value={depositPercent}
              onChange={(e) => setDepositPercent(e.target.value)}
              className="glass-input"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[var(--on-surface-variant)]">Google Calendar ID</span>
            <GlassInput
              value={gcalId}
              onChange={(e) => setGcalId(e.target.value)}
              placeholder="primary lub ID kalendarza"
              className="glass-input"
            />
            <span className="mt-1 block text-body-md text-[var(--on-surface-variant)]">
              Wymaga GOOGLE_CALENDAR_ENABLED + refresh token na API.
            </span>
          </label>
          {business?.id && (
            <p className="sm:col-span-2 text-body-md text-[var(--on-surface-variant)]">
              Link:{" "}
              <a
                className="underline text-primary"
                href={`/book/${publicSlug || business.id}`}
                target="_blank"
                rel="noreferrer"
              >
                /book/{publicSlug || business.id}
              </a>
            </p>
          )}
          <GlassButton type="submit" className="sm:w-fit mt-2">
            Zapisz
          </GlassButton>
        </form>
      </div>
      )}

      {active === "services" && (
      <div className="glass-panel rounded-[28px] p-6 animate-fade-up">
        <p className="font-headline-md text-headline-md">Usługi</p>
        <ul className="mt-3 space-y-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 glass-panel rounded-2xl px-4 py-3 text-body-md"
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
                <span className="material-symbols-outlined text-[18px]">delete</span>
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
            className="glass-input"
          />
          <GlassInput
            type="number"
            placeholder="Minuty"
            value={svcForm.duration_min}
            onChange={(e) =>
              setSvcForm((f) => ({ ...f, duration_min: Number(e.target.value) }))
            }
            required
            className="glass-input"
          />
          <GlassInput
            placeholder="Cena"
            value={svcForm.price}
            onChange={(e) => setSvcForm((f) => ({ ...f, price: e.target.value }))}
            required
            className="glass-input"
          />
          <GlassButton type="submit">Dodaj usługę</GlassButton>
        </form>
      </div>
      )}

      {active === "faq" && (
      <div className="glass-panel rounded-[28px] p-6 animate-fade-up">
        <p className="font-headline-md text-headline-md">FAQ / baza wiedzy</p>
        <ul className="mt-3 space-y-2">
          {knowledge.map((k) => (
            <li
              key={k.id}
              className="glass-panel rounded-2xl px-4 py-3 text-body-md"
            >
              <div className="flex justify-between gap-2">
                <p className="font-medium text-[var(--text)]">{k.question}</p>
                <GlassButton
                  variant="ghost"
                  className="!py-1 !px-3"
                  onClick={() => void knowledgeApi.remove(k.id).then(reload)}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Usuń
                </GlassButton>
              </div>
              <p className="mt-1 text-[var(--on-surface-variant)]">{k.answer}</p>
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
            className="glass-input"
          />
          <GlassInput
            placeholder="Pytanie"
            value={faqForm.question}
            onChange={(e) =>
              setFaqForm((f) => ({ ...f, question: e.target.value }))
            }
            required
            className="glass-input"
          />
          <GlassTextarea
            placeholder="Odpowiedź"
            value={faqForm.answer}
            onChange={(e) =>
              setFaqForm((f) => ({ ...f, answer: e.target.value }))
            }
            required
            className="glass-input"
          />
          <GlassButton type="submit">Dodaj FAQ</GlassButton>
        </form>
      </div>
      )}
    </div>
  );
}
