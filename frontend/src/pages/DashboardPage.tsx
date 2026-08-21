import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appointmentsApi, dashboardApi, notificationsApi } from "@/api";
import type { Appointment, DashboardAnalytics } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { GlassButton, GlassCard } from "@/components/ui";

type CalendarView = "day" | "week";

type CalEvent = {
  id: string;
  appointment: Appointment;
  title: string;
  client: string;
  dayIndex: number;
  startHour: number;
  durationHours: number;
  status: string;
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const HOUR_H = 56;
const WEEKDAYS = ["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekuje",
  confirmed: "Potwierdzona",
  cancelled: "Anulowana",
  completed: "Zakończona",
  no_show: "Nieobecność",
};

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
    const weekday = new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(anchor);
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
      const durationHours = Math.max(0.5, (end.getTime() - start.getTime()) / 3600000);
      return {
        id: a.id,
        appointment: a,
        title: a.service_name || "Wizyta",
        client: a.customer_name || "Klient",
        dayIndex,
        startHour,
        durationHours,
        status: a.status,
      };
    })
    .filter(Boolean) as CalEvent[];
}

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DashboardPage() {
  const { business } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dayOffset, setDayOffset] = useState(() => (new Date().getDay() + 6) % 7);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
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

  const dayDate = addDays(weekStart, dayOffset);

  useEffect(() => {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
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

    void dashboardApi.analytics(7).then(setAnalytics).catch(() => undefined);
  }, [weekStart]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t") {
        const now = new Date();
        setWeekStart(startOfWeek(now));
        setDayOffset((now.getDay() + 6) % 7);
      }
      if (e.key === "ArrowLeft") shift(-1);
      if (e.key === "ArrowRight") shift(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const events = useMemo(
    () => toEvents(appointments, weekStart, view, dayOffset),
    [appointments, weekStart, view, dayOffset],
  );

  const visibleDays = view === "week" ? WEEKDAYS : [WEEKDAYS[dayOffset]];
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nextAppt = appointments
    .filter((a) => a.status !== "cancelled" && new Date(a.start_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

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

  function goToday() {
    const today = new Date();
    setWeekStart(startOfWeek(today));
    setDayOffset((today.getDay() + 6) % 7);
  }

  function openSlot(dayIndex: number, clientY: number, columnTop: number) {
    const hour = 8 + Math.max(0, clientY - columnTop) / HOUR_H;
    const snapped = Math.round(hour * 2) / 2;
    const day = view === "week" ? addDays(weekStart, dayIndex) : dayDate;
    const start = new Date(day);
    start.setHours(Math.floor(snapped), (snapped % 1) * 60, 0, 0);
    navigate(`/appointments?new=1&start=${encodeURIComponent(toLocalInput(start))}`);
  }

  async function setStatus(id: string, status: string) {
    try {
      await appointmentsApi.update(id, { status });
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: status as Appointment["status"] } : a)));
      setSelected((s) => (s && s.id === id ? { ...s, status: status as Appointment["status"] } : s));
    } catch (e) {
      push({
        title: "Nie zapisano statusu",
        message: e instanceof Error ? e.message : "Błąd",
        tone: "danger",
      });
    }
  }

  async function notify(a: Appointment) {
    try {
      const templates = await notificationsApi.templates();
      const reminder =
        templates.find((t) => t.kind === "reminder" && t.is_default) ||
        templates.find((t) => t.kind === "reminder");
      const log = await notificationsApi.send({
        appointment_id: a.id,
        template_id: reminder?.id,
      });
      if (log.status === "failed") {
        push({ title: "Mail/SMS nie wyszedł", message: log.error || log.channel, tone: "danger" });
      } else {
        push({ title: "Przypomnienie wysłane", message: a.customer_name || "Klient", tone: "canary" });
      }
    } catch (e) {
      push({
        title: "Nie udało się wysłać",
        message: e instanceof Error ? e.message : "Błąd",
        tone: "danger",
      });
    }
  }

  const gridHeight = HOURS.length * HOUR_H;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kalendarz</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {business?.name || "Salon"} · {business?.timezone || "Europe/Warsaw"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] p-0.5">
            <GlassButton
              variant={view === "day" ? "primary" : "ghost"}
              className="!rounded-md !border-0 !px-3 !py-1.5"
              onClick={() => setView("day")}
            >
              Dzień
            </GlassButton>
            <GlassButton
              variant={view === "week" ? "primary" : "ghost"}
              className="!rounded-md !border-0 !px-3 !py-1.5"
              onClick={() => setView("week")}
            >
              Tydzień
            </GlassButton>
          </div>
          <GlassButton variant="ghost" onClick={goToday}>
            Dziś
          </GlassButton>
          <Link to="/appointments?new=1">
            <GlassButton>Nowa wizyta</GlassButton>
          </Link>
        </div>
      </section>

      {error && <p className="text-sm text-[var(--danger)]">Błąd: {error}</p>}

      {analytics && <AnalyticsStrip analytics={analytics} summary={summary} />}

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <GlassCard padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {formatRangeLabel(view === "week" ? weekStart : dayDate, view)}
              </p>
              <p className="text-xs text-[var(--muted)]">{events.length} wizyt · ← → tydzień · T = dziś</p>
            </div>
            <div className="flex gap-1">
              <GlassButton variant="ghost" className="!px-2.5 !py-1" onClick={() => shift(-1)}>
                ←
              </GlassButton>
              <GlassButton variant="ghost" className="!px-2.5 !py-1" onClick={() => shift(1)}>
                →
              </GlassButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div
              className="min-w-[720px] grid"
              style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
            >
              <div className="border-b border-[var(--border)]" />
              {visibleDays.map((day, i) => {
                const d = view === "week" ? addDays(weekStart, i) : dayDate;
                const isToday = d.toDateString() === now.toDateString();
                return (
                  <div
                    key={`${day}-${i}`}
                    className={`border-b border-l border-[var(--border)] px-2 py-2 text-center ${isToday ? "bg-[var(--surface-hover)]" : ""}`}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{day}</p>
                    <p className={`mt-0.5 text-sm font-medium ${isToday ? "" : "text-[var(--muted)]"}`}>
                      {d.getDate()}
                    </p>
                  </div>
                );
              })}

              <div>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-[var(--border)] pr-2 text-right text-[11px] text-[var(--muted)]"
                    style={{ height: HOUR_H }}
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>
              {visibleDays.map((_, dayIndex) => (
                <DayColumn
                  key={dayIndex}
                  height={gridHeight}
                  events={events.filter((e) => e.dayIndex === dayIndex)}
                  showNow={
                    (view === "week" ? addDays(weekStart, dayIndex) : dayDate).toDateString() ===
                      now.toDateString() && nowHour >= 8 && nowHour <= 21
                  }
                  nowHour={nowHour}
                  onEmptyClick={(y, top) => openSlot(dayIndex, y, top)}
                  onSelect={(ev) => setSelected(ev.appointment)}
                />
              ))}
            </div>
          </div>
        </GlassCard>

        <aside className="space-y-3">
          {selected ? (
            <GlassCard>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Wizyta
              </p>
              <p className="mt-2 text-sm font-medium">{selected.service_name || "Wizyta"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{selected.customer_name || "Klient"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {new Date(selected.start_at).toLocaleString("pl-PL", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                {" · "}
                {STATUS_LABEL[selected.status] || selected.status}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Link to={`/appointments?edit=${selected.id}`}>
                  <GlassButton className="w-full" variant="subtle">
                    Przełóż / edytuj
                  </GlassButton>
                </Link>
                <GlassButton variant="subtle" onClick={() => void notify(selected)}>
                  Powiadom klienta
                </GlassButton>
                <Link to={`/inbox`}>
                  <GlassButton variant="ghost" className="w-full">
                    Inbox
                  </GlassButton>
                </Link>
                {selected.status !== "completed" && selected.status !== "cancelled" ? (
                  <GlassButton variant="ghost" onClick={() => void setStatus(selected.id, "completed")}>
                    Oznacz jako zrobione
                  </GlassButton>
                ) : null}
                {selected.status !== "no_show" && selected.status !== "cancelled" ? (
                  <GlassButton variant="ghost" onClick={() => void setStatus(selected.id, "no_show")}>
                    Nieobecność
                  </GlassButton>
                ) : null}
              </div>
            </GlassCard>
          ) : (
            <GlassCard>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Dziś
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{summary.appointments_today}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {summary.pending_count} oczekuje · {summary.customers_total} klientów
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                7 dni: {summary.cancelled_7d} anul. · {summary.no_show_7d} no-show
                {summary.avg_score != null ? ` · ${summary.avg_score}` : ""}
              </p>
              {summary.alerts_open > 0 ? (
                <Link to="/feedback" className="mt-3 inline-block text-xs text-[var(--danger)]">
                  {summary.alerts_open} alertów opinii
                </Link>
              ) : null}
            </GlassCard>
          )}

          <GlassCard>
            <p className="text-sm font-medium">Następna wizyta</p>
            {nextAppt ? (
              <>
                <p className="mt-2 text-sm">{nextAppt.service_name || "Wizyta"}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {nextAppt.customer_name} ·{" "}
                  {new Date(nextAppt.start_at).toLocaleString("pl-PL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">Brak nadchodzących wizyt</p>
            )}
          </GlassCard>

          <GlassCard>
            <p className="text-sm font-medium">Wolne sloty dziś</p>
            <p className="mt-2 text-2xl font-semibold">{analytics?.gaps_today ?? "—"}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Szacunek 9–17. Klik pusty blok w kalendarzu, żeby umówić.</p>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}

function DayColumn({
  height,
  events,
  showNow,
  nowHour,
  onEmptyClick,
  onSelect,
}: {
  height: number;
  events: CalEvent[];
  showNow: boolean;
  nowHour: number;
  onEmptyClick: (clientY: number, top: number) => void;
  onSelect: (event: CalEvent) => void;
}) {
  return (
    <div
      className="relative border-l border-[var(--border)]"
      style={{ height }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-event]")) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onEmptyClick(e.clientY, rect.top);
      }}
    >
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-[var(--border)]"
          style={{ height: HOUR_H }}
        />
      ))}
      {showNow ? (
        <div
          className="pointer-events-none absolute left-0 right-0 z-10 h-px bg-[var(--danger)]"
          style={{ top: (nowHour - 8) * HOUR_H }}
        />
      ) : null}
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          data-event="1"
          onClick={() => onSelect(event)}
          className="absolute left-1 right-1 z-20 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-1.5 py-1 text-left hover:border-[var(--text)]"
          style={{
            top: (event.startHour - 8) * HOUR_H,
            height: Math.max(28, event.durationHours * HOUR_H - 4),
          }}
        >
          <p className="truncate text-[11px] font-medium">{event.title}</p>
          <p className="truncate text-[10px] text-[var(--muted)]">
            {event.client} · {formatHour(event.startHour)}
          </p>
        </button>
      ))}
    </div>
  );
}

