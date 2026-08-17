import { useEffect, useState } from "react";
import { dashboardApi } from "@/api";
import type { DashboardAnalytics } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";

export function ReportsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void dashboardApi
      .analytics(days)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [days]);

  function exportCsv() {
    if (!data) return;
    const lines = [
      "day,confirmed,cancelled,no_show,completed",
      ...data.days.map(
        (d) =>
          `${d.day},${d.confirmed},${d.cancelled},${d.no_show},${d.completed}`,
      ),
      "",
      "channel,count",
      ...data.by_channel.map((c) => `${c.channel},${c.count}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bizchat-raport-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Raporty</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Wizyty, no-show i źródła kanałów
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((n) => (
            <GlassButton
              key={n}
              type="button"
              variant={days === n ? "primary" : "ghost"}
              className="!px-3 !py-1.5 text-xs"
              onClick={() => setDays(n)}
            >
              {n} dni
            </GlassButton>
          ))}
          <GlassButton type="button" variant="ghost" onClick={exportCsv}>
            Export CSV
          </GlassButton>
        </div>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <GlassCard>
              <p className="text-xs text-[var(--muted)]">Wizyty</p>
              <p className="mt-1 font-display text-3xl font-bold">{data.visits ?? 0}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-xs text-[var(--muted)]">No-show</p>
              <p className="mt-1 font-display text-3xl font-bold">
                {data.no_show_rate != null ? `${data.no_show_rate}%` : "—"}
              </p>
            </GlassCard>
            <GlassCard>
              <p className="text-xs text-[var(--muted)]">Anulacje</p>
              <p className="mt-1 font-display text-3xl font-bold">
                {data.cancel_rate != null ? `${data.cancel_rate}%` : "—"}
              </p>
            </GlassCard>
          </div>

          <GlassCard>
            <p className="font-display text-lg font-semibold">Kanały</p>
            <ul className="mt-3 space-y-2">
              {data.by_channel.map((c) => (
                <li
                  key={c.channel}
                  className="flex justify-between border-b border-glass-border py-2 text-sm"
                >
                  <span>{c.channel}</span>
                  <span className="font-mono">{c.count}</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <p className="font-display text-lg font-semibold">Dzień po dniu</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3">Dzień</th>
                    <th className="py-2 pr-3">OK</th>
                    <th className="py-2 pr-3">Anul.</th>
                    <th className="py-2 pr-3">No-show</th>
                    <th className="py-2">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((d) => (
                    <tr key={d.day} className="border-t border-glass-border">
                      <td className="py-2 pr-3 font-mono text-xs">{d.day}</td>
                      <td className="py-2 pr-3">{d.confirmed}</td>
                      <td className="py-2 pr-3">{d.cancelled}</td>
                      <td className="py-2 pr-3">{d.no_show}</td>
                      <td className="py-2">{d.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
