import { useEffect, useState } from "react";
import { dashboardApi, reportsApi, staffApi } from "@/api";
import type { DashboardAnalytics, MorningSummaryPreview, StaffLeaderboardItem, StaffStats } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

const CHANNEL_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  messenger: { label: "Messenger", icon: "chat", color: "bg-[#0084FF]" },
  instagram: { label: "Instagram", icon: "photo_camera", color: "bg-[#E1306C]" },
  telegram: { label: "Telegram", icon: "send", color: "bg-[#229ED9]" },
  whatsapp: { label: "WhatsApp", icon: "phone_iphone", color: "bg-[#25D366]" },
  widget: { label: "Widget WWW", icon: "language", color: "bg-[var(--accent)]" },
  direct: { label: "Bezpośrednio", icon: "store", color: "bg-[var(--secondary)]" },
};

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

export function ReportsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [staffLeaderboard, setStaffLeaderboard] = useState<StaffLeaderboardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bot Reports State
  const [morningPreview, setMorningPreview] = useState<MorningSummaryPreview | null>(null);
  const [loadingMorning, setLoadingMorning] = useState(false);
  const [sendingMorning, setSendingMorning] = useState(false);
  const [morningResultMsg, setMorningResultMsg] = useState<string | null>(null);

  const [pdfPeriod, setPdfPeriod] = useState<"week" | "month">("week");
  const [customPdfEmail, setCustomPdfEmail] = useState("");
  const [sendingPdf, setSendingPdf] = useState(false);
  const [pdfResultMsg, setPdfResultMsg] = useState<string | null>(null);

  // Staff Stats Modal in Reports
  const [selectedStaffStats, setSelectedStaffStats] = useState<StaffStats | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(40);
  const [staffApptSearch, setStaffApptSearch] = useState("");
  const [staffApptStatus, setStaffApptStatus] = useState("all");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dashboardApi.analytics(days),
      staffApi.overviewStats(days).catch(() => []),
    ])
      .then(([analData, staffLead]) => {
        setData(analData);
        setStaffLeaderboard(staffLead);
      })
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

  async function loadMorningPreview() {
    setLoadingMorning(true);
    setMorningResultMsg(null);
    try {
      const res = await reportsApi.previewMorningSummary();
      setMorningPreview(res);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd pobierania podglądu");
    } finally {
      setLoadingMorning(false);
    }
  }

  async function handleSendMorningTest() {
    setSendingMorning(true);
    setMorningResultMsg(null);
    try {
      const res = await reportsApi.sendMorningSummary();
      setMorningResultMsg(res.message || "Poranny briefing został pomyślnie wysłany!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd wysyłki podsumowania");
    } finally {
      setSendingMorning(false);
    }
  }

  async function handleSendPdfTest() {
    setSendingPdf(true);
    setPdfResultMsg(null);
    try {
      const res = await reportsApi.sendPdfReport({
        period: pdfPeriod,
        target_email: customPdfEmail.trim() || undefined,
      });
      setPdfResultMsg(res.message || "Raport PDF został pomyślnie wysłany!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd wysyłki raportu PDF");
    } finally {
      setSendingPdf(false);
    }
  }

  async function openStaffDetailStats(staffId: string) {
    try {
      const stData = await staffApi.stats(staffId, days);
      setSelectedStaffStats(stData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd pobierania statystyk pracownika");
    }
  }

  const totalChannelBookings =
    data?.by_channel.reduce((sum, c) => sum + c.count, 0) || 1;

  const filteredStaffAppointments = (selectedStaffStats?.appointments || []).filter((a) => {
    const matchesSearch =
      !staffApptSearch.trim() ||
      a.customer_name.toLowerCase().includes(staffApptSearch.toLowerCase()) ||
      a.service_name.toLowerCase().includes(staffApptSearch.toLowerCase()) ||
      (a.customer_phone && a.customer_phone.includes(staffApptSearch));
    const matchesStatus =
      staffApptStatus === "all" || a.status === staffApptStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-up pb-12">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">analytics</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Raporty & Statystyki AI
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Automatyczne briefingi bota, graficzne raporty PDF, ranking pracowników i analityka
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
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
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

      {/* EXECUTIVE AI BOT REPORTS SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-[22px]">smart_toy</span>
          <h2 className="font-display text-lg font-bold text-[var(--text-bright)]">
            Centrum Raportów Automatycznych Bota AI
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD 1: DAILY MORNING BRIEFING */}
          <GlassCard className="border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-[var(--surface-solid)] to-transparent shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">wb_sunny</span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
                      ☀️ Poranny Briefing Dnia
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Codziennie o 08:00 rano bot wysyła podsumowanie dnia
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Bot Aktywny
                </span>
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Bot analizuje dzisiejszy grafik, oblicza szacowany przychód, uwzględnia zaplanowane przerwy/urlopy i wysyła właścicielowi przejrzystą listę wizyt.
              </p>

              {morningResultMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{morningResultMsg}</span>
                </div>
              )}

              {morningPreview && (
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                    <span className="font-semibold text-amber-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Podgląd dzisiejszej wiadomości bota:
                    </span>
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      {morningPreview.appointments_count} wizyt · {morningPreview.total_revenue.toFixed(2)} zł
                    </span>
                  </div>
                  <pre className="text-[11px] text-gray-200 font-sans whitespace-pre-wrap leading-relaxed">
                    {morningPreview.summary_text}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-white/10 flex flex-wrap items-center gap-2.5">
              <GlassButton
                variant="ghost"
                className="text-xs !py-2"
                onClick={loadMorningPreview}
                disabled={loadingMorning}
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                {loadingMorning ? "Ładowanie..." : morningPreview ? "Odśwież podgląd" : "Zobacz podgląd briefingu"}
              </GlassButton>
              <GlassButton
                variant="primary"
                className="text-xs !py-2 !border-amber-500/50 !bg-gradient-to-r from-amber-500 to-amber-600 !text-white"
                onClick={handleSendMorningTest}
                disabled={sendingMorning}
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                {sendingMorning ? "Wysyłanie..." : "Wyślij poranne podsumowanie (Test)"}
              </GlassButton>
            </div>
          </GlassCard>

          {/* CARD 2: EXECUTIVE GRAPHIC PDF SUMMARY */}
          <GlassCard className="border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-[var(--surface-solid)] to-transparent shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
                      📊 Graficzny Raport PDF
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Elegancki raport biznesowy z wykresami i zestawieniem KPI
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  PDF Generator
                </span>
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Generowany automatycznie w niedzielę o 20:00. Zawiera zestawienie łącznych przychodów, współczynnik no-show, ranking najpopularniejszych usług, wyniki pracowników oraz konwersję kanałów.
              </p>

              {pdfResultMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{pdfResultMsg}</span>
                </div>
              )}

              {/* Period selection for PDF */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPdfPeriod("week")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    pdfPeriod === "week"
                      ? "border-indigo-500/80 bg-indigo-500/20 text-white shadow"
                      : "border-white/10 bg-black/20 text-[var(--muted)] hover:border-white/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">date_range</span>
                  <span>Raport Tygodniowy (7 dni)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPeriod("month")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    pdfPeriod === "month"
                      ? "border-indigo-500/80 bg-indigo-500/20 text-white shadow"
                      : "border-white/10 bg-black/20 text-[var(--muted)] hover:border-white/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">calendar_month</span>
                  <span>Raport Miesięczny (30 dni)</span>
                </button>
              </div>

              {/* Optional custom email */}
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                  Opcjonalny adres e-mail do testu (domyślnie e-mail właściciela):
                </label>
                <GlassInput
                  placeholder="np. szef@twojsalon.pl"
                  value={customPdfEmail}
                  onChange={(e) => setCustomPdfEmail(e.target.value)}
                  className="!text-xs !py-1.5"
                />
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-white/10 flex flex-wrap items-center gap-2.5">
              <a
                href={reportsApi.downloadPdfUrl(pdfPeriod)}
                target="_blank"
                rel="noreferrer"
                className="inline-block"
              >
                <GlassButton variant="ghost" className="text-xs !py-2">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Pobierz PDF ({pdfPeriod === "week" ? "Tydzień" : "Miesiąc"})
                </GlassButton>
              </a>
              <GlassButton
                variant="primary"
                className="text-xs !py-2 !border-indigo-500/50 !bg-gradient-to-r from-indigo-500 to-indigo-600 !text-white"
                onClick={handleSendPdfTest}
                disabled={sendingPdf}
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                {sendingPdf ? "Generowanie i wysyłka..." : "Wyślij PDF na e-mail (Test)"}
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* STAFF PERFORMANCE & LEADERBOARD SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary)] text-[22px]">badge</span>
            <h2 className="font-display text-lg font-bold text-[var(--text-bright)]">
              👥 Wyniki & Ranking Pracowników ({days} dni)
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)] hidden sm:block">
            Kliknij na pracownika, aby sprawdzić historię wykonanych usług i kalkulator prowizji
          </p>
        </div>

        {staffLeaderboard.length === 0 ? (
          <div className="glass-panel p-6 rounded-2xl text-center text-xs text-[var(--muted)]">
            Brak zdefiniowanych pracowników lub danych o wizytach w tym okresie.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffLeaderboard.map((st) => (
              <div
                key={st.staff_id}
                onClick={() => void openStaffDetailStats(st.staff_id)}
                className="glass-panel rounded-2xl p-4 border border-[var(--glass-border)] hover:border-amber-400/50 transition-all hover:scale-[1.01] cursor-pointer shadow-lg space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {st.avatar_url ? (
                      <img
                        src={st.avatar_url}
                        alt={st.name}
                        className="w-11 h-11 rounded-xl object-cover border border-white/20 shadow shrink-0"
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: st.color || "#3e63dd" }}
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow shrink-0"
                      >
                        {initials(st.name)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-[var(--text-bright)] group-hover:text-amber-300 transition-colors">
                          {st.name}
                        </h4>
                        {st.rank === 1 && st.total_revenue > 0 && (
                          <span className="material-symbols-outlined text-amber-400 text-sm">emoji_events</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--muted)]">
                        {st.appointments_count} zrealizowanych wizyt
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-amber-300 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    #{st.rank}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">Wygenerowany obrót:</span>
                  <strong className="font-mono text-amber-300 text-sm">
                    {st.total_revenue.toFixed(2)} zł
                  </strong>
                </div>

                <button
                  type="button"
                  className="w-full py-1.5 rounded-lg bg-white/5 group-hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">bar_chart</span>
                  Zobacz szczegółowe statystyki →
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

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
          <div className="flex items-center gap-2 pt-2">
            <span className="material-symbols-outlined text-[var(--primary)] text-[22px]">bar_chart</span>
            <h2 className="font-display text-lg font-bold text-[var(--text-bright)]">
              Analityka Rezerwacji na Żywo ({days} dni)
            </h2>
          </div>

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

      {/* STAFF DETAILS & HISTORY MODAL IN REPORTS */}
      {selectedStaffStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="glass-panel p-6 rounded-3xl max-w-4xl w-full border border-white/20 shadow-2xl space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                {selectedStaffStats.avatar_url ? (
                  <img
                    src={selectedStaffStats.avatar_url}
                    alt={selectedStaffStats.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow-lg shrink-0"
                  />
                ) : (
                  <div
                    style={{ backgroundColor: selectedStaffStats.color || "#3e63dd" }}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-lg shrink-0 border border-white/20"
                  >
                    {initials(selectedStaffStats.name)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-[var(--text-bright)]">
                      {selectedStaffStats.name}
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Specjalista
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Szczegółowy bilans wykonanych usług ({days} dni), kalkulator prowizji i historia wizyt
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStaffStats(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[var(--muted)] hover:text-white flex items-center justify-center text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* 4-KPI Bento Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                  <p className="text-[11px] text-[var(--muted)] font-medium">Wygenerowany Obrót</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-300">
                    {selectedStaffStats.total_revenue.toFixed(2)} zł
                  </p>
                  <p className="text-[10px] text-amber-200/70">Łącznie za usługi</p>
                </div>

                <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                  <p className="text-[11px] text-[var(--muted)] font-medium">Zrealizowane Wizyty</p>
                  <p className="text-xl sm:text-2xl font-bold text-[var(--text-bright)]">
                    {selectedStaffStats.completed_count + selectedStaffStats.confirmed_count}{" "}
                    <span className="text-xs font-normal text-[var(--muted)]">/ {selectedStaffStats.total_appointments}</span>
                  </p>
                  <p className="text-[10px] text-green-400">
                    {selectedStaffStats.total_appointments > 0
                      ? `${Math.round(((selectedStaffStats.completed_count + selectedStaffStats.confirmed_count) / selectedStaffStats.total_appointments) * 100)}% realizacji`
                      : "Brak wizyt"}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                  <p className="text-[11px] text-[var(--muted)] font-medium">Średni Koszyk (AOV)</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-300">
                    {selectedStaffStats.avg_ticket.toFixed(2)} zł
                  </p>
                  <p className="text-[10px] text-blue-200/70">Średnio na wizycie</p>
                </div>

                <div className="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-1">
                  <p className="text-[11px] text-[var(--muted)] font-medium">Czas Zabiegów</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-300">
                    {selectedStaffStats.total_hours_worked} godz.
                  </p>
                  <p className="text-[10px] text-purple-200/70">
                    {selectedStaffStats.unique_customers_count} unikalnych klientów
                  </p>
                </div>
              </div>

              {/* Commission Calculator */}
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
                      {selectedStaffStats.total_revenue.toFixed(2)} zł
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                    <span className="text-emerald-300/80 block">Wypłata dla pracownika ({commissionRate}%):</span>
                    <strong className="text-sm font-bold text-emerald-300">
                      {((selectedStaffStats.total_revenue * commissionRate) / 100).toFixed(2)} zł
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 col-span-2 sm:col-span-1">
                    <span className="text-indigo-300/80 block">Zysk salonu po prowizji:</span>
                    <strong className="text-sm font-bold text-indigo-300">
                      {((selectedStaffStats.total_revenue * (100 - commissionRate)) / 100).toFixed(2)} zł
                    </strong>
                  </div>
                </div>
              </div>

              {/* Services Breakdown */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-[var(--text-bright)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">
                    content_cut
                  </span>
                  Zestawienie Wykonywanych Usług
                </h3>

                {selectedStaffStats.services_breakdown.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-4 text-center">
                    Brak zrealizowanych usług w wybranym okresie.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedStaffStats.services_breakdown.map((svc) => {
                      const pct = Math.round((svc.total_revenue / (selectedStaffStats.total_revenue || 1)) * 100);
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

              {/* History Table */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <h3 className="font-display text-sm font-bold text-[var(--text-bright)] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[var(--secondary)]">
                      history
                    </span>
                    Dziennik Aktywności & Historia Wizyt ({filteredStaffAppointments.length})
                  </h3>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Szukaj klienta / usługi..."
                      value={staffApptSearch}
                      onChange={(e) => setStaffApptSearch(e.target.value)}
                      className="bg-[var(--surface-container)] border border-glass-border rounded-lg px-2.5 py-1 text-xs text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:outline-none"
                    />
                    <select
                      value={staffApptStatus}
                      onChange={(e) => setStaffApptStatus(e.target.value)}
                      className="bg-[var(--surface-container)] border border-glass-border rounded-lg px-2.5 py-1 text-xs text-[var(--text-bright)] focus:outline-none"
                    >
                      <option value="all">Wszystkie statusy</option>
                      <option value="completed">Zakończone</option>
                      <option value="confirmed">Potwierdzone</option>
                      <option value="pending">Oczekujące</option>
                      <option value="cancelled">Anulowane</option>
                      <option value="no_show">No-Show</option>
                    </select>
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
                      {filteredStaffAppointments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-[var(--muted)]">
                            Brak wizyt spełniających kryteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStaffAppointments.map((a) => {
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
          </div>
        </div>
      )}
    </div>
  );
}