function AnalyticsStrip({
  analytics,
  summary,
}: {
  analytics: DashboardAnalytics;
  summary: {
    cancelled_7d: number;
    no_show_7d: number;
    alerts_open: number;
    avg_score: number | null;
  };
}) {
  const maxBar = Math.max(
    1,
    ...analytics.days.map((d) => d.confirmed + d.cancelled + d.no_show + d.completed),
  );
  const maxCh = Math.max(1, ...analytics.by_channel.map((c) => c.count), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium">Wizyty · 7 dni</p>
            <p className="text-xs text-[var(--muted)]">potwierdzone / zakończone / anulacje / no-show</p>
          </div>
          <p className="text-xs text-[var(--muted)]">
            anul. {summary.cancelled_7d} · no-show {summary.no_show_7d}
          </p>
        </div>
        <div className="flex h-32 items-end gap-1.5">
          {analytics.days.map((d) => {
            const total = d.confirmed + d.cancelled + d.no_show + d.completed || 0.15;
            const h = (total / maxBar) * 100;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="relative flex w-full flex-col-reverse overflow-hidden rounded-sm bg-[var(--surface-hover)]"
                  style={{ height: `${Math.max(8, h)}%` }}
                  title={`${d.day}: ${d.confirmed} OK`}
                >
                  <div className="w-full bg-[var(--text)]" style={{ height: `${(d.confirmed / total) * 100}%` }} />
                  <div className="w-full bg-[var(--muted)]" style={{ height: `${(d.completed / total) * 100}%` }} />
                  <div className="w-full opacity-40" style={{ height: `${(d.cancelled / total) * 100}%`, background: "var(--muted)" }} />
                  <div className="w-full bg-[var(--danger)]" style={{ height: `${(d.no_show / total) * 100}%` }} />
                </div>
                <span className="font-mono text-[9px] text-[var(--muted)]">{d.day.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-sm font-medium">Źródła rezerwacji</p>
        <p className="mb-3 text-xs text-[var(--muted)]">
          ostatnie 7 dni
          {analytics.feedback_avg != null ? ` · opinia ${analytics.feedback_avg}` : ""}
        </p>
        <ul className="space-y-2">
          {analytics.by_channel.slice(0, 6).map((ch) => (
            <li key={ch.channel} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 capitalize text-[var(--muted)]">{ch.channel}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <div
                  className="h-full bg-[var(--text)]"
                  style={{ width: `${(ch.count / maxCh) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right font-mono text-xs">{ch.count}</span>
            </li>
          ))}
          {analytics.by_channel.every((c) => c.count === 0) && (
            <li className="text-sm text-[var(--muted)]">Brak danych w okresie</li>
          )}
        </ul>
      </GlassCard>
    </div>
  );
}
