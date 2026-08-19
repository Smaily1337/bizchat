import { useEffect, useState, useMemo } from "react";
import { dashboardApi } from "@/api";
import type { DashboardAnalytics } from "@/api/types";

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

  const donutStats = useMemo(() => {
    if (!data) return { pComp: 0, pConf: 0, pNoSh: 0, pCanc: 0, total: 1, completed: 0 };
    const completed = data.days.reduce((acc, d) => acc + d.completed, 0);
    const confirmed = data.days.reduce((acc, d) => acc + d.confirmed, 0);
    const no_show = data.days.reduce((acc, d) => acc + d.no_show, 0);
    const cancelled = data.days.reduce((acc, d) => acc + d.cancelled, 0);
    const total = completed + confirmed + no_show + cancelled || 1;
    return {
      completed,
      pComp: (completed / total) * 100,
      pConf: (confirmed / total) * 100,
      pNoSh: (no_show / total) * 100,
      pCanc: (cancelled / total) * 100,
      total
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-display-lg-mobile md:text-display-lg text-on-surface">Raporty</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Wizualizacja wizyt, no-show i trendów
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="glass-panel rounded-full px-4 py-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">calendar_today</span>
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                className={`px-3 py-1 text-sm font-medium rounded-full transition-all ${
                  days === n
                    ? "bg-gradient-to-r from-primary-container to-tertiary-container text-white shadow-glow"
                    : "text-on-surface-variant hover:text-white"
                }`}
              >
                {n} dni
              </button>
            ))}
          </div>
          <button type="button" onClick={exportCsv} className="glass-panel rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-on-surface hover:border-white/20 hover:shadow-glow transition-all">
            <span className="material-symbols-outlined text-sm">download</span>
            CSV
          </button>
        </div>
      </header>

      {error && <p className="text-body-md text-error bg-error-container/20 p-4 rounded-lg border border-error/20">{error}</p>}

      {data && (
        <>
          {/* Główne KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel rounded-card p-md flex flex-col gap-4 group hover:border-white/20 hover:shadow-glow transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">groups</span>
                </div>
                <div className="flex items-center gap-1 text-secondary">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                </div>
              </div>
              <div>
                <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">Suma Wizyt</p>
                <p className="font-kpi-stat text-kpi-stat text-on-surface mt-1">{data.visits ?? 0}</p>
              </div>
            </div>

            <div className="glass-panel rounded-card p-md flex flex-col gap-4 group hover:border-white/20 hover:shadow-glow transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                </div>
              </div>
              <div>
                <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">Zrealizowane</p>
                <p className="font-kpi-stat text-kpi-stat text-on-surface mt-1">
                  {donutStats.completed}
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-card p-md flex flex-col gap-4 group hover:border-white/20 hover:shadow-glow transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary">person_off</span>
                </div>
                <div className="flex items-center gap-1 text-error">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                </div>
              </div>
              <div>
                <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">No-show Rate</p>
                <p className="font-kpi-stat text-kpi-stat text-on-surface mt-1">
                  {data.no_show_rate != null ? `${data.no_show_rate}%` : "—"}
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-card p-md flex flex-col gap-4 group hover:border-white/20 hover:shadow-glow transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-error-container/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-error">cancel</span>
                </div>
              </div>
              <div>
                <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">Wskaźnik Anulacji</p>
                <p className="font-kpi-stat text-kpi-stat text-on-surface mt-1">
                  {data.cancel_rate != null ? `${data.cancel_rate}%` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Główny Wykres */}
          <div className="glass-panel rounded-[32px] p-md md:p-lg min-h-[400px] flex flex-col chart-area group hover:border-white/20 transition-all mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <h3 className="font-display text-headline-md text-on-surface">Oś Czasu (Dzień po dniu)</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-on-surface-variant">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>Zrealizowane</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span>Potwierdzone</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>No-show</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-error"></span>Anulowane</div>
              </div>
            </div>
            
            <div className="flex-1 relative flex items-end">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-full border-t border-white/5 flex-1" />
                ))}
              </div>
              
              <div className="relative flex-1 flex gap-2 sm:gap-4 overflow-x-auto pb-8 items-end h-[300px] z-10 pt-10" style={{ scrollbarWidth: 'thin' }}>
                <div className="absolute inset-0 pointer-events-none chart-line bg-gradient-to-t from-primary/20 to-transparent opacity-40" 
                     style={{
                       clipPath: `polygon(0% 100%, ${data.days.map((d, i) => {
                         const total = d.confirmed + d.cancelled + d.no_show + d.completed;
                         const h = maxDayVisits > 0 ? (total / maxDayVisits) * 100 : 0;
                         const x = data.days.length > 1 ? (i / (data.days.length - 1)) * 100 : 50;
                         return `${x}% ${100 - h}%`;
                       }).join(', ')}, 100% 100%)`
                     }}>
                </div>

                {data.days.map((d) => {
                  const total = d.confirmed + d.cancelled + d.no_show + d.completed;
                  const hComp = maxDayVisits > 0 ? (d.completed / maxDayVisits) * 100 : 0;
                  const hConf = maxDayVisits > 0 ? (d.confirmed / maxDayVisits) * 100 : 0;
                  const hNoSh = maxDayVisits > 0 ? (d.no_show / maxDayVisits) * 100 : 0;
                  const hCanc = maxDayVisits > 0 ? (d.cancelled / maxDayVisits) * 100 : 0;
                  
                  return (
                    <div key={d.day} className="relative flex-1 flex flex-col justify-end items-center group/bar min-w-[32px] h-full">
                      <div className="absolute -top-8 text-xs font-data-mono text-on-surface opacity-0 group-hover/bar:opacity-100 transition-opacity">
                        {total}
                      </div>
                      <div className="w-full flex-1 flex flex-col justify-end gap-0.5 rounded-t-sm overflow-hidden z-10 opacity-80 group-hover/bar:opacity-100 transition-opacity">
                        {d.completed > 0 && <div style={{ height: `${hComp}%` }} className="bg-secondary w-full" />}
                        {d.confirmed > 0 && <div style={{ height: `${hConf}%` }} className="bg-primary w-full" />}
                        {d.no_show > 0 && <div style={{ height: `${hNoSh}%` }} className="bg-tertiary w-full" />}
                        {d.cancelled > 0 && <div style={{ height: `${hCanc}%` }} className="bg-error w-full" />}
                      </div>
                      <div className="absolute -bottom-6 text-[10px] font-data-mono text-on-surface-variant whitespace-nowrap -rotate-45 origin-top-left">
                        {d.day.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Secondary Grid */}
          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <div className="glass-panel rounded-card p-md flex flex-col group hover:border-white/20 transition-all min-h-[300px]">
              <h3 className="font-display text-headline-md text-on-surface mb-6">Źródła wizyt</h3>
              <div className="space-y-5 flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                {data.by_channel.length === 0 && (
                  <p className="text-body-md text-on-surface-variant">Brak danych o kanałach.</p>
                )}
                {data.by_channel.map((c) => {
                  const widthPct = maxChannel > 0 ? (c.count / maxChannel) * 100 : 0;
                  return (
                    <div key={c.channel} className="group/item">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-body-md text-on-surface group-hover/item:text-primary transition-colors">{c.channel}</span>
                        <span className="font-data-mono text-data-mono text-on-surface">{c.count}</span>
                      </div>
                      <div className="h-3 rounded-full bg-surface-container overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-container to-tertiary-container rounded-full bar-fill transition-all duration-1000 ease-out" 
                          style={{ width: `${widthPct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel rounded-card p-md flex flex-col group hover:border-white/20 transition-all min-h-[300px]">
              <h3 className="font-display text-headline-md text-on-surface mb-6">Rozkład statusów</h3>
              <div className="flex-1 flex items-center justify-center py-4">
                <div className="relative w-48 h-48 rounded-full donut-segment flex items-center justify-center shadow-glow"
                     style={{
                       background: `conic-gradient(
                         var(--secondary) 0% ${donutStats.pComp}%, 
                         var(--primary) ${donutStats.pComp}% ${donutStats.pComp + donutStats.pConf}%, 
                         var(--tertiary) ${donutStats.pComp + donutStats.pConf}% ${donutStats.pComp + donutStats.pConf + donutStats.pNoSh}%, 
                         var(--danger) ${donutStats.pComp + donutStats.pConf + donutStats.pNoSh}% 100%
                       )`
                     }}>
                  <div className="absolute inset-2 rounded-full bg-[rgba(32,31,33,0.8)] backdrop-blur-xl flex flex-col items-center justify-center">
                    <span className="font-kpi-stat text-3xl text-on-surface">{donutStats.total === 1 && donutStats.completed === 0 ? 0 : data.visits}</span>
                    <span className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant mt-1">Suma</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs font-medium text-on-surface-variant">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>Zrealizowane</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span>Potwierdzone</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>No-show</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-error"></span>Anulowane</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
