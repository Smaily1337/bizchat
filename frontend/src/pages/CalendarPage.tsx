import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { appointmentsApi, dashboardApi } from "@/api";
import type { Appointment, DashboardAnalytics } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";

type CalendarView = "day" | "week";

type CalEvent = {
  id: string;
  title: string;
  client: string;
  dayIndex: number;
  startHour: number;
  durationHours: number;
  tone: "canary" | "muted";
  status: string;
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
const WEEKDAYS = ["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatHour(hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatRangeLabel(anchor: Date, view: CalendarView) {
  const fmt = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (view === "day") {
    const weekday = new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(
      anchor,
    );
    return `${weekday}, ${fmt.format(anchor)}`;
  }
  const end = addDays(anchor, 6);
  return `${fmt.format(anchor)} – ${fmt.format(end)}`;
}

function toEvents(
  appointments: Appointment[],
  rangeStart: Date,
  view: CalendarView,
  dayOffset: number,
): CalEvent[] {
  return appointments
    .filter((a) => a.status !== "cancelled")
    .map((a) => {
      const start = new Date(a.start_at);
      const end = new Date(a.end_at);
      const dayIndex =
        view === "week"
          ? Math.floor((start.getTime() - rangeStart.getTime()) / 86400000)
          : 0;
      if (view === "week" && (dayIndex < 0 || dayIndex > 6)) return null;
      if (view === "day") {
        const day = addDays(rangeStart, dayOffset);
        if (start.toDateString() !== day.toDateString()) return null;
      }
      const startHour = start.getHours() + start.getMinutes() / 60;
      const durationHours = Math.max(
        0.5,
        (end.getTime() - start.getTime()) / 3600000,
      );
      return {
        id: a.id,
        title: a.service_name || "Wizyta",
        client: a.customer_name || "Klient",
        dayIndex,
        startHour,
        durationHours,
        tone: a.status === "confirmed" ? ("canary" as const) : ("muted" as const),
        status: a.status,
      };
    })
    .filter(Boolean) as CalEvent[];
}

export function CalendarPage() {
  const { business } = useAuth();
  const [view, setView] = useState<CalendarView>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dayOffset, setDayOffset] = useState(() => (new Date().getDay() + 6) % 7);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [summary, setSummary] = useState({
    appointments_today: 0,
    pending_count: 0,
    customers_total: 0,
    cancelled_7d: 0,
    no_show_7d: 0,
    alerts_open: 0,
    avg_score: null as number | null,
  });
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeStart = weekStart;
  const dayDate = addDays(weekStart, dayOffset);

  useEffect(() => {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    // Load calendar appointments independently so a charts API failure
    // never blanks the whole schedule ("Load failed").
    void appointmentsApi
      .list({ from_at: from, to_at: to })
      .then((list) => {
        setAppointments(list);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));

    void dashboardApi
      .summary()
      .then((sum) => {
        setSummary({
          appointments_today: sum.appointments_today,
          pending_count: sum.pending_count,
          customers_total: sum.customers_total,
          cancelled_7d: sum.cancelled_7d ?? 0,
          no_show_7d: sum.no_show_7d ?? 0,
          alerts_open: sum.alerts_open ?? 0,
          avg_score: sum.avg_score ?? null,
        });
      })
      .catch(() => undefined);

    void dashboardApi
      .analytics(7)
      .then((anal) => setAnalytics(anal))
      .catch(() => undefined);
  }, [weekStart]);

  const events = useMemo(
    () => toEvents(appointments, rangeStart, view, dayOffset),
    [appointments, rangeStart, view, dayOffset],
  );

  const visibleDays = view === "week" ? WEEKDAYS : [WEEKDAYS[dayOffset]];
  const nextAppt = appointments
    .filter(
      (a) =>
        a.status !== "cancelled" && new Date(a.start_at).getTime() >= Date.now(),
    )
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )[0];

  function shift(dir: -1 | 1) {
    if (view === "week") {
      setWeekStart((w) => addDays(w, dir * 7));
    } else {
      setDayOffset((o) => {
        const n = o + dir;
        if (n < 0) {
          setWeekStart((w) => addDays(w, -7));
          return 6;
        }
        if (n > 6) {
          setWeekStart((w) => addDays(w, 7));
          return 0;
        }
        return n;
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-bright)]">
            Kalendarz
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {business?.name || "Salon"} · {business?.timezone || "Europe/Warsaw"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-control border border-glass-border p-1">
            <GlassButton
              variant={view === "day" ? "primary" : "ghost"}
              className="!rounded-control !px-3 !py-1.5"
              onClick={() => setView("day")}
            >
              Dzień
            </GlassButton>
            <GlassButton
              variant={view === "week" ? "primary" : "ghost"}
              className="!rounded-control !px-3 !py-1.5"
              onClick={() => setView("week")}
            >
              Tydzień
            </GlassButton>
          </div>
          <Link to="/appointments">
            <GlassButton>+ Nowa wizyta</GlassButton>
          </Link>
        </div>
      </section>

      {error && (
        <p className="text-sm text-[var(--danger)]">Błąd: {error}</p>
      )}

      <div
        className="animate-fade-up grid gap-4 lg:grid-cols-[1fr_260px]"
      >
        <GlassCard padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-glass-border px-5 py-4">
            <div>
              <p className="font-display text-lg font-semibold">
                {formatRangeLabel(view === "week" ? weekStart : dayDate, view)}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {events.length} wizyt w widoku
              </p>
            </div>
            <div className="flex gap-2">
              <GlassButton
                variant="ghost"
                className="!px-3 !py-1.5"
                onClick={() => shift(-1)}
              >
                ←
              </GlassButton>
              <GlassButton
                variant="ghost"
                className="!px-3 !py-1.5"
                onClick={() => shift(1)}
              >
                →
              </GlassButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div
              className="min-w-[640px] grid"
              style={{
                gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="border-b border-glass-border" />
              {visibleDays.map((day, i) => {
                const d =
                  view === "week"
                    ? addDays(weekStart, WEEKDAYS.indexOf(day))
                    : dayDate;
                return (
                  <div
                    key={`${day}-${i}`}
                    className="border-b border-l border-glass-border px-3 py-3 text-center"
                  >
                    <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                      {day}
                    </p>
                    <p className="mt-1 font-display text-sm font-semibold">
                      {d.getDate()}
                    </p>
                  </div>
                );
              })}

              {HOURS.map((hour) => (
                <HourRow
                  key={hour}
                  hour={hour}
                  dayCount={visibleDays.length}
                  events={events}
                />
              ))}
            </div>
          </div>
        </GlassCard>

        <aside className="space-y-4">
          <GlassCard>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Dziś
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {summary.appointments_today} wizyt
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {summary.pending_count} oczekuje · {summary.customers_total} klientów
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              7d: {summary.cancelled_7d} anul. · {summary.no_show_7d} no-show
              {summary.avg_score != null ? ` · ★ ${summary.avg_score}` : ""}
            </p>
            {summary.alerts_open > 0 && (
              <Link
                to="/feedback"
                className="mt-3 inline-block text-xs text-[var(--danger)]"
              >
                {summary.alerts_open} alertów opinii →
              </Link>
            )}
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-solid)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{
                  width: `${Math.min(100, summary.appointments_today * 12 + 8)}%`,
                }}
              />
            </div>
          </GlassCard>

          <GlassCard>
            <p className="mb-2 font-display text-base font-semibold">
              Luki dziś
            </p>
            <p className="font-display text-3xl font-bold text-canary">
              {analytics?.gaps_today ?? "—"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              szacowane wolne sloty (9–17)
            </p>
          </GlassCard>

          <GlassCard>
            <p className="mb-3 font-display text-base font-semibold">Kanały</p>
            <ul className="space-y-2 text-sm">
              {(
                [
                  ["Messenger", "messenger"],
                  ["Telegram", "telegram"],
                  ["Widget WWW", "widget"],
                ] as const
              ).map(([name, key]) => {
                const enabledList = business?.enabled_channels;
                const on =
                  !enabledList ||
                  enabledList.length === 0 ||
                  enabledList.some(
                    (c) =>
                      c.toLowerCase() === key ||
                      (key === "messenger" &&
                        ["instagram", "meta"].includes(c.toLowerCase())),
                  );
                return (
                  <li
                    key={name}
                    className="flex items-center justify-between rounded-soft border border-glass-border bg-glass-fill px-3 py-2"
                  >
                    <span>{name}</span>
                    <span
                      className={
                        on ? "text-white" : "text-[var(--muted)]"
                      }
                    >
                      {on ? "w planie" : "poza planem"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link to="/channels" className="mt-3 inline-block text-xs text-canary">
              Szczegóły kanałów →
            </Link>
          </GlassCard>

          <GlassCard>
            <p className="mb-2 font-display text-base font-semibold">
              Następna wizyta
            </p>
            {nextAppt ? (
              <>
                <p className="text-sm text-[var(--text-bright)]">
                  {nextAppt.service_name || "Wizyta"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {nextAppt.customer_name || "Klient"} ·{" "}
                  {new Date(nextAppt.start_at).toLocaleString("pl-PL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                <Link to="/appointments">
                  <GlassButton className="mt-4 w-full" variant="primary">
                    Lista wizyt
                  </GlassButton>
                </Link>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Brak nadchodzących wizyt</p>
            )}
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}

function HourRow({
  hour,
  dayCount,
  events,
}: {
  hour: number;
  dayCount: number;
  events: CalEvent[];
}) {
  return (
    <>
      <div className="border-b border-glass-border px-2 py-6 text-right text-xs text-[var(--muted)]">
        {formatHour(hour)}
      </div>
      {Array.from({ length: dayCount }, (_, dayIndex) => {
        const cellEvents = events.filter(
          (e) => e.dayIndex === dayIndex && Math.floor(e.startHour) === hour,
        );
        return (
          <div
            key={`${hour}-${dayIndex}`}
            className="relative min-h-[72px] border-b border-l border-glass-border bg-[var(--bg)] p-1.5"
          >
            {cellEvents.map((event) => (
              <div
                key={event.id}
                className={[
                  "absolute inset-x-1.5 rounded-control border px-2 py-1.5 text-left",
                  event.tone === "canary"
                    ? "border-[var(--accent)] bg-[var(--surface-solid)] text-[var(--text-bright)]"
                    : "border-glass-border bg-[var(--surface-solid)] text-[var(--text-bright)]",
                ].join(" ")}
                style={{
                  top: `${(event.startHour % 1) * 100}%`,
                  height: `calc(${event.durationHours * 100}% - 4px)`,
                  minHeight: "2.5rem",
                }}
              >
                <p className="truncate text-xs font-semibold">{event.title}</p>
                <p className="truncate text-[10px] text-[var(--muted)]">
                  {event.client} · {formatHour(event.startHour)}
                </p>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
