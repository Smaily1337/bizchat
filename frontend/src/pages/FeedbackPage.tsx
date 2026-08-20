import { type FormEvent, useEffect, useState } from "react";
import { appointmentsApi, feedbackApi, waitlistApi } from "@/api";
import type { Appointment, Feedback, WaitlistEntry } from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton } from "@/components/ui";
import { GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

export function FeedbackPage() {
  const { push } = useToast();
  const [items, setItems] = useState<Feedback[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [form, setForm] = useState({
    appointment_id: "",
    score: "5",
    comment: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function reload(alerts = alertsOnly) {
    const [f, w, a] = await Promise.all([
      feedbackApi.list(alerts),
      waitlistApi.list(),
      appointmentsApi.list(),
    ]);
    setItems(f);
    setWaitlist(w);
    setAppointments(a.filter((x) => x.status !== "cancelled"));
    if (!form.appointment_id && a[0]) {
      setForm((prev) => ({ ...prev, appointment_id: a[0].id }));
    }
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await feedbackApi.create({
        appointment_id: form.appointment_id,
        score: Number(form.score),
        comment: form.comment || undefined,
      });
      setForm((f) => ({ ...f, comment: "", score: "5" }));
      push({
        title: "Dodano opinię",
        message: "Opinia została pomyślnie zapisana",
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania opinii");
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">reviews</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Opinie i Lista oczekujących
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Zadowolenie klientów (CSAT/NPS) oraz automatyczna kolejka FIFO
            </p>
          </div>
        </div>

        <GlassButton
          variant={alertsOnly ? "primary" : "ghost"}
          onClick={() => {
            const next = !alertsOnly;
            setAlertsOnly(next);
            void reload(next);
          }}
        >
          <span className="material-symbols-outlined text-[18px]">
            {alertsOnly ? "filter_alt" : "filter_alt_off"}
          </span>
          {alertsOnly ? "Pokazuj tylko alerty (≤2★)" : "Wszystkie opinie"}
        </GlassButton>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Add Feedback Form */}
      <section className="glass-panel rounded-xl p-6 shadow-2xl space-y-4">
        <h2 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">
            rate_review
          </span>
          Wprowadź opinię klienta po wizycie
        </h2>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={onSubmit}>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Wizyta</span>
            <GlassSelect
              value={form.appointment_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, appointment_id: e.target.value }))
              }
              required
            >
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.customer_name || "Klient") +
                    " · " +
                    new Date(a.start_at).toLocaleString("pl-PL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                </option>
              ))}
            </GlassSelect>
          </label>

          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Ocena gwiazdkowa</span>
            <GlassSelect
              value={form.score}
              onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n}/5)
                </option>
              ))}
            </GlassSelect>
          </label>

          <div className="flex items-end">
            <GlassButton type="submit" variant="primary" className="w-full">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Zapisz opinię
            </GlassButton>
          </div>

          <label className="block sm:col-span-3 space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Treść komentarza (opcjonalnie)</span>
            <GlassTextarea
              placeholder="np. Klient bardzo zadowolony z koloryzacji, chwalił obsługę..."
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              rows={2}
            />
          </label>
        </form>
      </section>

      {/* 2-Columns: Reviews list & Waitlist */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reviews List */}
        <section className="glass-panel rounded-xl p-6 shadow-2xl space-y-4">
          <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400 text-[20px]">
                star
              </span>
              Otrzymane opinie ({items.length})
            </span>
          </h3>

          {items.length === 0 ? (
            <p className="text-xs text-[var(--muted)] py-6 text-center">Brak zapisanych opinii.</p>
          ) : (
            <div className="space-y-3">
              {items.map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-glass-border bg-[var(--surface-container)] p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-bold text-sm">
                        {"★".repeat(f.score)}
                      </span>
                      <span className="font-semibold text-xs text-[var(--text-bright)]">
                        {f.customer_name || "Klient"}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.routed_to === "alert"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-green-500/10 text-green-400 border border-green-500/20"
                      }`}
                    >
                      {f.routed_to === "alert" ? "ALERT" : "STANDARD"}
                    </span>
                  </div>
                  {f.comment && (
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      {f.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Waitlist List */}
        <section className="glass-panel rounded-xl p-6 shadow-2xl space-y-4">
          <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--secondary)] text-[20px]">
                hourglass_top
              </span>
              Lista oczekujących FIFO ({waitlist.length})
            </span>
          </h3>

          {waitlist.length === 0 ? (
            <p className="text-xs text-[var(--muted)] py-6 text-center">Kolejka oczekujących jest pusta.</p>
          ) : (
            <div className="space-y-3">
              {waitlist.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-glass-border bg-[var(--surface-container)] p-4"
                >
                  <div>
                    <p className="font-semibold text-xs text-[var(--text-bright)]">
                      {w.customer_name || "Klient"} · {w.service_name || "Usługa"}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">Status: {w.status}</p>
                  </div>
                  <div className="flex gap-2">
                    {w.status === "active" && (
                      <GlassButton
                        type="button"
                        variant="primary"
                        className="!py-1.5 !px-3 !text-xs"
                        onClick={() =>
                          void waitlistApi.notify(w.id).then(() => {
                            push({
                              title: "Wysłano powiadomienie",
                              message: "Klient z listy został poinformowany o wolnym terminie",
                              tone: "canary",
                            });
                            void reload();
                          })
                        }
                      >
                        Powiadom
                      </GlassButton>
                    )}
                    <GlassButton
                      type="button"
                      variant="ghost"
                      className="!py-1.5 !px-3 !text-xs text-red-400"
                      onClick={() =>
                        void waitlistApi.cancel(w.id).then(() => {
                          push({
                            title: "Usunięto z kolejki",
                            message: "Wpis został anulowany",
                            tone: "canary",
                          });
                          void reload();
                        })
                      }
                    >
                      Usuń
                    </GlassButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

