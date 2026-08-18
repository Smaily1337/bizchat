import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appointmentsApi, dashboardApi, inboxApi } from "@/api";
import type { Appointment, Conversation } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";

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

export function HomePage() {
  const { business } = useAuth();
  const [today, setToday] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [customers, setCustomers] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [openChats, setOpenChats] = useState<Conversation[]>([]);

  useEffect(() => {
    void dashboardApi
      .summary()
      .then((s) => {
        setToday(s.appointments_today);
        setPending(s.pending_count);
        setCustomers(s.customers_total);
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
          )
          .slice(0, 5);
        setUpcoming(day);
      })
      .catch(() => undefined);

    void inboxApi
      .conversations()
      .then((list) => setOpenChats(list.slice(0, 5)))
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="label-caps">Panel</p>
        <h1 className="font-display text-2xl font-semibold text-[var(--text-bright)] sm:text-3xl">
          Dziś · {business?.name || "Salon"}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
          Skrót operacyjny: wizyty, kolejka i otwarte rozmowy.
        </p>
      </header>

      <section className="grid animate-fade-up gap-3 sm:grid-cols-3">
        <div className="stat-chip">
          <p className="label-caps">Wizyty dziś</p>
          <p className="font-display text-3xl font-semibold text-[var(--text-bright)]">
            {today ?? "—"}
          </p>
        </div>
        <div className="stat-chip">
          <p className="label-caps">Oczekujące</p>
          <p className="font-display text-3xl font-semibold text-[var(--text-bright)]">
            {pending ?? "—"}
          </p>
        </div>
        <div className="stat-chip">
          <p className="label-caps">Klienci</p>
          <p className="font-display text-3xl font-semibold text-[var(--text-bright)]">
            {customers ?? "—"}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 animate-fade-up">
        <Link to="/calendar">
          <GlassButton>Kalendarz</GlassButton>
        </Link>
        <Link to="/appointments">
          <GlassButton variant="ghost">Wizyty</GlassButton>
        </Link>
        <Link to="/inbox">
          <GlassButton variant="ghost">Wiadomości</GlassButton>
        </Link>
      </div>

      <div className="grid animate-fade-up gap-4 lg:grid-cols-2">
        <GlassCard padding="none">
          <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text-bright)]">
              Najbliższe wizyty
            </p>
            <Link
              to="/appointments"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Wszystkie
            </Link>
          </div>
          <ul className="divide-y divide-[var(--glass-border)]">
            {upcoming.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                Brak wizyt na dziś.
              </li>
            )}
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-sm font-medium text-[var(--text-bright)]">
                  {fmtTime(a.start_at)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-bright)]">
                    {a.customer_name || a.service_name || "Wizyta"}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {a.service_name || a.status}
                  </p>
                </div>
                <span className="rounded-control bg-[var(--surface-solid)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard padding="none">
          <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text-bright)]">
              Otwarte rozmowy
            </p>
            <Link
              to="/inbox"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Inbox
            </Link>
          </div>
          <ul className="divide-y divide-[var(--glass-border)]">
            {openChats.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                Brak rozmów.
              </li>
            )}
            {openChats.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <Link to="/inbox" className="block hover:opacity-80">
                  <p className="truncate text-sm font-medium text-[var(--text-bright)]">
                    {c.customer_name || "Klient"}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {c.channel}
                    {c.last_message ? ` · ${c.last_message}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
