import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { publicBookingApi } from "@/api";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassSelect } from "@/components/ui/GlassInput";

type PubService = {
  id: string;
  name: string;
  duration_min: number;
  price: string | number;
  description: string | null;
};
type PubStaff = { id: string; name: string; color: string | null };

export function PublicBookingPage() {
  const { key = "" } = useParams();
  const [params] = useSearchParams();
  const [bizName, setBizName] = useState("Salon");
  const [depositPct, setDepositPct] = useState(0);
  const [services, setServices] = useState<PubService[]>([]);
  const [staff, setStaff] = useState<PubStaff[]>([]);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [form, setForm] = useState({
    service_id: "",
    staff_id: "",
    start_at: "",
    name: "",
    phone: "",
    email: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("paid") === "1") {
      setMsg("Dziękujemy — zaliczka opłacona, wizyta potwierdzona.");
    }
  }, [params]);

  useEffect(() => {
    if (!key) return;
    void (async () => {
      try {
        const [b, s, st] = await Promise.all([
          publicBookingApi.business(key),
          publicBookingApi.services(key),
          publicBookingApi.staff(key),
        ]);
        setBizName(b.name);
        setDepositPct(b.deposit_percent || 0);
        setServices(s);
        setStaff(st);
        if (s[0]) setForm((f) => ({ ...f, service_id: s[0].id }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie znaleziono salonu");
      }
    })();
  }, [key]);

  useEffect(() => {
    if (!key || !form.service_id || !day) return;
    void publicBookingApi
      .availability(key, form.service_id, day, form.staff_id || undefined)
      .then((r) => setSlots(r.slots.map((s) => s.start_at)))
      .catch(() => setSlots([]));
  }, [key, form.service_id, form.staff_id, day]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === form.service_id),
    [services, form.service_id],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setCheckout(null);
    try {
      const res = await publicBookingApi.book(key, {
        service_id: form.service_id,
        start_at: form.start_at,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        staff_id: form.staff_id || undefined,
      });
      setMsg(res.message);
      if (res.checkout_url) {
        setCheckout(res.checkout_url);
        window.location.href = res.checkout_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd rezerwacji");
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="animate-fade-up text-center">
          <p className="label-caps text-[10px] text-[var(--muted)]">Rezerwacja online</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white">
            {bizName}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Wybierz usługę i wolny termin
            {depositPct > 0 ? ` · zaliczka ${depositPct}%` : ""}.
          </p>
        </header>

        {error && <p className="text-center text-sm text-[var(--danger)]">{error}</p>}
        {msg && <p className="text-center text-sm text-[var(--success)]">{msg}</p>}
        {checkout && (
          <p className="text-center text-xs text-[var(--muted)]">
            Przekierowanie do płatności…
          </p>
        )}

        <GlassCard className="animate-fade-up">
          <form className="space-y-3" onSubmit={onSubmit}>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Usługa</span>
              <GlassSelect
                value={form.service_id}
                onChange={(e) => setForm({ ...form, service_id: e.target.value, start_at: "" })}
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.duration_min} min · {s.price} zł
                  </option>
                ))}
              </GlassSelect>
            </label>
            {staff.length > 0 && (
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Specjalista</span>
                <GlassSelect
                  value={form.staff_id}
                  onChange={(e) =>
                    setForm({ ...form, staff_id: e.target.value, start_at: "" })
                  }
                >
                  <option value="">Bez preferencji</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </GlassSelect>
              </label>
            )}
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Dzień</span>
              <GlassInput
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  setForm({ ...form, start_at: "" });
                }}
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Godzina</span>
              <GlassSelect
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                required
              >
                <option value="">Wybierz…</option>
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {new Date(s).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </option>
                ))}
              </GlassSelect>
            </label>
            {selectedService && (
              <p className="text-xs text-[var(--muted)]">
                {selectedService.description || `${selectedService.duration_min} min`}
              </p>
            )}
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Imię i nazwisko</span>
              <GlassInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Telefon</span>
              <GlassInput
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">E-mail</span>
              <GlassInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <GlassButton type="submit" className="w-full">
              Zarezerwuj
            </GlassButton>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
