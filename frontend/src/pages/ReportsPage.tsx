import { useEffect, useState } from "react";
import { dashboardApi, reportsApi, staffApi } from "@/api";
import type { DashboardAnalytics, MorningSummaryPreview, StaffLeaderboardItem } from "@/api/types";
import { StaffProfileModal } from "@/components/StaffProfileModal";
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
  const [selectedStaffStatsId, setSelectedStaffStatsId] = useState<string | null>(null);

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

  const totalChannelBookings =
    data?.by_channel.reduce((sum, c) => sum + c.count, 0) || 1;

  return (
    <div className="space-y-8 animate-fade-up pb-12">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-container)] flex items-center justify-center text-white shrink-0">
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
          <span className="material-symbols-outlined text-[var(--primary)] text-[22px]">smart_toy</span>
          <h2 className="font-display text-lg font-bold text-[var(--text-bright)]">
            Centrum Raportów Automatycznych Bota AI
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD 1: DAILY MORNING BRIEFING */}
          <GlassCard className="flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface-container)] text-[var(--text-bright)] flex items-center justify-center border border-[var(--glass-border)]">
                    <span className="material-symbols-outlined text-[20px]">wb_sunny</span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
                      Poranny Briefing Dnia
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Codziennie o 08:00 rano bot wysyła podsumowanie dnia
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Bot Aktywny
                </span>
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Bot analizuje dzisiejszy grafik, oblicza szacowany przychód, uwzględnia zaplanowane przerwy/urlopy i wysyła właścicielowi przejrzystą listę wizyt.
              </p>

              {morningResultMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{morningResultMsg}</span>
                </div>
              )}

              {morningPreview && (
                <div className="p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--glass-border)] space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs border-b border-[var(--glass-border)] pb-2">
                    <span className="font-semibold text-[var(--text-bright)] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Podgląd wiadomości bota:
                    </span>
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      {morningPreview.appointments_count} wizyt · {morningPreview.total_revenue.toFixed(2)} zł
                    </span>
                  </div>
                  <pre className="text-[11px] text-[var(--text-bright)] font-sans whitespace-pre-wrap leading-relaxed">
                    {morningPreview.summary_text}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-[var(--glass-border)] flex flex-wrap items-center gap-2.5">
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
                className="text-xs !py-2"
                onClick={handleSendMorningTest}
                disabled={sendingMorning}
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                {sendingMorning ? "Wysyłanie..." : "Wyślij poranne podsumowanie (Test)"}
              </GlassButton>
            </div>
          </GlassCard>

          {/* CARD 2: EXECUTIVE GRAPHIC PDF SUMMARY */}
          <GlassCard className="flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface-container)] text-[var(--text-bright)] flex items-center justify-center border border-[var(--glass-border)]">
                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
                      Graficzny Raport PDF
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Elegancki raport biznesowy z wykresami i zestawieniem KPI
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  PDF Generator
                </span>
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Generowany automatycznie w niedzielę o 20:00. Zawiera zestawienie łącznych przychodów, współczynnik no-show, ranking najpopularniejszych usług, wyniki pracowników oraz konwersję kanałów.
              </p>

              {pdfResultMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2">
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
                      ? "border-[var(--primary)] bg-[var(--primary-container)] text-white shadow-sm"
                      : "border-[var(--glass-border)] bg-[var(--surface-container)] text-[var(--muted)] hover:text-[var(--text-bright)]"
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
                      ? "border-[var(--primary)] bg-[var(--primary-container)] text-white shadow-sm"
                      : "border-[var(--glass-border)] bg-[var(--surface-container)] text-[var(--muted)] hover:text-[var(--text-bright)]"
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

            <div className="pt-4 mt-4 border-t border-[var(--glass-border)] flex flex-wrap items-center gap-2.5">
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
                className="text-xs !py-2"
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
              Wyniki & Ranking Pracowników ({days} dni)
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
                onClick={() => setSelectedStaffStatsId(st.staff_id)}
                className="glass-panel rounded-2xl p-4 border border-[var(--glass-border)] hover:border-[var(--primary)]/50 transition-colors cursor-pointer space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {st.avatar_url ? (
                      <img
                        src={st.avatar_url}
                        alt={st.name}
                        className="w-11 h-11 min-w-[44px] max-w-[44px] min-h-[44px] max-h-[44px] rounded-xl object-cover border border-[var(--glass-border)] shadow-sm shrink-0"
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: st.color || "#3e63dd" }}
                        className="w-11 h-11 min-w-[44px] max-w-[44px] min-h-[44px] max-h-[44px] rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0 border border-white/20"
                      >
                        {initials(st.name)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-[var(--text-bright)] group-hover:text-[var(--primary)] transition-colors">
                          {st.name}
                        </h4>
                        {st.rank === 1 && st.total_revenue > 0 && (
                          <span className="material-symbols-outlined text-amber-500 text-sm">emoji_events</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--muted)]">
                        {st.appointments_count} zrealizowanych wizyt
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-[var(--text-bright)] px-2 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--glass-border)]">
                    #{st.rank}
                  </span>
                </div>

                <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">Wygenerowany obrót:</span>
                  <strong className="font-mono font-bold text-[var(--text-bright)] text-sm">
                    {st.total_revenue.toFixed(2)} zł
                  </strong>
                </div>

                <button
                  type="button"
                  className="w-full py-2 rounded-xl bg-[var(--surface-container)] group-hover:bg-[var(--primary-container)] group-hover:text-white text-[var(--text-bright)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-[var(--glass-border)] cursor-pointer"
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
            <div className="glass-panel rounded-xl p-5 flex flex-col justify-between">
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
            <div className="glass-panel rounded-xl p-5 flex flex-col justify-between">
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
            <div className="glass-panel rounded-xl p-5 flex flex-col justify-between">
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
            <section className="lg:col-span-5 glass-panel rounded-xl p-6 space-y-4">
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
            <section className="lg:col-span-7 glass-panel rounded-xl p-6 space-y-4">
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

      {/* UNIVERSAL STAFF PROFILE & STATS MODAL */}
      <StaffProfileModal
        staffId={selectedStaffStatsId}
        onClose={() => setSelectedStaffStatsId(null)}
      />
    </div>
  );
}


