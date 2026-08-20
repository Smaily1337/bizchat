import { useEffect, useState } from "react";
import { dashboardApi } from "@/api";
import type { DashboardAnalytics } from "@/api/types";
import { GlassButton } from "@/components/ui";

const CHANNEL_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  messenger: { label: "Messenger", icon: "chat", color: "bg-[#0084FF]" },
  instagram: { label: "Instagram", icon: "photo_camera", color: "bg-[#E1306C]" },
  telegram: { label: "Telegram", icon: "send", color: "bg-[#229ED9]" },
  whatsapp: { label: "WhatsApp", icon: "phone_iphone", color: "bg-[#25D366]" },
  widget: { label: "Widget WWW", icon: "language", color: "bg-[var(--accent)]" },
  direct: { label: "Bezpośrednio", icon: "store", color: "bg-[var(--secondary)]" },
};

export function ReportsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dashboardApi
      .analytics(days)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  function exportCsv() {
    if (!data) return;
    const lines = [
      "Dzień,Potwierdzone,Anulowane,No-show,Zakończone",
      ...data.days.map(
        (d) =>
          `${d.day},${d.confirmed},${d.cancelled},${d.no_show},${d.completed}`,
      ),
      "",
      "Kanał,Liczba",
      ...data.by_channel.map((c) => `${c.channel},${c.count}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automovia-raport-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalChannelBookings =
    data?.by_channel.reduce((sum, c) => sum + c.count, 0) || 1;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">analytics</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Raporty i Statystyki
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Efektywność rezerwacji, współczynnik no-show i konwersja kanałów
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period selector */}
          <div className="flex rounded-lg border border-glass-border bg-[var(--surface-container)] p-1">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  days === n
                    ? "bg-[var(--primary-container)] text-white shadow"
                    : "text-[var(--muted)] hover:text-[var(--text-bright)]"
                }`}
              >
                {n} dni
              </button>
            ))}
          </div>

          <GlassButton type="button" variant="ghost" onClick={exportCsv}>
            <span className="material-symbols-outlined text-[18px]">download</span>
            Eksport CSV
          </GlassButton>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--muted)] animate-pulse">
          Ładowanie analityki salonu...
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* KPI 3-Column Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            {/* Stat 1 */}
            <div className="glass-panel glass-panel-interactive rounded-xl p-5 flex flex-col justify-between relative overflow-hidden group shadow-xl">
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-[var(--primary)] text-[28px]">
                  event_available
                </span>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Ostatnie {days} dni
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-display text-4xl font-bold text-[var(--text-bright)]">
                  {data.visits ?? 0}
                </h3>
                <p className="text-xs text-[var(--muted)] font-medium mt-1">
                  Łącznie zrealizowanych wizyt
                </p>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="glass-panel glass-panel-interactive rounded-xl p-5 flex flex-col justify-between relative overflow-hidden group shadow-xl">
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-[var(--danger)] text-[28px]">
                  person_cancel
                </span>
                <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                  No-show rate
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-display text-4xl font-bold text-[var(--text-bright)]">
                  {data.no_show_rate != null ? `${data.no_show_rate}%` : "0%"}
                </h3>
                <p className="text-xs text-[var(--muted)] font-medium mt-1">
                  Nieobecności bez odwołania
                </p>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="glass-panel glass-panel-interactive rounded-xl p-5 flex flex-col justify-between relative overflow-hidden group shadow-xl">
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-[var(--secondary)] text-[28px]">
                  event_busy
                </span>
                <span className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20">
                  Wskaźnik anulacji
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-display text-4xl font-bold text-[var(--text-bright)]">
                  {data.cancel_rate != null ? `${data.cancel_rate}%` : "0%"}
                </h3>
                <p className="text-xs text-[var(--muted)] font-medium mt-1">
                  Anulowane przez klienta lub salon
                </p>
              </div>
            </div>
          </div>

          {/* 2-Column Section: Channel Performance & Daily Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Channel Performance */}
            <section className="lg:col-span-5 glass-panel rounded-xl p-6 shadow-2xl space-y-4">
              <div className="border-b border-glass-border pb-3">
                <h2 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">
                    hub
                  </span>
                  Efektywność kanałów
                </h2>
              </div>

              {data.by_channel.length === 0 ? (
                <p className="text-xs text-[var(--muted)] py-6 text-center">
                  Brak danych kanałowych dla tego okresu.
                </p>
              ) : (
                <div className="space-y-4 pt-2">
                  {data.by_channel.map((c) => {
                    const conf = CHANNEL_CONFIG[c.channel] || CHANNEL_CONFIG.widget;
                    const pct = Math.round((c.count / totalChannelBookings) * 100);
                    return (
                      <div key={c.channel} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-1.5 text-[var(--text-bright)]">
                            <span className={`w-2 h-2 rounded-full ${conf.color}`} />
                            {conf.label}
                          </span>
                          <span className="font-mono text-[var(--muted)]">
                            {c.count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${conf.color} transition-all duration-500`}
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Daily History Table */}
            <section className="lg:col-span-7 glass-panel rounded-xl p-6 shadow-2xl space-y-4">
              <div className="border-b border-glass-border pb-3">
                <h2 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--secondary)] text-[20px]">
                    calendar_today
                  </span>
                  Rozkład dzień po dniu
                </h2>
              </div>

              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[var(--surface-container-low)] border-b border-white/5 text-[var(--muted)] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3 text-green-400">Potwierdzone</th>
                      <th className="py-2.5 px-3 text-red-400">Anulowane</th>
                      <th className="py-2.5 px-3 text-yellow-400">No-show</th>
                      <th className="py-2.5 px-3 text-blue-400 text-right">Zakończone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.days.map((d) => (
                      <tr key={d.day} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-mono font-medium text-[var(--text-bright)]">
                          {d.day}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{d.confirmed}</td>
                        <td className="py-2.5 px-3 font-mono">{d.cancelled}</td>
                        <td className="py-2.5 px-3 font-mono">{d.no_show}</td>
                        <td className="py-2.5 px-3 font-mono text-right font-semibold">
                          {d.completed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

