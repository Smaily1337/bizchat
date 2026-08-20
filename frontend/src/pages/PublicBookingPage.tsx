import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { publicBookingApi } from "@/api";
import { GlassButton } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

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
  const [loadingSlots, setLoadingSlots] = useState(false);

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
    setLoadingSlots(true);
    publicBookingApi
      .availability(key, form.service_id, day, form.staff_id || undefined)
      .then((r) => setSlots(r.slots.map((s) => s.start_at)))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [key, form.service_id, form.staff_id, day]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === form.service_id),
    [services, form.service_id],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.start_at) {
      setError("Wybierz godzinę wizyty");
      return;
    }
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
    <div className="min-h-screen py-10 px-4 sm:px-6 relative overflow-hidden">
      {/* Glow backgrounds */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--primary)]/10 blur-[130px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--secondary)]/10 blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Salon Header */}
        <header className="text-center space-y-2 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-container)] border border-glass-border text-xs text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Rezerwacja online 24/7
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-bright)]">
            {bizName}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)]">
            Wybierz usługę, dogodny termin i zarezerwuj wizytę
            {depositPct > 0 ? ` (wymagana zaliczka ${depositPct}%)` : ""}.
          </p>
        </header>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2 animate-fade-up">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {msg && (
          <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs flex items-center gap-2 animate-fade-up">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{msg}</span>
          </div>
        )}

        {checkout && (
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs flex items-center gap-2 animate-fade-up">
            <span className="material-symbols-outlined text-base animate-spin">refresh</span>
            <span>Przekierowywanie do bramki płatności Stripe…</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 border border-glass-border animate-fade-up">
          {/* Step 1: Usługa */}
          <div className="space-y-3">
            <h2 className="font-display text-sm font-bold text-[var(--text-bright)] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--primary-container)] text-white text-[11px] flex items-center justify-center font-bold">1</span>
              Wybierz usługę
            </h2>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {services.map((s) => {
                const sel = form.service_id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm({ ...form, service_id: s.id, start_at: "" })}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                      sel
                        ? "border-[var(--primary)] bg-[var(--primary-container)]/10 shadow-md ring-1 ring-[var(--primary)]"
                        : "border-glass-border bg-[var(--surface-container)] hover:border-white/20"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-xs text-[var(--text-bright)]">{s.name}</p>
                      {s.description && (
                        <p className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-1">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-glass-border">
                      <span className="text-[var(--muted)]">{s.duration_min} min</span>
                      <span className="font-bold text-[var(--accent)] font-mono">{s.price} zł</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Specjalista (jeśli dostępny) */}
          {staff.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-glass-border">
              <h2 className="font-display text-sm font-bold text-[var(--text-bright)] uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--primary-container)] text-white text-[11px] flex items-center justify-center font-bold">2</span>
                Wybierz specjalistę
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, staff_id: "", start_at: "" })}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    !form.staff_id
                      ? "border-[var(--primary)] bg-[var(--primary-container)]/20 text-[var(--text-bright)]"
                      : "border-glass-border bg-[var(--surface-container)] text-[var(--muted)] hover:text-[var(--text-bright)]"
                  }`}
                >
                  Dowolny specjalista
                </button>
                {staff.map((st) => {
                  const sel = form.staff_id === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setForm({ ...form, staff_id: st.id, start_at: "" })}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        sel
                          ? "border-[var(--primary)] bg-[var(--primary-container)]/20 text-[var(--text-bright)]"
                          : "border-glass-border bg-[var(--surface-container)] text-[var(--muted)] hover:text-[var(--text-bright)]"
                      }`}
                    >
                      {st.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Dzień i Godzina */}
          <div className="space-y-3 pt-2 border-t border-glass-border">
            <h2 className="font-display text-sm font-bold text-[var(--text-bright)] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--primary-container)] text-white text-[11px] flex items-center justify-center font-bold">
                {staff.length > 0 ? "3" : "2"}
              </span>
              Termin i godzina
            </h2>

            <div className="grid sm:grid-cols-2 gap-3 items-end">
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Dzień wizyty</span>
                <GlassInput
                  type="date"
                  value={day}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setDay(e.target.value);
                    setForm({ ...form, start_at: "" });
                  }}
                  required
                />
              </label>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-[var(--muted)] mb-2">
                Dostępne godziny w wybranym dniu:
              </p>
              {loadingSlots ? (
                <p className="text-xs text-[var(--muted)] py-3 animate-pulse">Sprawdzanie wolnych terminów...</p>
              ) : slots.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-glass-border text-center text-xs text-[var(--muted)]">
                  Brak wolnych terminów w tym dniu. Wybierz inną datę.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {slots.map((s) => {
                    const sel = form.start_at === s;
                    const timeLabel = new Date(s).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, start_at: s })}
                        className={`py-2 px-1 rounded-lg text-xs font-semibold font-mono border transition-all text-center ${
                          sel
                            ? "bg-[var(--primary-container)] text-white border-[var(--primary)] shadow"
                            : "bg-[var(--surface-container)] border-glass-border text-[var(--text-bright)] hover:border-white/20"
                        }`}
                      >
                        {timeLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Dane klienta */}
          <div className="space-y-3 pt-2 border-t border-glass-border">
            <h2 className="font-display text-sm font-bold text-[var(--text-bright)] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--primary-container)] text-white text-[11px] flex items-center justify-center font-bold">
                {staff.length > 0 ? "4" : "3"}
              </span>
              Twoje dane kontaktowe
            </h2>

            <div className="space-y-3">
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Imię i nazwisko *</span>
                <GlassInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="np. Karolina Wiśniewska"
                  required
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Numer telefonu</span>
                  <GlassInput
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+48 600 000 000"
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Adres e-mail</span>
                  <GlassInput
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="klient@poczta.pl"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Summary & Submit */}
          <div className="pt-4 border-t border-glass-border space-y-4">
            {selectedService && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container)] border border-glass-border text-xs">
                <div>
                  <p className="font-bold text-sm text-[var(--text-bright)]">{selectedService.name}</p>
                  <p className="text-[var(--muted)] mt-0.5">
                    {form.start_at
                      ? `Termin: ${new Date(form.start_at).toLocaleString("pl-PL", {
                          dateStyle: "long",
                          timeStyle: "short",
                        })}`
                      : "Wybierz godzinę powyżej"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-[var(--accent)] font-mono">
                    {selectedService.price} zł
                  </p>
                  {depositPct > 0 && (
                    <p className="text-[11px] text-[var(--muted)]">
                      Zaliczka: {Math.round((Number(selectedService.price) * depositPct) / 100)} zł
                    </p>
                  )}
                </div>
              </div>
            )}

            <GlassButton
              type="submit"
              variant="primary"
              className="w-full !py-3.5 text-sm"
              disabled={!form.start_at || !form.name.trim()}
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              {depositPct > 0 ? "Przejdź do opłacenia zaliczki" : "Potwierdź rezerwację"}
            </GlassButton>
          </div>
        </form>
      </div>
    </div>
  );
}

