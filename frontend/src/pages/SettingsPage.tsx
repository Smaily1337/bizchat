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
          <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text-bright)] transition-colors">
            <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Wróć do ustawień
          </Link>
        )}
        <div>
          <h1 className="font-display text-3xl font-bold">
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
                      : active === "integrations"
                        ? "Integracje"
                        : "Ustawienia salonu"}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {!active ? "Skonfiguruj system" : "Zarządzaj ustawieniami"}
        </p>
        </div>
      </header>
      )}

      {!active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
          <Link to="/settings/salon" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Salon</p>
              <p className="text-sm text-[var(--muted)]">Podstawowe dane</p>
            </div>
          </Link>
          <Link to="/settings/services" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Usługi</p>
              <p className="text-sm text-[var(--muted)]">Twój cennik</p>
            </div>
          </Link>
          <Link to="/settings/faq" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">FAQ Bota</p>
              <p className="text-sm text-[var(--muted)]">Baza wiedzy AI</p>
            </div>
          </Link>
          <Link to="/settings/plan" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Plan i limity</p>
              <p className="text-sm text-[var(--muted)]">Subskrypcja</p>
            </div>
          </Link>
          <Link to="/settings/appearance" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Wygląd</p>
              <p className="text-sm text-[var(--muted)]">Motyw i widget</p>
            </div>
          </Link>
          <Link to="/settings/integrations" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Integracje</p>
              <p className="text-sm text-[var(--muted)]">Połącz z Meta (Facebook, IG)</p>
            </div>
          </Link>
          <Link to="/settings/account" className="rounded-xl border border-glass-border bg-glass-fill p-5 hover:bg-glass-fill-strong transition-colors flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center text-gray-500 shrink-0">
              <svg aria-hidden viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-bright)]">Konto</p>
              <p className="text-sm text-[var(--muted)]">Twoje dane logowania</p>
            </div>
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      {active === "account" && <AccountPage />}
      {active && !["salon", "services", "faq", "plan", "appearance", "account", "integrations"].includes(active) && (
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

      {active === "integrations" && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">Integracja z Meta (Facebook, Instagram)</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Połącz swoje konta z ekosystemu Meta, aby Automovia mogła zarządzać Twoim kalendarzem i wiadomościami za pomocą jednego przycisku.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-glass-border bg-[var(--surface-solid)] p-8 text-center">
            <svg aria-hidden viewBox="0 0 24 24" className="w-12 h-12 text-blue-600 mb-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            <h3 className="font-semibold text-lg text-[var(--text-bright)]">Połącz z fanpage'em i Instagramem</h3>
            <p className="mt-2 text-sm text-[var(--muted)] max-w-sm mb-6">
              Jednym kliknięciem wybierz swój profil, aby aktywować integrację.
            </p>
            <GlassButton
              type="button"
              onClick={() => {
                setMsg("Inicjowanie połączenia z Meta...");
                setTimeout(() => setMsg("Ukończono! Twój fanpage jest połączony."), 1500);
              }}
              className="!bg-[#1877F2] hover:!bg-[#1877F2]/90 !text-white font-medium"
            >
              Połącz profil z Meta
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
