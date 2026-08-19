import { useEffect, useState, useMemo } from "react";
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
    a.download = `automovia-raport-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Obliczenia do osi czasu i wykresów
  const maxDayVisits = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      ...data.days.map((d) => d.confirmed + d.cancelled + d.no_show + d.completed),
      1
    );
  }, [data]);

  const maxChannel = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.by_channel.map((c) => c.count), 1);
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Raporty</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Wizualizacja wizyt, no-show i trendów
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-glass-fill border border-glass-border p-1">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                  days === n
                    ? "bg-[var(--accent)] text-white shadow-md"
                    : "text-[var(--muted)] hover:text-[var(--text-bright)]"
                }`}
              >
                {n} dni
              </button>
            ))}
          </div>
          <GlassButton type="button" variant="ghost" onClick={exportCsv} className="!rounded-full">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            CSV
          </GlassButton>
        </div>
      </header>

      {error && <p className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

      {data && (
        <>
          {/* Główne KPI */}
          <div className="grid gap-4 sm:grid-cols-3">
            <GlassCard className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg viewBox="0 0 24 24" className="w-16 h-16" fill="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M15 2H9v4h6V2z"/></svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Suma Wizyt</p>
              <p className="mt-2 font-display text-4xl font-bold bg-gradient-to-br from-[var(--text-bright)] to-[var(--muted)] bg-clip-text text-transparent">
                {data.visits ?? 0}
              </p>
            </GlassCard>

            <GlassCard className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-purple-500">
                <svg viewBox="0 0 24 24" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">No-show Rate</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="font-display text-4xl font-bold text-purple-400">
                  {data.no_show_rate != null ? `${data.no_show_rate}%` : "—"}
                </p>
                <span className="text-xs text-[var(--muted)]">wszystkich wizyt</span>
              </div>
            </GlassCard>

            <GlassCard className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-red-500">
                <svg viewBox="0 0 24 24" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Wskaźnik Anulacji</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="font-display text-4xl font-bold text-red-400">
                  {data.cancel_rate != null ? `${data.cancel_rate}%` : "—"}
                </p>
                <span className="text-xs text-[var(--muted)]">zrezygnowało</span>
              </div>
            </GlassCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 items-stretch">
            {/* Oś Czasu (Timeline) */}
            <GlassCard className="lg:col-span-8 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <p className="font-display text-lg font-semibold">Oś Czasu (Dzień po dniu)</p>
                <div className="flex items-center gap-4 text-[10px] uppercase font-semibold text-[var(--muted)]">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Zrealizowane</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Potwierdzone</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span>No-show</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span>Anulowane</div>
                </div>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory flex-1 items-end min-h-[280px]" style={{ scrollbarWidth: 'thin' }}>
                {data.days.map((d) => {
                  const total = d.confirmed + d.cancelled + d.no_show + d.completed;
                  const hComp = (d.completed / maxDayVisits) * 100;
                  const hConf = (d.confirmed / maxDayVisits) * 100;
                  const hNoSh = (d.no_show / maxDayVisits) * 100;
                  const hCanc = (d.cancelled / maxDayVisits) * 100;
                  
                  return (
                    <div key={d.day} className="snap-center shrink-0 w-16 md:w-20 rounded-2xl bg-black/10 dark:bg-white/5 hover:bg-black/20 dark:hover:bg-white/10 transition-colors p-3 flex flex-col items-center justify-end h-full">
                      <div className="text-xs font-bold mb-2 text-[var(--text-bright)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {total}
                      </div>
                      <div className="w-full flex-1 flex flex-col justify-end gap-0.5 rounded-full overflow-hidden relative group">
                        {d.completed > 0 && <div style={{ height: `${hComp}%` }} className="bg-emerald-500 w-full transition-all duration-500 hover:brightness-110" title={`Zrealizowane: ${d.completed}`} />}
                        {d.confirmed > 0 && <div style={{ height: `${hConf}%` }} className="bg-blue-500 w-full transition-all duration-500 hover:brightness-110" title={`Potwierdzone: ${d.confirmed}`} />}
                        {d.no_show > 0 && <div style={{ height: `${hNoSh}%` }} className="bg-purple-500 w-full transition-all duration-500 hover:brightness-110" title={`No-show: ${d.no_show}`} />}
                        {d.cancelled > 0 && <div style={{ height: `${hCanc}%` }} className="bg-red-500 w-full transition-all duration-500 hover:brightness-110" title={`Anulowane: ${d.cancelled}`} />}
                      </div>
                      <div className="mt-4 text-[10px] font-mono text-[var(--muted)] rotate-[-45deg] origin-top-left -ml-2">
                        {d.day.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Wykres Kanałów */}
            <GlassCard className="lg:col-span-4 flex flex-col h-full">
              <p className="font-display text-lg font-semibold mb-6 shrink-0">Źródła wizyt</p>
              <div className="space-y-5 flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                {data.by_channel.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">Brak danych o kanałach.</p>
                )}
                {data.by_channel.map((c) => {
                  const widthPct = (c.count / maxChannel) * 100;
                  return (
                    <div key={c.channel} className="group">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-sm font-medium text-[var(--text-bright)] group-hover:text-[var(--accent)] transition-colors">{c.channel}</span>
                        <span className="font-mono text-xs font-bold">{c.count}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/5 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${widthPct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
