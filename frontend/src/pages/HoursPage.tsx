import { type FormEvent, useEffect, useState } from "react";
import { hoursApi } from "@/api";
import type { TimeOff, WorkingHours } from "@/api/types";
import { GlassButton, GlassCard, PageHeader } from "@/components/ui";
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
  // "09:00:00" -> "09:00"
  return t.slice(0, 5);
}

export function HoursPage() {
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
  const [msg, setMsg] = useState<string | null>(null);
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
      setMsg("Zapisano godziny otwarcia");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
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
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon="schedule"
        title="Godziny otwarcia"
        subtitle="Harmonogram tygodnia oraz urlopy / przerwy"
      />

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <GlassCard className="animate-fade-up">
        <form className="space-y-3" onSubmit={saveHours}>
          {days.map((d, idx) => (
            <div
              key={d.weekday}
              className="grid items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
            >
              <p className="font-medium">{DAY_NAMES[d.weekday]}</p>
              <GlassInput
                type="time"
                value={d.start_time}
                disabled={d.closed}
                onChange={(e) => {
                  const next = [...days];
                  next[idx] = { ...d, start_time: e.target.value };
                  setDays(next);
                }}
              />
              <GlassInput
                type="time"
                value={d.end_time}
                disabled={d.closed}
                onChange={(e) => {
                  const next = [...days];
                  next[idx] = { ...d, end_time: e.target.value };
                  setDays(next);
                }}
              />
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={(e) => {
                    const next = [...days];
                    next[idx] = { ...d, closed: e.target.checked };
                    setDays(next);
                  }}
                />
                Zamknięte
              </label>
            </div>
          ))}
          <GlassButton type="submit">Zapisz godziny</GlassButton>
        </form>
      </GlassCard>

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Urlopy / time off</p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-3"
          onSubmit={addTimeOff}
        >
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Od</span>
            <GlassInput
              type="datetime-local"
              value={offForm.start_at}
              onChange={(e) =>
                setOffForm((f) => ({ ...f, start_at: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Do</span>
            <GlassInput
              type="datetime-local"
              value={offForm.end_at}
              onChange={(e) =>
                setOffForm((f) => ({ ...f, end_at: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Powód</span>
            <GlassInput
              value={offForm.reason}
              onChange={(e) =>
                setOffForm((f) => ({ ...f, reason: e.target.value }))
              }
              placeholder="Urlop"
            />
          </label>
          <GlassButton type="submit" className="sm:col-span-3 sm:w-fit">
            Dodaj przerwę
          </GlassButton>
        </form>

        <ul className="mt-5 space-y-2">
          {timeOff.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Brak zapisanych przerw.</li>
          )}
          {timeOff.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <span>
                {new Date(t.start_at).toLocaleString("pl-PL")} –{" "}
                {new Date(t.end_at).toLocaleString("pl-PL")}
                {t.reason ? ` · ${t.reason}` : ""}
              </span>
              <GlassButton
                variant="ghost"
                className="!py-1 !px-3"
                onClick={() =>
                  void hoursApi.removeTimeOff(t.id).then(reload)
                }
              >
                Usuń
              </GlassButton>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
