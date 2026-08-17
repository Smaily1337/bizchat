import { type FormEvent, useEffect, useState } from "react";
import { businessApi, knowledgeApi, servicesApi } from "@/api";
import type { KnowledgeItem, LicenseUsage, Service } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassTextarea } from "@/components/ui/GlassInput";

function fmtLimit(used: number, max: number | null) {
  if (max == null) return `${used} / ∞`;
  return `${used} / ${max}`;
}

function usagePct(used: number, max: number | null) {
  if (max == null || max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export function SettingsPage() {
  const { business, refreshBusiness } = useAuth();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
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
    const [s, k, u] = await Promise.all([
      servicesApi.list(),
      knowledgeApi.list(),
      businessApi.usage(),
    ]);
    setServices(s);
    setKnowledge(k);
    setUsage(u);
  }

  useEffect(() => {
    if (business) {
      setName(business.name);
      setTimezone(business.timezone);
    }
  }, [business]);

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  async function saveBusiness(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await businessApi.update({ name, timezone });
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
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Ustawienia</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Salon, licencja, usługi i baza FAQ bota
        </p>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      {usage && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">
            Licencja i limity
          </p>
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
                className="rounded-xl border border-glass-border bg-glass-fill px-3 py-3"
              >
                <p className="text-xs text-[var(--muted)]">{row.label}</p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {fmtLimit(row.used, row.max)}
                </p>
                {row.max != null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-canary/80"
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
        </GlassCard>
      )}

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Biznes</p>
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
          <GlassButton type="submit" className="sm:w-fit">
            Zapisz
          </GlassButton>
        </form>
      </GlassCard>

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Usługi</p>
        <ul className="mt-3 space-y-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-glass-border bg-glass-fill px-3 py-2 text-sm"
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

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">FAQ / baza wiedzy</p>
        <ul className="mt-3 space-y-2">
          {knowledge.map((k) => (
            <li
              key={k.id}
              className="rounded-xl border border-glass-border bg-glass-fill px-3 py-2 text-sm"
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
    </div>
  );
}
