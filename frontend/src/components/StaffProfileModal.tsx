import { useEffect, useState } from "react";
import { staffApi } from "@/api";
import type { StaffMember, StaffStats } from "@/api/types";
import { GlassButton } from "@/components/ui";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  completed: { label: "Zakończona", bg: "bg-green-500/15", text: "text-green-300 border-green-500/30" },
  confirmed: { label: "Potwierdzona", bg: "bg-blue-500/15", text: "text-blue-300 border-blue-500/30" },
  pending: { label: "Oczekuje", bg: "bg-amber-500/15", text: "text-amber-300 border-amber-500/30" },
  cancelled: { label: "Anulowana", bg: "bg-red-500/15", text: "text-red-300 border-red-500/30" },
  no_show: { label: "Nieobecność", bg: "bg-purple-500/15", text: "text-purple-300 border-purple-500/30" },
};

function initials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface StaffProfileModalProps {
  staffId: string | null;
  initialStaff?: StaffMember | null;
  onClose: () => void;
}

export function StaffProfileModal({ staffId, initialStaff, onClose }: StaffProfileModalProps) {
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [periodDays, setPeriodDays] = useState<number | undefined>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(40);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    staffApi
      .stats(staffId, periodDays)
      .then(setStats)
      .catch((err: Error) => setError(err.message || "Błąd pobierania statystyk"))
      .finally(() => setLoading(false));
  }, [staffId, periodDays]);

  if (!staffId) return null;

  const staffName = stats?.name || initialStaff?.name || "Pracownik";
  const avatarUrl = stats?.avatar_url || initialStaff?.avatar_url;
  const color = stats?.color || initialStaff?.color || "#3e63dd";
  const isActive = stats ? stats.is_active : (initialStaff?.is_active ?? true);

  function exportCsv() {
    if (!stats) return;
    const lines = [
      `Raport i Historia Wizyt Pracownika: ${stats.name}`,
      `Okres: ${periodDays ? `Ostatnie ${periodDays} dni` : "Wszystkie wizyty"}`,
      `Wygenerowany obrót brutto: ${stats.total_revenue.toFixed(2)} zł`,
      `Prowizja (${commissionRate}%): ${((stats.total_revenue * commissionRate) / 100).toFixed(2)} zł`,
      "",
      "Data,Godzina,Klient,Telefon,Usługa,Cena (PLN),Status,Notatki",
      ...stats.appointments.map((a) => {
        const d = new Date(a.start_at);
        const dateStr = d.toLocaleDateString("pl-PL");
        const timeStr = `${d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} - ${new Date(a.end_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
        return `"${dateStr}","${timeStr}","${a.customer_name}","${a.customer_phone || ""}","${a.service_name}",${a.service_price.toFixed(2)},"${STATUS_MAP[a.status]?.label || a.status}","${(a.notes || "").replace(/"/g, '""')}"`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-${staffName.replace(/\s+/g, "_")}-${periodDays || "all"}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredAppointments = (stats?.appointments || []).filter((a) => {
    const matchesSearch =
      !search.trim() ||
      a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      a.service_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.customer_phone && a.customer_phone.includes(search));
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="glass-panel p-6 rounded-3xl max-w-4xl w-full border border-white/20 shadow-2xl space-y-6 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={staffName}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow-lg shrink-0"
              />
            ) : (
              <div
                style={{ backgroundColor: color }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-lg shrink-0 border border-white/20"
              >
                {initials(staffName)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-[var(--text-bright)]">
                  {staffName}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                  }`}
                >
                  {isActive ? "Aktywny w grafiku" : "Nieaktywny"}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Profil specjalisty, statystyki obrotu, historia zrealizowanych wizyt i prowizje
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex rounded-lg border border-glass-border bg-[var(--surface-container)] p-1 text-xs">
              {[
                { label: "7 dni", days: 7 },
                { label: "30 dni", days: 30 },
                { label: "90 dni", days: 90 },
                { label: "Wszystko", days: undefined },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPeriodDays(p.days)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    periodDays === p.days
                      ? "bg-[var(--primary-container)] text-white shadow"
                      : "text-[var(--muted)] hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[var(--muted)] hover:text-white flex items-center justify-center text-lg leading-none cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-xs text-[var(--muted)] animate-pulse">
            Ładowanie danych pracownika...
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* 4-KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                <p className="text-[11px] text-[var(--muted)] font-medium">Wygenerowany Obrót</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-300">
                  {stats.total_revenue.toFixed(2)} zł
                </p>
                <p className="text-[10px] text-amber-200/70">Łącznie za usługi</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                <p className="text-[11px] text-[var(--muted)] font-medium">Zrealizowane Wizyty</p>
                <p className="text-xl sm:text-2xl font-bold text-[var(--text-bright)]">
                  {stats.completed_count + stats.confirmed_count}{" "}
                  <span className="text-xs font-normal text-[var(--muted)]">/ {stats.total_appointments}</span>
                </p>
                <p className="text-[10px] text-green-400">
                  {stats.total_appointments > 0
                    ? `${Math.round(((stats.completed_count + stats.confirmed_count) / stats.total_appointments) * 100)}% realizacji`
                    : "Brak wizyt"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                <p className="text-[11px] text-[var(--muted)] font-medium">Średni Koszyk (AOV)</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-300">
                  {stats.avg_ticket.toFixed(2)} zł
                </p>
                <p className="text-[10px] text-blue-200/70">Średnio na wizycie</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                <p className="text-[11px] text-[var(--muted)] font-medium">Czas Zabiegów</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-300">
                  {stats.total_hours_worked} godz.
                </p>
                <p className="text-[10px] text-purple-200/70">
                  {stats.unique_customers_count} unikalnych klientów
                </p>
              </div>
            </div>

            {/* COMMISSION CALCULATOR */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent border border-amber-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <span className="material-symbols-outlined text-[20px]">calculate</span>
                  <span>Kalkulator Prowizji i Wypłaty Pracownika</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[30, 40, 50, 60].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setCommissionRate(rate)}
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                        commissionRate === rate
                          ? "bg-amber-500 text-black font-bold"
                          : "bg-white/5 text-[var(--muted)] hover:text-white"
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <span className="font-mono font-bold text-amber-300 text-sm shrink-0 w-12 text-right">
                  {commissionRate}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
                  <span className="text-[var(--muted)] block">Obrót brutto:</span>
                  <strong className="text-sm font-bold text-white">
                    {stats.total_revenue.toFixed(2)} zł
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                  <span className="text-emerald-300/80 block">Wypłata dla pracownika ({commissionRate}%):</span>
                  <strong className="text-sm font-bold text-emerald-300">
                    {((stats.total_revenue * commissionRate) / 100).toFixed(2)} zł
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 col-span-2 sm:col-span-1">
                  <span className="text-indigo-300/80 block">Zysk salonu po prowizji:</span>
                  <strong className="text-sm font-bold text-indigo-300">
                    {((stats.total_revenue * (100 - commissionRate)) / 100).toFixed(2)} zł
                  </strong>
                </div>
              </div>
            </div>

            {/* SERVICES BREAKDOWN */}
            <div className="space-y-3">
              <h3 className="font-display text-sm font-bold text-[var(--text-bright)] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">
                  content_cut
                </span>
                Zestawienie Wykonywanych Usług w Okresie
              </h3>

              {stats.services_breakdown.length === 0 ? (
                <p className="text-xs text-[var(--muted)] py-4 text-center">
                  Brak zrealizowanych usług w wybranym okresie.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {stats.services_breakdown.map((svc) => {
                    const pct = Math.round((svc.total_revenue / (stats.total_revenue || 1)) * 100);
                    return (
                      <div
                        key={svc.service_name}
                        className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--text-bright)] truncate pr-2">
                            {svc.service_name}
                          </span>
                          <span className="font-mono text-amber-300 shrink-0">
                            {svc.total_revenue.toFixed(2)} zł
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
                          <span>Wykonano: {svc.count} razy</span>
                          <span>Średnio: {svc.avg_price.toFixed(2)} zł / zabieg</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DETAILED APPOINTMENT HISTORY LOG */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <h3 className="font-display text-sm font-bold text-[var(--text-bright)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[var(--secondary)]">
                    history
                  </span>
                  Dziennik Aktywności & Historia Wizyt ({filteredAppointments.length})
                </h3>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Szukaj klienta / usługi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-[var(--surface-container)] border border-glass-border rounded-lg px-2.5 py-1 text-xs text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:outline-none"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[var(--surface-container)] border border-glass-border rounded-lg px-2.5 py-1 text-xs text-[var(--text-bright)] focus:outline-none"
                  >
                    <option value="all">Wszystkie statusy</option>
                    <option value="completed">Zakończone</option>
                    <option value="confirmed">Potwierdzone</option>
                    <option value="pending">Oczekujące</option>
                    <option value="cancelled">Anulowane</option>
                    <option value="no_show">No-Show</option>
                  </select>
                  <GlassButton
                    variant="ghost"
                    className="!text-xs !py-1 !px-2"
                    onClick={exportCsv}
                    title="Eksportuj historię do pliku CSV"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    CSV
                  </GlassButton>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-xl border border-white/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[var(--surface-container-low)] border-b border-white/10 text-[var(--muted)] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Data i Czas</th>
                      <th className="py-2.5 px-3">Klient</th>
                      <th className="py-2.5 px-3">Usługa</th>
                      <th className="py-2.5 px-3">Kwota</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Notatki</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--muted)]">
                          Brak wizyt spełniających kryteria.
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((a) => {
                        const d = new Date(a.start_at);
                        const st = STATUS_MAP[a.status] || {
                          label: a.status,
                          bg: "bg-white/5",
                          text: "text-white border-white/10",
                        };
                        return (
                          <tr key={a.id} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-mono font-medium text-[var(--text-bright)] whitespace-nowrap">
                              {d.toLocaleDateString("pl-PL")}{" "}
                              <span className="text-[var(--muted)]">
                                {d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[var(--text-bright)]">
                              <p>{a.customer_name}</p>
                              {a.customer_phone && (
                                <a
                                  href={`tel:${a.customer_phone}`}
                                  className="text-[10px] text-canary hover:underline"
                                >
                                  {a.customer_phone}
                                </a>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[var(--text-bright)]">
                              {a.service_name}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                              {a.service_price.toFixed(2)} zł
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${st.bg} ${st.text}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-[var(--muted)] max-w-[160px] truncate" title={a.notes || ""}>
                              {a.notes || "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
