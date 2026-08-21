import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appointmentsApi, customersApi, dashboardApi, hoursApi, staffApi } from "@/api";
import type { Appointment, Customer, StaffMember, TimeOff, WorkingHours } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { StaffProfileModal } from "@/components/StaffProfileModal";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

type CalendarView = "day" | "week";

type CalEvent = {
  id: string;
  title: string;
  client: string;
  customerId: string;
  staffId?: string | null;
  dayIndex: number;
  startHour: number;
  durationHours: number;
  tone: "canary" | "muted";
  status: string;
  startAt: string;
  endAt: string;
};

type TimeOffCalBlock = {
  id: string;
  dayIndex: number;
  startHour: number;
  durationHours: number;
  reason: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  rawTimeOff: TimeOff;
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
  staffFilter = "all",
): CalEvent[] {
  return appointments
    .filter(
      (a) =>
        a.status !== "cancelled" &&
        (staffFilter === "all" || a.staff_id === staffFilter),
    )
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
        staffId: a.staff_id,
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

function toTimeOffBlocks(
  timeOffList: TimeOff[],
  rangeStart: Date,
  view: CalendarView,
  dayOffset: number,
  firstHour: number,
  lastHour: number,
): TimeOffCalBlock[] {
  const blocks: TimeOffCalBlock[] = [];
  const daysCount = view === "week" ? 7 : 1;

  for (let dIdx = 0; dIdx < daysCount; dIdx++) {
    const currentDayDate = view === "week" ? addDays(rangeStart, dIdx) : addDays(rangeStart, dayOffset);
    
    // Day boundaries (local time)
    const dayStart = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), 0, 0, 0);
    const dayEnd = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), 23, 59, 59, 999);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();

    for (const to of timeOffList) {
      const toStartMs = new Date(to.start_at).getTime();
      const toEndMs = new Date(to.end_at).getTime();

      // Check if time-off intersects this day
      if (toStartMs <= dayEndMs && toEndMs >= dayStartMs) {
        const effStartMs = Math.max(toStartMs, dayStartMs);
        const effEndMs = Math.min(toEndMs, dayEndMs);

        let startH = firstHour;
        if (effStartMs > dayStartMs) {
          const d = new Date(effStartMs);
          startH = Math.max(firstHour, d.getHours() + d.getMinutes() / 60);
        }

        let endH = lastHour;
        if (effEndMs < dayEndMs) {
          const d = new Date(effEndMs);
          endH = Math.min(lastHour, d.getHours() + d.getMinutes() / 60);
        }

        const durationH = Math.max(0.5, endH - startH);
        if (durationH > 0) {
          blocks.push({
            id: to.id,
            dayIndex: dIdx,
            startHour: startH,
            durationHours: durationH,
            reason: to.reason || "Urlop / Przerwa salonu",
            startAt: to.start_at,
            endAt: to.end_at,
            isAllDay: toStartMs <= dayStartMs && toEndMs >= dayEndMs,
            rawTimeOff: to,
          });
        }
      }
    }
  }

  return blocks;
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
  const [timeOffList, setTimeOffList] = useState<TimeOff[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [profileModalStaffId, setProfileModalStaffId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [selectedTimeOff, setSelectedTimeOff] = useState<TimeOff | null>(null);
  
  // Quick Add Time-off Modal
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    start_at: "",
    end_at: "",
    reason: "",
  });
  const [timeOffBusy, setTimeOffBusy] = useState(false);

  const [summary, setSummary] = useState({
    appointments_today: 0,
    pending_count: 0,
    customers_total: 0,
    cancelled_7d: 0,
    no_show_7d: 0,
    alerts_open: 0,
    avg_score: null as number | null,
  });
  const [error, setError] = useState<string | null>(null);

  const rangeStart = weekStart;
  const dayDate = addDays(weekStart, dayOffset);

  const reloadAll = async () => {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    try {
      const [appts, toList, wh, cust, sum, stList] = await Promise.all([
        appointmentsApi.list({ from_at: from, to_at: to }),
        hoursApi.listTimeOff(),
        hoursApi.list(),
        customersApi.list().catch(() => []),
        dashboardApi.summary().catch(() => null),
        staffApi.list().catch(() => []),
      ]);
      setAppointments(appts);
      setTimeOffList(toList);
      setWorkingHours(wh);
      setCustomers(cust);
      setStaffList(stList);
      if (sum) {
        setSummary({
          appointments_today: sum.appointments_today,
          pending_count: sum.pending_count,
          customers_total: sum.customers_total,
          cancelled_7d: sum.cancelled_7d ?? 0,
          no_show_7d: sum.no_show_7d ?? 0,
          alerts_open: sum.alerts_open ?? 0,
          avg_score: sum.avg_score ?? null,
        });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ładowania danych kalendarza");
    }
  };

  useEffect(() => {
    void reloadAll();
  }, [weekStart]);

  const staffMap = useMemo(
    () => new Map(staffList.map((s) => [s.id, s])),
    [staffList],
  );

  const events = useMemo(
    () => toEvents(appointments, rangeStart, view, dayOffset, selectedStaffFilter),
    [appointments, rangeStart, view, dayOffset, selectedStaffFilter],
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

  const timeOffBlocks = useMemo(
    () => toTimeOffBlocks(timeOffList, rangeStart, view, dayOffset, firstHour, lastHour),
    [timeOffList, rangeStart, view, dayOffset, firstHour, lastHour],
  );

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

  async function handleCreateTimeOff(e: FormEvent) {
    e.preventDefault();
    if (!timeOffForm.start_at || !timeOffForm.end_at) {
      alert("Proszę podać datę początkową i końcową urlopu/przerwy.");
      return;
    }
    setTimeOffBusy(true);
    try {
      await hoursApi.createTimeOff({
        start_at: new Date(timeOffForm.start_at).toISOString(),
        end_at: new Date(timeOffForm.end_at).toISOString(),
        reason: timeOffForm.reason.trim() || "Urlop wypoczynkowy",
      });
      setIsTimeOffModalOpen(false);
      setTimeOffForm({ start_at: "", end_at: "", reason: "" });
      await reloadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd dodawania urlopu");
    } finally {
      setTimeOffBusy(false);
    }
  }

  async function handleDeleteTimeOff(id: string) {
    if (!confirm("Czy na pewno chcesz usunąć ten urlop/przerwę z grafiku?")) return;
    try {
      await hoursApi.removeTimeOff(id);
      setSelectedTimeOff(null);
      await reloadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd usuwania przerwy");
    }
  }

  const HOUR_HEIGHT = 72;

  // Working Hours map (0 = Mon, 6 = Sun)
  const workingHoursMap = useMemo(() => {
    return new Map(workingHours.map((wh) => [wh.weekday, wh]));
  }, [workingHours]);

  return (
    <div className="space-y-6">
      <section className="animate-fade-up flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">calendar_month</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              {formatRangeLabel(view === "week" ? weekStart : dayDate, view)}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {business?.name || "Salon"} · {events.length} zaplanowanych wizyt · {timeOffBlocks.length > 0 ? `${timeOffBlocks.length} zablokowanych przerw/urlopów` : "Brak przerw w widoku"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-lg border border-glass-border bg-[var(--surface-container)] p-1">
            <button
              type="button"
              onClick={() => setView("day")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                view === "day"
                  ? "bg-[var(--primary-container)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--text-bright)]"
              }`}
            >
              Dzień
            </button>
            <button
              type="button"
              onClick={() => setView("week")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                view === "week"
                  ? "bg-[var(--primary-container)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--text-bright)]"
              }`}
            >
              Tydzień
            </button>
          </div>

          <div className="flex items-center gap-1 border border-glass-border rounded-lg p-1 bg-[var(--surface-container)]">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="p-1 rounded text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 transition-colors cursor-pointer"
              title="Poprzedni"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekStart(startOfWeek(new Date()));
                setDayOffset((new Date().getDay() + 6) % 7);
              }}
              className="px-2 py-1 text-xs font-semibold text-[var(--text)] hover:text-[var(--text-bright)] cursor-pointer"
            >
              Dziś
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              className="p-1 rounded text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 transition-colors cursor-pointer"
              title="Następny"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          {/* Quick Add Time-off Button */}
          <GlassButton
            variant="ghost"
            className="!border-amber-500/30 !bg-amber-500/10 !text-amber-300 hover:!bg-amber-500/20"
            onClick={() => {
              // Pre-fill with today's 09:00 - 17:00
              const now = new Date();
              const yyyy = now.getFullYear();
              const mm = String(now.getMonth() + 1).padStart(2, "0");
              const dd = String(now.getDate()).padStart(2, "0");
              setTimeOffForm({
                start_at: `${yyyy}-${mm}-${dd}T09:00`,
                end_at: `${yyyy}-${mm}-${dd}T17:00`,
                reason: "Urlop wypoczynkowy",
              });
              setIsTimeOffModalOpen(true);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">beach_access</span>
            Dodaj urlop / przerwę
          </GlassButton>

          <Link to="/appointments">
            <GlassButton variant="primary">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nowa wizyta
            </GlassButton>
          </Link>
        </div>
      </section>

      {/* STAFF / TEAM BAR (CLICKABLE PROFILES & FILTER) */}
      {staffList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-black/25 border border-white/10 shadow-lg animate-fade-in">
          <span className="text-xs font-bold text-[var(--muted)] flex items-center gap-1.5 pl-1 pr-1">
            <span className="material-symbols-outlined text-amber-400 text-base">badge</span>
            Zespół & Specjaliści:
          </span>
          <button
            type="button"
            onClick={() => setSelectedStaffFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedStaffFilter === "all"
                ? "bg-[var(--primary-container)] text-white shadow-md ring-1 ring-white/20"
                : "bg-white/5 text-[var(--muted)] hover:text-white"
            }`}
          >
            Wszyscy ({staffList.length})
          </button>
          {staffList.map((s) => (
            <div
              key={s.id}
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs transition-all ${
                selectedStaffFilter === s.id
                  ? "border-amber-400/80 bg-amber-500/20 text-amber-300 shadow-md ring-1 ring-amber-400/40"
                  : "border-white/10 bg-white/5 text-[var(--muted)] hover:border-white/20 hover:text-white"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedStaffFilter(s.id === selectedStaffFilter ? "all" : s.id)}
                className="flex items-center gap-1.5 cursor-pointer"
                title={`Filtruj kalendarz dla pracownika: ${s.name}`}
              >
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt={s.name} className="w-5 h-5 rounded-full object-cover border border-white/20" />
                ) : (
                  <span
                    style={{ backgroundColor: s.color || "#3e63dd" }}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  >
                    {s.name[0]}
                  </span>
                )}
                <span className="font-semibold text-white">{s.name}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileModalStaffId(s.id);
                }}
                className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                title="Otwórz profil, statystyki i historię zleceń pracownika"
              >
                <span className="material-symbols-outlined text-[13px]">bar_chart</span>
                Profil
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Calendar Grid and Sidebar */}
      <div className="animate-fade-up grid gap-4 lg:grid-cols-[1fr_280px]">
        <GlassCard padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-glass-border px-5 py-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="font-display text-base font-semibold text-[var(--text-bright)]">
                  {formatRangeLabel(view === "week" ? weekStart : dayDate, view)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {events.length} wizyt w widoku · {timeOffBlocks.length} zablokowanych okienek
                </p>
              </div>

              {/* Legend */}
              <div className="hidden sm:flex items-center gap-3 text-xs pl-4 border-l border-white/10">
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <span className="w-3 h-3 rounded bg-[var(--primary)] border border-white/20" />
                  <span>Wizyta</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-300">
                  <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-400" />
                  <span>Urlop / Przerwa (Zablokowane)</span>
                </div>
              </div>
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
              {/* Day headers */}
              <div className="border-b border-glass-border" />
              {visibleDays.map((day, i) => {
                const d =
                  view === "week"
                    ? addDays(weekStart, WEEKDAYS.indexOf(day))
                    : dayDate;
                const weekdayIndex = (d.getDay() + 6) % 7; // 0=Mon, 6=Sun
                const whRow = workingHoursMap.get(weekdayIndex);
                const isClosed = workingHours.length > 0 && !whRow;
                const isToday = new Date().toDateString() === d.toDateString();

                return (
                  <div
                    key={`${day}-${i}`}
                    className={`border-b border-l border-glass-border px-3 py-3 text-center transition-colors ${
                      isToday ? "bg-[var(--primary)]/10" : isClosed ? "bg-red-500/[0.03]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <p className={`text-xs uppercase tracking-wider font-semibold ${isToday ? "text-[var(--primary)] font-bold" : "text-[var(--muted)]"}`}>
                        {day}
                      </p>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                      )}
                      {isClosed && (
                        <span className="text-[9px] font-bold px-1 rounded bg-red-500/20 text-red-300">
                          Zamknięte
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 font-display text-sm font-bold ${isToday ? "text-[var(--text-bright)]" : ""}`}>
                      {d.getDate()}
                    </p>
                  </div>
                );
              })}

              {/* Hour labels column */}
              <div>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-glass-border px-2 text-right text-xs text-[var(--muted)] flex items-center justify-end"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <span className="relative -top-3 font-mono">{formatHour(hour)}</span>
                  </div>
                ))}
              </div>

              {/* Day columns with positioned events & Time Off blocks */}
              {visibleDays.map((day, dayIdx) => {
                const colEvents = events.filter((e) => e.dayIndex === dayIdx);
                const colTimeOff = timeOffBlocks.filter((to) => to.dayIndex === dayIdx);

                return (
                  <div
                    key={`col-${day}-${dayIdx}`}
                    className="relative border-l border-glass-border bg-black/[0.02]"
                    style={{ height: totalHours * HOUR_HEIGHT }}
                  >
                    {/* Hour grid lines */}
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="absolute inset-x-0 border-b border-glass-border/60"
                        style={{
                          top: (hour - firstHour) * HOUR_HEIGHT,
                          height: HOUR_HEIGHT,
                        }}
                      />
                    ))}

                    {/* TIME OFF / VACATION BLOCKED SLOTS */}
                    {colTimeOff.map((block) => {
                      const top = ((block.startHour - firstHour) / totalHours) * 100;
                      const height = (block.durationHours / totalHours) * 100;
                      const isSelected = selectedTimeOff?.id === block.id;

                      return (
                        <div
                          key={`to-${block.id}-${block.dayIndex}`}
                          onClick={() => {
                            setSelectedEvent(null);
                            setSelectedTimeOff(block.rawTimeOff);
                          }}
                          className={`absolute inset-x-1 rounded-xl border p-2 text-left cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xl hover:z-30 z-20 group backdrop-blur-md ${
                            isSelected
                              ? "border-amber-400 ring-2 ring-amber-400/80 shadow-2xl shadow-amber-500/20"
                              : "border-amber-500/50 hover:border-amber-300"
                          }`}
                          style={{
                            top: `${top}%`,
                            height: `calc(${height}% - 4px)`,
                            minHeight: "2.75rem",
                            background:
                              "repeating-linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.18) 12px, rgba(217, 119, 6, 0.28) 12px, rgba(217, 119, 6, 0.28) 24px)",
                          }}
                          title={`Urlop: ${block.reason} (${block.startAt.slice(0, 10)} - ${block.endAt.slice(0, 10)})`}
                        >
                          <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs truncate">
                            <span className="material-symbols-outlined text-[16px] shrink-0 text-amber-400 animate-pulse">
                              beach_access
                            </span>
                            <span className="truncate">{block.reason}</span>
                          </div>
                          <p className="text-[10px] text-amber-200/90 font-medium truncate mt-0.5">
                            {block.isAllDay
                              ? "🔒 Cały dzień zablokowany"
                              : `🔒 ${formatHour(block.startHour)} – ${formatHour(block.startHour + block.durationHours)}`}
                          </p>
                        </div>
                      );
                    })}

                    {/* APPOINTMENTS */}
                    {colEvents.map((event) => {
                      const top =
                        ((event.startHour - firstHour) / totalHours) * 100;
                      const height =
                        (event.durationHours / totalHours) * 100;
                      const isSelected = selectedEvent?.id === event.id;

                      return (
                        <button
                          type="button"
                          key={event.id}
                          onClick={() => {
                            setSelectedTimeOff(null);
                            setSelectedEvent(event);
                          }}
                          className={[
                            "absolute inset-x-1.5 rounded-xl border px-2.5 py-1.5 text-left transition-all hover:shadow-xl hover:z-30 cursor-pointer backdrop-blur-md",
                            event.tone === "canary"
                              ? "border-[var(--accent)]/50 bg-[var(--surface-solid)]/90 text-[var(--text-bright)]"
                              : "border-glass-border bg-[var(--surface-solid)]/90 text-[var(--text-bright)]",
                            isSelected
                              ? "ring-2 ring-[var(--accent)] z-30 shadow-xl"
                              : "z-10",
                          ].join(" ")}
                          style={{
                            top: `${top}%`,
                            height: `calc(${height}% - 2px)`,
                            minHeight: "2.25rem",
                          }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-bold text-[var(--text-bright)]">
                              {event.title}
                            </p>
                            {event.staffId && staffMap.has(event.staffId) && (
                              <span
                                style={{ backgroundColor: staffMap.get(event.staffId)?.color || "#3e63dd" }}
                                className="w-3.5 h-3.5 rounded-full shrink-0 text-[8px] font-bold text-white flex items-center justify-center border border-white/20"
                                title={`Specjalista: ${staffMap.get(event.staffId)?.name}`}
                              >
                                {staffMap.get(event.staffId)?.name[0]}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-[var(--muted)]">
                            {event.client} · {formatHour(event.startHour)}–
                            {formatHour(event.startHour + event.durationHours)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </GlassCard>

        {/* Sidebar Details Panel */}
        <aside className="space-y-4">
          {/* TIME OFF DETAIL CARD */}
          {selectedTimeOff && (
            <GlassCard className="animate-fade-up border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent shadow-xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <span className="material-symbols-outlined text-[20px]">beach_access</span>
                  <span>Urlop / Przerwa</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTimeOff(null)}
                  className="text-[var(--muted)] hover:text-white text-lg leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>

              <p className="mt-2 text-sm font-bold text-[var(--text-bright)]">
                {selectedTimeOff.reason || "Urlop wypoczynkowy"}
              </p>

              <div className="mt-3 p-3 rounded-xl bg-black/25 border border-white/10 text-xs space-y-1.5">
                <p className="text-[var(--muted)]">
                  Początek:{" "}
                  <strong className="text-[var(--text-bright)]">
                    {new Date(selectedTimeOff.start_at).toLocaleString("pl-PL", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </strong>
                </p>
                <p className="text-[var(--muted)]">
                  Koniec:{" "}
                  <strong className="text-[var(--text-bright)]">
                    {new Date(selectedTimeOff.end_at).toLocaleString("pl-PL", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </strong>
                </p>
                <p className="text-amber-300 text-[10px] pt-1 flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  Wszystkie terminy w tym czasie są zablokowane.
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <GlassButton
                  variant="danger"
                  className="w-full justify-center text-xs !py-2"
                  onClick={() => void handleDeleteTimeOff(selectedTimeOff.id)}
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Usuń przerwę z grafiku
                </GlassButton>
                <Link to="/hours" className="block">
                  <GlassButton variant="ghost" className="w-full justify-center text-xs !py-2">
                    Zarządzaj w Godzinach pracy →
                  </GlassButton>
                </Link>
              </div>
            </GlassCard>
          )}

          {/* APPOINTMENT DETAIL CARD */}
          {selectedEvent && (
            <GlassCard className="animate-fade-up">
              <div className="flex items-start justify-between">
                <p className="font-display text-base font-semibold text-[var(--text-bright)]">
                  {selectedEvent.title}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-[var(--muted)] hover:text-[var(--text-bright)] text-lg leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>
              <p className="mt-1 text-sm text-[var(--text-bright)] font-medium">
                {selectedEvent.client}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(selectedEvent.startAt).toLocaleString("pl-PL", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {" – "}
                {new Date(selectedEvent.endAt).toLocaleString("pl-PL", {
                  timeStyle: "short",
                })}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Status: {STATUS_PL[selectedEvent.status] ?? selectedEvent.status}
              </p>

              {/* Staff Member in Event Card */}
              {selectedEvent.staffId && staffMap.has(selectedEvent.staffId) && (
                (() => {
                  const evStaff = staffMap.get(selectedEvent.staffId)!;
                  return (
                    <div className="mt-3 p-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {evStaff.avatar_url ? (
                          <img
                            src={evStaff.avatar_url}
                            alt={evStaff.name}
                            className="w-8 h-8 rounded-lg object-cover border border-white/20 shrink-0"
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: evStaff.color || "#3e63dd" }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          >
                            {evStaff.name[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] text-[var(--muted)]">Pracownik:</p>
                          <p className="text-xs font-bold text-white truncate">{evStaff.name}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProfileModalStaffId(evStaff.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-xs">bar_chart</span>
                        Profil & Statystyki
                      </button>
                    </div>
                  );
                })()
              )}

              {selectedCustomer && (
                <div className="mt-3 space-y-1 rounded-soft border border-glass-border bg-glass-fill p-3 text-xs">
                  <p className="font-semibold text-[var(--text-bright)]">
                    Dane kontaktowe
                  </p>
                  {selectedCustomer.phone && (
                    <p>
                      <span className="text-[var(--muted)]">Tel:</span>{" "}
                      <a
                        href={`tel:${selectedCustomer.phone}`}
                        className="text-canary underline"
                      >
                        {selectedCustomer.phone}
                      </a>
                    </p>
                  )}
                  {selectedCustomer.email && (
                    <p>
                      <span className="text-[var(--muted)]">E-mail:</span>{" "}
                      <a
                        href={`mailto:${selectedCustomer.email}`}
                        className="text-canary underline"
                      >
                        {selectedCustomer.email}
                      </a>
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-2">
                <GlassButton
                  className="w-full"
                  variant="primary"
                  onClick={() =>
                    navigate(
                      `/appointments?edit=${selectedEvent.id}`,
                    )
                  }
                >
                  Przełóż wizytę
                </GlassButton>
                <GlassButton
                  className="w-full"
                  onClick={() =>
                    navigate(
                      `/notifications/send?appointment=${selectedEvent.id}`,
                    )
                  }
                >
                  Powiadom klienta
                </GlassButton>
                <GlassButton
                  className="w-full"
                  onClick={() =>
                    navigate(
                      `/inbox?compose=1&customer=${selectedEvent.customerId}`,
                    )
                  }
                >
                  Napisz wiadomość
                </GlassButton>
              </div>
            </GlassCard>
          )}

          {/* Dziś Widget */}
          <GlassCard>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Dziś
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-[var(--text-bright)]">
              {summary.appointments_today} wizyt
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {summary.pending_count} oczekuje · {summary.customers_total} klientów
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              7d: {summary.cancelled_7d} anul. · {summary.no_show_7d} no-show
              {summary.avg_score != null ? ` · ★ ${summary.avg_score}` : ""}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-solid)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{
                  width: `${Math.min(100, summary.appointments_today * 12 + 8)}%`,
                }}
              />
            </div>
          </GlassCard>

          {/* Next Appt Widget */}
          <GlassCard>
            <p className="mb-2 font-display text-base font-semibold text-[var(--text-bright)]">
              Następna wizyta
            </p>
            {nextAppt ? (
              <>
                <p className="text-sm text-[var(--text-bright)] font-semibold">
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

      {/* QUICK ADD TIME-OFF MODAL */}
      {isTimeOffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border border-amber-500/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">beach_access</span>
                </div>
                <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
                  Dodaj Urlop / Przerwę
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTimeOffModalOpen(false)}
                className="text-[var(--muted)] hover:text-white cursor-pointer text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTimeOff} className="space-y-3.5">
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Wybrany okres zostanie zablokowany w kalendarzu. Klienci rezerwujący online nie będą mogli wybrać tych godzin.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-bright)] mb-1">
                  Data i godzina rozpoczęcia
                </label>
                <GlassInput
                  type="datetime-local"
                  value={timeOffForm.start_at}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, start_at: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-bright)] mb-1">
                  Data i godzina zakończenia
                </label>
                <GlassInput
                  type="datetime-local"
                  value={timeOffForm.end_at}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, end_at: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-bright)] mb-1">
                  Powód przerwy (opcjonalnie)
                </label>
                <GlassInput
                  placeholder="np. Urlop wypoczynkowy, Szkolenie, Remont"
                  value={timeOffForm.reason}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <GlassButton
                  type="button"
                  variant="ghost"
                  onClick={() => setIsTimeOffModalOpen(false)}
                  disabled={timeOffBusy}
                >
                  Anuluj
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={timeOffBusy}
                  className="!border-amber-500/50 !bg-gradient-to-r from-amber-500 to-amber-600 !text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  {timeOffBusy ? "Zapisywanie..." : "Zablokuj termin"}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIVERSAL STAFF PROFILE & STATS MODAL */}
      <StaffProfileModal
        staffId={profileModalStaffId}
        initialStaff={profileModalStaffId ? staffMap.get(profileModalStaffId) : null}
        onClose={() => setProfileModalStaffId(null)}
      />
    </div>
  );
}
