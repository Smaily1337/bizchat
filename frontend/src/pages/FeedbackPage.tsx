import { type FormEvent, useEffect, useState } from "react";
import { appointmentsApi, feedbackApi, waitlistApi } from "@/api";
import type { Appointment, Feedback, WaitlistEntry } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

export function FeedbackPage() {
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
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Feedback i kolejka</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Opinie po wizycie (alerty ≤2) oraz lista oczekujących FIFO
          </p>
        </div>
        <GlassButton
          variant={alertsOnly ? "primary" : "subtle"}
          onClick={() => {
            const next = !alertsOnly;
            setAlertsOnly(next);
            void reload(next);
          }}
        >
          {alertsOnly ? "Tylko alerty" : "Wszystkie opinie"}
        </GlassButton>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Dodaj opinię</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={onSubmit}>
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
                  new Date(a.start_at).toLocaleString("pl-PL")}
              </option>
            ))}
          </GlassSelect>
          <GlassSelect
            value={form.score}
            onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                Ocena {n}
              </option>
            ))}
          </GlassSelect>
          <GlassButton type="submit">Zapisz opinię</GlassButton>
          <GlassTextarea
            className="sm:col-span-3"
            placeholder="Komentarz (opcjonalnie)"
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          />
        </form>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="animate-fade-up space-y-3">
          <p className="font-display text-lg font-semibold">Opinie</p>
          {items.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Brak opinii.</p>
          )}
          {items.map((f) => (
            <div
              key={f.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <p className="font-medium">
                {f.score}/5 · {f.customer_name || "Klient"} ·{" "}
                <span
                  className={
                    f.routed_to === "alert" ? "text-[var(--danger)]" : "text-[var(--text)]"
                  }
                >
                  {f.routed_to}
                </span>
              </p>
              {f.comment && (
                <p className="mt-1 text-[var(--muted)]">{f.comment}</p>
              )}
            </div>
          ))}
        </GlassCard>

        <GlassCard className="animate-fade-up space-y-3">
          <p className="font-display text-lg font-semibold">Lista oczekujących</p>
          {waitlist.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Kolejka pusta.</p>
          )}
          {waitlist.map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {w.customer_name || "Klient"} · {w.service_name || "Usługa"}
                </p>
                <p className="text-xs text-[var(--muted)]">{w.status}</p>
              </div>
              <div className="flex gap-2">
                {w.status === "active" && (
                  <GlassButton
                    variant="subtle"
                    className="!py-1 !px-3"
                    onClick={() => void waitlistApi.notify(w.id).then(() => reload())}
                  >
                    Powiadom
                  </GlassButton>
                )}
                <GlassButton
                  variant="ghost"
                  className="!py-1 !px-3"
                  onClick={() => void waitlistApi.cancel(w.id).then(() => reload())}
                >
                  Usuń
                </GlassButton>
              </div>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}
