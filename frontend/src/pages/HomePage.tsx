import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appointmentsApi, dashboardApi, inboxApi, customersApi, staffApi } from "@/api";
import type { Appointment, Conversation, Customer, StaffMember } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton } from "@/components/ui";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtDuration(startIso: string, endIso?: string) {
  try {
    if (!endIso) return "";
    const diffMin = Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
    );
    if (diffMin >= 60) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${diffMin}m`;
  } catch {
    return "";
  }
}

function getInitials(name?: string | null) {
  if (!name) return "KL";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-400 font-medium text-xs border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          Potwierdzona
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 font-medium text-xs border border-yellow-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Oczekująca
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 font-medium text-xs border border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Anulowana
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium text-xs border border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Zakończona
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-[var(--muted)] font-medium text-xs border border-white/10">
          {status}
        </span>
      );
  }
}

export function HomePage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [today, setToday] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [customersCount, setCustomersCount] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [openChats, setOpenChats] = useState<Conversation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  useEffect(() => {
    void dashboardApi
      .summary()
      .then((s) => {
        setToday(s.appointments_today);
        setPending(s.pending_count);
        setCustomersCount(s.customers_total);
      })
      .catch(() => undefined);

    void appointmentsApi
      .list()
      .then((list) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const day = list
          .filter((a) => {
            const t = new Date(a.start_at).getTime();
            return t >= start.getTime() && t <= end.getTime();
          })
          .sort(
            (a, b) =>
              new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
          );
        setUpcoming(day);
      })
      .catch(() => undefined);

    void inboxApi
      .conversations()
      .then((list) => setOpenChats(list.slice(0, 5)))
      .catch(() => undefined);

    void customersApi
      .list()
      .then(setCustomers)
      .catch(() => undefined);

    void staffApi
      .list()
      .then(setStaffList)
      .catch(() => undefined);
  }, []);

  const todayDateStr = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const capitalizedDate =
    todayDateStr.charAt(0).toUpperCase() + todayDateStr.slice(1);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header with Date & Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
            {capitalizedDate}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {business?.name || "Panel salonu"} · Przegląd dnia i aktywności
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/appointments">
            <GlassButton variant="primary">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nowa wizyta
            </GlassButton>
          </Link>
          <Link to="/customers">
            <GlassButton variant="ghost">
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Klient
            </GlassButton>
          </Link>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Stat 1: Wizyty dziś */}
        <div className="glass-panel glass-panel-interactive rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-[var(--primary)]/10 blur-xl group-hover:bg-[var(--primary)]/20 transition-all" />
          <div className="flex items-center justify-between">
            <span
              className="material-symbols-outlined text-[var(--primary)] text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              calendar_today
            </span>
            <span className="font-medium text-xs text-[var(--muted)] bg-white/5 px-2 py-1 rounded-md border border-white/5">
              Dziś
            </span>
          </div>
          <h3 className="font-display text-3xl font-bold mt-2 text-[var(--text-bright)]">
            {today ?? "0"}
          </h3>
          <p className="text-xs text-[var(--muted)] font-medium">Wizyty dziś</p>
        </div>

        {/* Stat 2: Oczekujące */}
        <div className="glass-panel glass-panel-interactive rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-[var(--secondary)]/10 blur-xl group-hover:bg-[var(--secondary)]/20 transition-all" />
          <div className="flex items-center justify-between">
            <span
              className="material-symbols-outlined text-[var(--secondary)] text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              pending_actions
            </span>
            {pending && pending > 0 ? (
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--secondary)] animate-pulse" />
            ) : null}
          </div>
          <h3 className="font-display text-3xl font-bold mt-2 text-[var(--text-bright)]">
            {pending ?? "0"}
          </h3>
          <p className="text-xs text-[var(--muted)] font-medium">Oczekujące</p>
        </div>

        {/* Stat 3: Nowi klienci */}
        <div className="glass-panel glass-panel-interactive rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-[var(--tertiary)]/10 blur-xl group-hover:bg-[var(--tertiary)]/20 transition-all" />
          <div className="flex items-center justify-between">
            <span
              className="material-symbols-outlined text-[var(--tertiary)] text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              group
            </span>
            <span className="text-xs text-[var(--muted)] bg-white/5 px-2 py-1 rounded-md border border-white/5">
              Baza
            </span>
          </div>
          <h3 className="font-display text-3xl font-bold mt-2 text-[var(--text-bright)]">
            {customersCount ?? customers.length}
          </h3>
          <p className="text-xs text-[var(--muted)] font-medium">Klienci w bazie</p>
        </div>

        {/* Stat 4: Wiadomości */}
        <div className="glass-panel glass-panel-interactive rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-[var(--primary)]/10 blur-xl group-hover:bg-[var(--primary)]/20 transition-all" />
          <div className="flex items-center justify-between">
            <span
              className="material-symbols-outlined text-[var(--primary)] text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              forum
            </span>
            {openChats.length > 0 && (
              <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-md border border-[var(--accent)]/30">
                {openChats.length} aktywnych
              </span>
            )}
          </div>
          <h3 className="font-display text-3xl font-bold mt-2 text-[var(--text-bright)]">
            {openChats.length}
          </h3>
          <p className="text-xs text-[var(--muted)] font-medium">Otwarte wątki</p>
        </div>
      </section>

      {/* Main Section: Appointments List */}
      <section className="glass-panel rounded-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-glass-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface-container-low)]">
          <h2 className="font-display text-lg font-bold text-[var(--text-bright)] flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--primary)] text-[22px]">
              list_alt
            </span>
            Lista wizyt na dziś
          </h2>
          <div className="flex gap-2">
            <Link to="/appointments">
              <button className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1">
                Zobacz wszystkie wizyty
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[var(--muted)] font-semibold text-xs uppercase tracking-wider bg-white/[0.02]">
                <th className="py-3.5 px-6">Czas</th>
                <th className="py-3.5 px-6">Klient</th>
                <th className="py-3.5 px-6">Usługa</th>
                <th className="py-3.5 px-6">Pracownik</th>
                <th className="py-3.5 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {upcoming.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center text-[var(--muted)]">
                    <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">
                      event_available
                    </span>
                    Brak zaplanowanych wizyt na dzisiaj.
                    <div className="mt-3">
                      <Link to="/appointments">
                        <GlassButton variant="ghost" className="!text-xs !py-1.5 !px-3">
                          + Dodaj nową wizytę
                        </GlassButton>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                upcoming.map((a) => {
                  const cust = customers.find((c) => c.id === a.customer_id);
                  const st = staffList.find((s) => s.id === a.staff_id);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/appointments?edit=${a.id}`)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 font-mono text-sm font-semibold text-[var(--text-bright)]">
                          {fmtTime(a.start_at)}
                          <span className="text-xs text-[var(--muted)] font-normal">
                            {fmtDuration(a.start_at, a.end_at)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--surface-solid)] border border-glass-border flex items-center justify-center text-[var(--primary)] font-bold text-xs shrink-0">
                            {getInitials(a.customer_name || cust?.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--text-bright)]">
                              {a.customer_name || cust?.name || "Klient"}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {cust?.phone || cust?.email || a.channel || ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-[var(--text)] font-medium">
                        {a.service_name || "Usługa"}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                          <span className="text-sm text-[var(--text)]">
                            {a.staff_name || st?.name || "Dowolny"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2-Column Bottom Cards: Messages & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open Chats */}
        <section className="glass-panel rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-glass-border pb-3 mb-4">
            <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">
                chat
              </span>
              Otwarte wiadomości
            </h3>
            <Link
              to="/inbox"
              className="text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              Przejdź do Inbox →
            </Link>
          </div>
          {openChats.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              Brak otwartych konwersacji.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {openChats.map((c) => (
                <li key={c.id} className="py-3 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                  <Link to={`/inbox?c=${c.id}`} className="block">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-[var(--text-bright)]">
                        {c.customer_name || "Klient"}
                      </p>
                      <span className="text-[11px] font-medium uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/10">
                        {c.channel}
                      </span>
                    </div>
                    <p className="truncate text-xs text-[var(--muted)] mt-1">
                      {c.last_message || "Rozpoczęto konwersację"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick Links Hub */}
        <section className="glass-panel rounded-xl p-5 flex flex-col">
          <div className="border-b border-glass-border pb-3 mb-4">
            <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--secondary)] text-[20px]">
                hub
              </span>
              Centrum operacyjne
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <Link
              to="/calendar"
              className="glass-panel glass-panel-interactive rounded-lg p-3.5 flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[24px] text-[var(--primary)]">
                calendar_month
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-bright)]">Kalendarz</p>
                <p className="text-[11px] text-[var(--muted)]">Grafik tygodnia</p>
              </div>
            </Link>
            <Link
              to="/appointments"
              className="glass-panel glass-panel-interactive rounded-lg p-3.5 flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[24px] text-[var(--secondary)]">
                event_note
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-bright)]">Wizyty</p>
                <p className="text-[11px] text-[var(--muted)]">Baza rezerwacji</p>
              </div>
            </Link>
            <Link
              to="/staff"
              className="glass-panel glass-panel-interactive rounded-lg p-3.5 flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[24px] text-[var(--accent)]">
                badge
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-bright)]">Zespół</p>
                <p className="text-[11px] text-[var(--muted)]">Pracownicy</p>
              </div>
            </Link>
            <Link
              to="/reports"
              className="glass-panel glass-panel-interactive rounded-lg p-3.5 flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[24px] text-[var(--tertiary)]">
                analytics
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-bright)]">Raporty</p>
                <p className="text-[11px] text-[var(--muted)]">Statystyki salonu</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

