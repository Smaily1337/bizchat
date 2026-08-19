import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appointmentsApi, dashboardApi, inboxApi } from "@/api";
import type { Appointment, Conversation } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";

const ChannelIcon = ({ channel }: { channel?: string }) => {
  const ch = (channel || "").toLowerCase();
  switch (ch) {
    case "messenger":
      return (
        <svg viewBox="0 0 36 36" className="w-3.5 h-3.5" fill="url(#messengerGrad)"><defs><linearGradient id="messengerGrad" x1="19.23%" y1="102.1%" x2="84.91%" y2="-0.65%"><stop offset="0%" stopColor="#00B2FF"/><stop offset="100%" stopColor="#FF6680"/></linearGradient></defs><path d="M18 1.4C8.8 1.4 1.4 8.2 1.4 16.5c0 4.7 2.4 8.9 6.2 11.7v6.4l5.7-3.2c1.5.4 3.1.6 4.7.6 9.2 0 16.6-6.8 16.6-15.1S27.2 1.4 18 1.4zm1 20.3l-3.9-4.2-7.6 4.2 8.3-8.9 4 4.2 7.5-4.2-8.3 8.9z"/></svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"><defs><linearGradient id="ig" x1="20%" y1="100%" x2="80%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig)" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85C2.38 3.85 3.92 2.31 7.15 2.16c1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07c-4.27.2-6.78 2.71-6.98 6.98C0 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.27 2.71 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.27-.2 6.78-2.71 6.98-6.98C23.99 15.67 24 15.26 24 12s-.01-3.67-.07-4.95c-.2-4.27-2.71-6.78-6.98-6.98C15.67.01 15.26 0 12 0z"/><path fill="#fff" d="M12 5.84A6.16 6.16 0 1018.16 12 6.16 6.16 0 0012 5.84zm0 10.16A4 4 0 1116 12a4 4 0 01-4 4zM18.41 4.15a1.44 1.44 0 101.43 1.44 1.44 1.44 0 00-1.43-1.44z"/></svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#25D366"><path d="M17.47 16.48c-.28-.14-1.68-.83-1.94-.93-.26-.09-.45-.14-.64.14-.19.28-.73.93-.89 1.12-.17.19-.34.21-.62.07-.28-.14-1.2-.44-2.28-1.41-.84-.75-1.41-1.68-1.58-1.96-.17-.28-.02-.43.12-.57.13-.13.28-.33.43-.5.14-.17.19-.28.28-.47.09-.19.04-.36-.03-.5-.07-.14-.64-1.54-.87-2.11-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.35-.26.28-.99.97-.99 2.37 0 1.4 1.02 2.76 1.16 2.95.14.19 2.01 3.07 4.87 4.3 2.39 1.03 3.2.93 3.8.84.97-.15 2.11-.86 2.41-1.7.3-.84.3-1.56.21-1.71-.09-.15-.33-.24-.62-.38zM12 21.8c-1.66 0-3.28-.45-4.71-1.3l-.34-.2-3.5.92.93-3.41-.22-.35A9.77 9.77 0 012.2 12 9.8 9.8 0 0112 2.2 9.8 9.8 0 0121.8 12 9.8 9.8 0 0112 21.8zM12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.18 1.6 6l-1.6 5.86L6.05 22.3A11.95 11.95 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#0088cc"><path d="M12 0C5.37 0 0 5.37 0 12c0 6.63 5.37 12 12 12s12-5.37 12-12c0-6.63-5.37-12-12-12zm5.56 8.16l-1.93 9.07c-.15.65-.53.81-1.07.51l-2.96-2.18-1.43 1.38c-.16.16-.29.29-.6.29l.21-3.02 5.5-4.97c.24-.21-.05-.33-.37-.11l-6.8 4.28-2.93-.91c-.63-.2-.64-.64.13-.94l11.45-4.42c.53-.2.99.11.8.1z"/></svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-blue-500" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      );
  }
};

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
                <Link
                  to={`/inbox?c=${c.id}`}
                  className="block hover:opacity-80"
                >
                  <p className="truncate text-sm font-medium text-[var(--text-bright)]">
                    {c.customer_name || "Klient"}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-[var(--muted)]">
                    <ChannelIcon channel={c.channel} />
                    <span>{c.last_message || "Nowa rozmowa"}</span>
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
