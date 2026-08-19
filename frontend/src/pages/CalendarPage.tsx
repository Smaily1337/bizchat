import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appointmentsApi, customersApi, dashboardApi } from "@/api";
import type { Appointment, Customer, DashboardAnalytics } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";

type CalendarView = "day" | "week";

type CalEvent = {
  id: string;
  title: string;
  client: string;
  customerId: string;
  dayIndex: number;
  startHour: number;
  durationHours: number;
  tone: "canary" | "muted";
  status: string;
  startAt: string;
  endAt: string;
};

const DEFAULT_FIRST = 8;
const DEFAULT_LAST = 18;
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
        customerId: a.customer_id,
        dayIndex,
        startHour,
        durationHours,
        tone: a.status === "confirmed" ? ("canary" as const) : ("muted" as const),
        status: a.status,
        startAt: a.start_at,
        endAt: a.end_at,
      };
    })
    .filter(Boolean) as CalEvent[];
}

const STATUS_PL: Record<string, string> = {
  pending: "Oczekuje",
  confirmed: "Potwierdzona",
  completed: "Zakończona",
  no_show: "Nieobecność",
};

export function CalendarPage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dayOffset, setDayOffset] = useState(() => (new Date().getDay() + 6) % 7);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
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
    void appointmentsApi
      .list({ from_at: from, to_at: to })
      .then((list) => {
        setAppointments(list);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));

    void customersApi.list().then(setCustomers).catch(() => undefined);

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

  const { firstHour, lastHour } = useMemo(() => {
    let first = DEFAULT_FIRST;
    let last = DEFAULT_LAST;
    for (const e of events) {
      first = Math.min(first, Math.floor(e.startHour));
      last = Math.max(last, Math.ceil(e.startHour + e.durationHours));
    }
    return { firstHour: first, lastHour: last };
  }, [events]);

  const hours = useMemo(
    () => Array.from({ length: lastHour - firstHour }, (_, i) => i + firstHour),
    [firstHour, lastHour],
  );
  const totalHours = lastHour - firstHour;

  const visibleDays = view === "week" ? WEEKDAYS : [WEEKDAYS[dayOffset]];
  const nextAppt = appointments
    .filter(
      (a) =>
        a.status !== "cancelled" && new Date(a.start_at).getTime() >= Date.now(),
    )
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )[0];

  const selectedCustomer = selectedEvent
    ? customers.find((c) => c.id === selectedEvent.customerId) ?? null
    : null;

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

  const HOUR_HEIGHT = 72;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-display-lg-mobile lg:text-display-lg text-on-surface capitalize">
            {new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(
              view === "week" ? weekStart : dayDate,
            )}
          </h1>
          <p className="mt-2 text-on-surface-variant">
            {events.length} wizyt w {view === "week" ? "tym tygodniu" : "tym dniu"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-white/10 bg-surface-container/60 backdrop-blur-xl p-1">
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === "day" ? "bg-white/10 text-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
              onClick={() => setView("day")}
            >
              Dzień
            </button>
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === "week" ? "bg-white/10 text-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
              onClick={() => setView("week")}
            >
              Tydzień
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setWeekStart(startOfWeek(new Date()));
                setDayOffset((new Date().getDay() + 6) % 7);
              }}
              className="glass-card px-4 py-2 rounded-lg text-on-surface text-sm hover:border-white/20 hover:shadow-glow transition-all"
            >
              Dzisiaj
            </button>
            <button
              onClick={() => shift(-1)}
              className="glass-card px-3 py-2 rounded-lg text-on-surface hover:border-white/20 hover:shadow-glow transition-all flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xl leading-none">chevron_left</span>
            </button>
            <button
              onClick={() => shift(1)}
              className="glass-card px-3 py-2 rounded-lg text-on-surface hover:border-white/20 hover:shadow-glow transition-all flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xl leading-none">chevron_right</span>
            </button>
          </div>

          <Link to="/appointments">
            <button className="rounded-lg bg-[linear-gradient(135deg,#8083ff,#494bd6)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-2 shadow-glow">
              <span className="material-symbols-outlined text-sm">add</span>
              Nowa wizyta
            </button>
          </Link>
        </div>
      </header>

      {error && (
        <p className="text-sm text-error">Błąd: {error}</p>
      )}

      <div className="animate-fade-up grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar Grid */}
        <div className="glass-panel rounded-[28px] p-6 lg:p-8">
          <div className={`grid ${view === "week" ? "grid-cols-7" : "grid-cols-1"} gap-2 lg:gap-4`}>
            {/* Day headers */}
            {visibleDays.map((day) => (
              <div key={`header-${day}`} className="text-center pb-2">
                <span className="font-label-caps text-label-caps text-on-surface-variant/70 uppercase">
                  {day}
                </span>
              </div>
            ))}

            {/* Day cells */}
            {visibleDays.map((day, i) => {
              const dayIdx = view === "week" ? i : 0;
              const d = view === "week" ? addDays(weekStart, i) : dayDate;
              const isToday = d.toDateString() === new Date().toDateString();
              const colEvents = events.filter((e) => e.dayIndex === dayIdx);
              const isOtherMonth = d.getMonth() !== (view === "week" ? weekStart.getMonth() : dayDate.getMonth());

              return (
                <div
                  key={`cell-${day}-${i}`}
                  className={`glass-card rounded-xl lg:aspect-square p-3 flex flex-col gap-2 transition-all ${
                    isToday
                      ? "border-primary/50 shadow-[0_0_15px_rgba(192,193,255,0.2)] bg-primary/5 relative"
                      : "border-white/10 hover:border-white/20"
                  } ${isOtherMonth ? "opacity-50" : ""}`}
                >
                  {isToday && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                  <div className="text-right">
                    <span className={`font-data-mono text-data-mono ${isToday ? "text-primary font-bold" : "text-on-surface"}`}>
                      {d.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                    {colEvents.map((event) => (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`w-full text-left bg-gradient-to-r from-primary-container to-tertiary-container rounded px-2 py-1.5 text-[10px] font-medium text-white truncate hover:opacity-90 transition-all shadow-sm ${
                          selectedEvent?.id === event.id ? "ring-2 ring-white/50 scale-[1.02]" : ""
                        }`}
                      >
                        <div className="font-data-mono opacity-80 mb-0.5">{formatHour(event.startHour)}</div>
                        <div className="truncate">{event.title}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Event detail panel */}
          {selectedEvent && (
            <div className="glass-panel rounded-[28px] p-6 animate-fade-up border-primary/30">
              <div className="flex items-start justify-between">
                <p className="font-display text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-fixed to-tertiary-container">
                  {selectedEvent.title}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="mt-2 text-sm font-medium text-on-surface">
                {selectedEvent.client}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                <span>
                  {new Date(selectedEvent.startAt).toLocaleString("pl-PL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {" – "}
                  {new Date(selectedEvent.endAt).toLocaleString("pl-PL", {
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">info</span>
                <span>Status: {STATUS_PL[selectedEvent.status] ?? selectedEvent.status}</span>
              </div>

              {selectedCustomer && (
                <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-surface-container/30 p-4 text-sm">
                  <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                    Dane kontaktowe
                  </p>
                  {selectedCustomer.phone && (
                    <p className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">call</span>
                      <a href={`tel:${selectedCustomer.phone}`} className="text-secondary hover:underline">
                        {selectedCustomer.phone}
                      </a>
                    </p>
                  )}
                  {selectedCustomer.email && (
                    <p className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">mail</span>
                      <a href={`mailto:${selectedCustomer.email}`} className="text-secondary hover:underline">
                        {selectedCustomer.email}
                      </a>
                    </p>
                  )}
                  {!selectedCustomer.phone && !selectedCustomer.email && (
                    <p className="text-on-surface-variant text-xs">Brak danych kontaktowych</p>
                  )}
                </div>
              )}

              <div className="mt-6 grid gap-2">
                <button
                  className="w-full rounded-lg bg-[linear-gradient(135deg,#8083ff,#494bd6)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity shadow-glow"
                  onClick={() => navigate(`/appointments?edit=${selectedEvent.id}`)}
                >
                  Przełóż wizytę
                </button>
                <button
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-on-surface hover:bg-white/10 transition-colors"
                  onClick={() => navigate(`/notifications/send?appointment=${selectedEvent.id}`)}
                >
                  Powiadom klienta
                </button>
                <button
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-on-surface hover:bg-white/10 transition-colors"
                  onClick={() => navigate(`/inbox?compose=1&customer=${selectedEvent.customerId}`)}
                >
                  Napisz wiadomość
                </button>
              </div>
            </div>
          )}

          <div className="glass-panel rounded-[28px] p-6">
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Dzisiejsze wizyty
            </p>
            <p className="mt-2 font-kpi-stat text-kpi-stat text-on-surface flex items-baseline gap-2">
              {summary.appointments_today} <span className="text-body-md text-on-surface-variant">wizyt</span>
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {summary.pending_count} oczekuje · {summary.customers_total} klientów
            </p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-on-surface-variant flex justify-between">
                <span>Anulowane (7d):</span>
                <span className="font-data-mono text-on-surface">{summary.cancelled_7d}</span>
              </p>
              <p className="text-xs text-on-surface-variant flex justify-between mt-1">
                <span>No-show (7d):</span>
                <span className="font-data-mono text-on-surface">{summary.no_show_7d}</span>
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-6 bg-gradient-to-br from-surface-container to-primary/5">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                  Luki w grafiku (Dziś)
                </p>
                <p className="font-kpi-stat text-[32px] font-medium text-secondary">
                  {analytics?.gaps_today ?? "0"}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  szacowane wolne sloty (9–17)
                </p>
              </div>
              <span className="material-symbols-outlined text-primary text-3xl opacity-50">event_available</span>
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-6">
            <p className="mb-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
              Następna wizyta
            </p>
            {nextAppt ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-on-surface">
                    {nextAppt.service_name || "Wizyta"}
                  </p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {nextAppt.customer_name || "Klient"}
                  </p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {new Date(nextAppt.start_at).toLocaleString("pl-PL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <Link to="/appointments" className="block">
                  <button className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-on-surface hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">list</span>
                    Lista wizyt
                  </button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant italic">Brak nadchodzących wizyt</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
