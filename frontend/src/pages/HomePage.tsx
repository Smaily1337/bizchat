import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appointmentsApi, dashboardApi, inboxApi } from "@/api";
import type { Appointment, Conversation } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton } from "@/components/ui";

const ChannelIcon = ({ channel }: { channel?: string }) => {
  const ch = (channel || "").toLowerCase();
  switch (ch) {
    case "messenger":
      return <span className="material-symbols-outlined text-[14px]">chat</span>;
    case "instagram":
      return <span className="material-symbols-outlined text-[14px]">photo_camera</span>;
    case "whatsapp":
      return <span className="material-symbols-outlined text-[14px]">chat_bubble</span>;
    case "telegram":
      return <span className="material-symbols-outlined text-[14px]">send</span>;
    default:
      return <span className="material-symbols-outlined text-[14px]">forum</span>;
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

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getStatusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("confirm") || s.includes("potwierdz")) return "text-secondary";
  if (s.includes("progress") || s.includes("trwa")) return "text-primary";
  if (s.includes("pend") || s.includes("oczek")) return "text-tertiary";
  return "text-on-surface-variant";
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
    <div className="space-y-8 pb-12">
      <header className="animate-fade-up">
        <p className="font-label-caps text-label-caps uppercase tracking-wider text-primary mb-2">Panel</p>
        <h1 className="font-display text-display-lg-mobile md:text-display-lg font-semibold bg-gradient-to-r from-primary via-primary-fixed to-tertiary-container bg-clip-text text-transparent">
          Dziś · {business?.name || "Salon"}
        </h1>
        <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
          Skrót operacyjny: wizyty, kolejka i otwarte rozmowy.
        </p>
      </header>

      <section className="grid animate-fade-up grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-[28px] p-6 flex flex-col hover:border-white/20 hover:shadow-glow transition-all">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-primary">event_note</span>
          </div>
          <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant mb-1">
            Wizyty dziś
          </p>
          <div className="flex items-end justify-between mt-auto">
            <p className="font-kpi-stat text-kpi-stat text-on-surface">{today ?? "—"}</p>
            {today !== null && (
              <span className="font-data-mono text-data-mono text-secondary mb-1">
                +12%
              </span>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-[28px] p-6 flex flex-col hover:border-white/20 hover:shadow-glow transition-all">
          <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-tertiary">pending_actions</span>
          </div>
          <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant mb-1">
            Oczekujące
          </p>
          <div className="flex items-end justify-between mt-auto">
            <p className="font-kpi-stat text-kpi-stat text-on-surface">{pending ?? "—"}</p>
            {pending !== null && (
              <span className="font-data-mono text-data-mono text-tertiary mb-1">
                -2%
              </span>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-[28px] p-6 flex flex-col hover:border-white/20 hover:shadow-glow transition-all">
          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-secondary">group</span>
          </div>
          <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant mb-1">
            Klienci
          </p>
          <div className="flex items-end justify-between mt-auto">
            <p className="font-kpi-stat text-kpi-stat text-on-surface">{customers ?? "—"}</p>
            {customers !== null && (
              <span className="font-data-mono text-data-mono text-secondary mb-1">
                +5%
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 animate-fade-up">
        <Link to="/calendar">
          <GlassButton className="bg-gradient-to-r from-primary-container to-tertiary-container hover:shadow-glow border-0">
            Kalendarz
          </GlassButton>
        </Link>
        <Link to="/appointments">
          <GlassButton variant="ghost">Wizyty</GlassButton>
        </Link>
        <Link to="/inbox">
          <GlassButton variant="ghost">Wiadomości</GlassButton>
        </Link>
      </div>

      <div className="grid animate-fade-up gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-[28px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 bg-surface-container/30">
            <p className="font-headline-md text-headline-md text-on-surface">
              Najbliższe wizyty
            </p>
            <Link
              to="/appointments"
              className="text-sm font-medium text-primary hover:text-primary-container transition-colors"
            >
              Wszystkie
            </Link>
          </div>
          <ul className="divide-y divide-white/5 flex-1">
            {upcoming.length === 0 && (
              <li className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Brak wizyt na dziś.
              </li>
            )}
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-full bg-surface-container border border-white/10 flex items-center justify-center font-label-caps text-on-surface shrink-0">
                  {getInitials(a.customer_name || "Wizyta")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-medium text-on-surface">
                    {a.customer_name || a.service_name || "Wizyta"}
                  </p>
                  <p className="truncate text-sm text-on-surface-variant">
                    {a.service_name || a.status}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-data-mono text-data-mono text-on-surface">
                    {fmtTime(a.start_at)}
                  </span>
                  <span className={`font-label-caps text-label-caps uppercase ${getStatusColor(a.status)}`}>
                    {a.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel rounded-[28px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 bg-surface-container/30">
            <p className="font-headline-md text-headline-md text-on-surface">
              Otwarte rozmowy
            </p>
            <Link
              to="/inbox"
              className="text-sm font-medium text-primary hover:text-primary-container transition-colors"
            >
              Inbox
            </Link>
          </div>
          <ul className="divide-y divide-white/5 flex-1">
            {openChats.length === 0 && (
              <li className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Brak rozmów.
              </li>
            )}
            {openChats.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/inbox?c=${c.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors block"
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-surface-container border border-white/10 flex items-center justify-center font-label-caps text-on-surface">
                      {getInitials(c.customer_name || "Klient")}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#201f21] border border-white/10 flex items-center justify-center text-primary shadow-sm">
                      <ChannelIcon channel={c.channel} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-body-md font-medium text-on-surface">
                        {c.customer_name || "Klient"}
                      </p>
                      <p className="font-data-mono text-data-mono text-on-surface-variant shrink-0">
                        {c.last_message_at ? fmtTime(c.last_message_at) : ""}
                      </p>
                    </div>
                    <p className="truncate text-sm text-on-surface-variant mt-0.5">
                      {c.last_message || "Nowa rozmowa"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
