import { type FormEvent, useEffect, useState } from "react";
import { hoursApi } from "@/api";
import type { TimeOff, WorkingHours } from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

const DAY_NAMES = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
];

type DayForm = {
  weekday: number;
  start_time: string;
  end_time: string;
  closed: boolean;
};

function timeToInput(t: string) {
  return t.slice(0, 5);
}

export function HoursPage() {
  const { push } = useToast();
  const [days, setDays] = useState<DayForm[]>(
    DAY_NAMES.map((_, i) => ({
      weekday: i,
      start_time: "09:00",
      end_time: "17:00",
      closed: i >= 5,
    })),
  );
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [offForm, setOffForm] = useState({
    start_at: "",
    end_at: "",
    reason: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [wh, to] = await Promise.all([
      hoursApi.list(),
      hoursApi.listTimeOff(),
    ]);
    const map = new Map(wh.map((h: WorkingHours) => [h.weekday, h]));
    setDays(
      DAY_NAMES.map((_, i) => {
        const row = map.get(i);
        if (!row) {
          return {
            weekday: i,
            start_time: "09:00",
            end_time: "17:00",
            closed: true,
          };
        }
        return {
          weekday: i,
          start_time: timeToInput(row.start_time),
          end_time: timeToInput(row.end_time),
          closed: false,
        };
      }),
    );
    setTimeOff(to);
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  async function saveHours(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await hoursApi.replace(
        days.map((d) => ({
          weekday: d.weekday,
          start_time: d.start_time.length === 5 ? `${d.start_time}:00` : d.start_time,
          end_time: d.end_time.length === 5 ? `${d.end_time}:00` : d.end_time,
          closed: d.closed,
        })),
      );
      push({
        title: "Zapisano godziny",
        message: "Grafik tygodniowy został zaktualizowany",
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu godzin");
    }
  }

  async function addTimeOff(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await hoursApi.createTimeOff({
        start_at: new Date(offForm.start_at).toISOString(),
        end_at: new Date(offForm.end_at).toISOString(),
        reason: offForm.reason || null,
      });
      setOffForm({ start_at: "", end_at: "", reason: "" });
      push({
        title: "Dodano przerwę",
        message: "Nowa przerwa/urlop została zapisana",
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania przerwy");
    }
  }

  async function removeTimeOff(id: string) {
    try {
      await hoursApi.removeTimeOff(id);
      push({
        title: "Usunięto przerwę",
        message: "Przerwa została usunięta z grafiku",
        tone: "canary",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">schedule</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Godziny pracy
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Domyślny grafik tygodniowy salonu oraz planowane urlopy i przerwy
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Weekly Schedule Form */}
        <section className="lg:col-span-7 glass-panel rounded-xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-glass-border pb-3">
            <h2 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">
                calendar_view_week
              </span>
              Tygodniowy harmonogram otwarcia
            </h2>
          </div>

          <form className="space-y-3" onSubmit={saveHours}>
            {days.map((d, idx) => (
              <div
                key={d.weekday}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  d.closed
                    ? "border-white/5 bg-white/[0.01] opacity-60"
                    : "border-glass-border bg-[var(--surface-container)]"
                }`}
              >
                <div className="flex items-center justify-between sm:w-36">
                  <span className="font-semibold text-sm text-[var(--text-bright)]">
                    {DAY_NAMES[d.weekday]}
                  </span>
                  <label className="sm:hidden flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={d.closed}
                      onChange={(e) => {
                        const next = [...days];
                        next[idx] = { ...d, closed: e.target.checked };
                        setDays(next);
                      }}
                      className="rounded border-glass-border"
                    />
                    Zamknięte
                  </label>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <input
                    type="time"
                    value={d.start_time}
                    disabled={d.closed}
                    onChange={(e) => {
                      const next = [...days];
                      next[idx] = { ...d, start_time: e.target.value };
                      setDays(next);
                    }}
                    className="w-full bg-[var(--surface-solid)] border border-glass-border rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-bright)] disabled:opacity-30 focus:outline-none focus:border-[var(--primary)] font-mono"
                  />
                  <span className="text-[var(--muted)] text-xs">–</span>
                  <input
                    type="time"
                    value={d.end_time}
                    disabled={d.closed}
                    onChange={(e) => {
                      const next = [...days];
                      next[idx] = { ...d, end_time: e.target.value };
                      setDays(next);
                    }}
                    className="w-full bg-[var(--surface-solid)] border border-glass-border rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-bright)] disabled:opacity-30 focus:outline-none focus:border-[var(--primary)] font-mono"
                  />
                </div>

                <label className="hidden sm:flex items-center gap-2 text-xs font-medium text-[var(--muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.closed}
                    onChange={(e) => {
                      const next = [...days];
                      next[idx] = { ...d, closed: e.target.checked };
                      setDays(next);
                    }}
                    className="rounded border-glass-border text-[var(--primary)]"
                  />
                  Zamknięte
                </label>
              </div>
            ))}

            <div className="pt-2">
              <GlassButton type="submit" variant="primary">
                <span className="material-symbols-outlined text-[18px]">save</span>
                Zapisz godziny pracy
              </GlassButton>
            </div>
          </form>
        </section>

        {/* Time Off / Vacations Column */}
        <section className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-xl p-6 shadow-2xl space-y-4">
            <div className="border-b border-glass-border pb-3">
              <h2 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--secondary)] text-[20px]">
                  beach_access
                </span>
                Urlopy i przerwy salonu
              </h2>
            </div>

            <form className="space-y-3" onSubmit={addTimeOff}>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Początek przerwy</span>
                <GlassInput
                  type="datetime-local"
                  value={offForm.start_at}
                  onChange={(e) =>
                    setOffForm((f) => ({ ...f, start_at: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Koniec przerwy</span>
                <GlassInput
                  type="datetime-local"
                  value={offForm.end_at}
                  onChange={(e) =>
                    setOffForm((f) => ({ ...f, end_at: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Powód (opcjonalnie)</span>
                <GlassInput
                  value={offForm.reason}
                  onChange={(e) =>
                    setOffForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  placeholder="np. Urlop właściciela / Remont"
                />
              </label>
              <GlassButton type="submit" variant="primary" className="!w-full">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Dodaj przerwę do grafiku
              </GlassButton>
            </form>
          </div>

          <div className="glass-panel rounded-xl p-6 shadow-2xl space-y-3">
            <h3 className="font-display text-sm font-bold text-[var(--text-bright)]">
              Zaplanowane przerwy ({timeOff.length})
            </h3>
            {timeOff.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-4 text-center">
                Brak zaplanowanych przerw.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {timeOff.map((t) => (
                  <li
                    key={t.id}
                    className="py-3 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-bright)]">
                        {new Date(t.start_at).toLocaleDateString("pl-PL")} –{" "}
                        {new Date(t.end_at).toLocaleDateString("pl-PL")}
                      </p>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">
                        {t.reason || "Brak podanego powodu"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeTimeOff(t.id)}
                      className="p-1 text-[var(--muted)] hover:text-red-400 rounded transition-colors"
                      title="Usuń przerwę"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

