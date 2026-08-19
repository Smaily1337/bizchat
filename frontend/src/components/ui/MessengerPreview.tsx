import React from "react";

interface MessengerPreviewProps {
  body?: string;
  salonName?: string;
  customerName?: string;
  serviceName?: string;
  dateStr?: string;
  timeStr?: string;
  priceStr?: string;
  showQuickReplies?: boolean;
  className?: string;
}

export function formatTemplateText(
  raw?: string | null,
  sample: {
    klient?: string;
    usluga?: string;
    data?: string;
    godzina?: string;
    cena?: string;
    firma?: string;
  } = {}
): string {
  if (!raw) return "";
  const defaults = {
    klient: sample.klient || "Anna Kowalska",
    usluga: sample.usluga || "Strzyżenie & Modelowanie",
    data: sample.data || "25.08.2026",
    godzina: sample.godzina || "14:30",
    cena: sample.cena || "160 PLN",
    firma: sample.firma || "Studio Urody Automovia",
  };

  let res = String(raw);
  for (const [k, v] of Object.entries(defaults)) {
    const reg = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi");
    res = res.replace(reg, String(v || ""));
  }
  return res;
}

export const MessengerPreview: React.FC<MessengerPreviewProps> = ({
  body = "",
  salonName = "Automovia Salon",
  customerName = "Anna Kowalska",
  serviceName = "Strzyżenie & Modelowanie",
  dateStr = "Jutro (25.08)",
  timeStr = "14:30",
  priceStr = "160 PLN",
  showQuickReplies = true,
  className = "",
}) => {
  const safeSalonName = String(salonName || "Automovia Salon");
  const avatarLetter = (safeSalonName.trim()[0] || "A").toUpperCase();
  const renderedText = formatTemplateText(body, {
    firma: safeSalonName,
    klient: customerName,
    usluga: serviceName,
    data: dateStr,
    godzina: timeStr,
    cena: priceStr,
  });

  const isReminder = body ? /przypom|wizyt|potwierd|termin/i.test(String(body)) : false;

  return (
    <div
      className={`relative mx-auto w-full max-w-[380px] overflow-hidden rounded-[28px] border border-glass-border bg-[var(--surface-solid)]/90 shadow-2xl backdrop-blur-md ${className}`}
      style={{
        boxShadow:
          "0 20px 40px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--glass-border)",
      }}
    >
      {/* Messenger Header */}
      <div className="flex items-center justify-between border-b border-glass-border/60 bg-glass-fill px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#0084FF] to-[#00C6FF] text-white shadow-md">
            <span className="font-display text-sm font-bold tracking-tight">
              {avatarLetter}
            </span>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--surface-solid)] bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm leading-tight text-[var(--text-bright)]">
                {salonName}
              </p>
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 fill-[#0084FF]"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              Messenger · Aktywny(a) teraz
            </p>
          </div>
        </div>

        {/* Messenger Action Icons Mock */}
        <div className="flex items-center gap-2 text-[#0084FF]">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 hover:bg-blue-500/20"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex min-h-[220px] flex-col justify-between p-4">
        <div>
          {/* Timestamp Pill */}
          <div className="mb-4 text-center">
            <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--muted)] dark:bg-white/10">
              DZISIAJ 14:30
            </span>
          </div>

          {/* Message Bubble Row */}
          <div className="flex items-end gap-2">
            <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-tr from-[#0084FF] to-[#00C6FF] text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
              {avatarLetter}
            </div>

            <div className="max-w-[85%] space-y-1">
              <div
                className="relative overflow-hidden rounded-[20px] rounded-bl-[4px] bg-gradient-to-br from-[#0084FF] via-[#0078FF] to-[#0099FF] px-4 py-3 text-[13.5px] leading-relaxed text-white shadow-md transition-all"
                style={{
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {renderedText || (
                  <span className="italic opacity-60">
                    Wpisz treść szablonu, aby zobaczyć podgląd na żywo…
                  </span>
                )}
              </div>

              {/* Status / Timestamp */}
              <div className="flex items-center justify-end gap-1 px-1 text-[10px] text-[var(--muted)]">
                <span>Dostarczono</span>
                <svg className="h-3 w-3 text-[#0084FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Quick Replies for Reminders / Bot actions */}
          {showQuickReplies && isReminder && (
            <div className="mt-3.5 flex flex-wrap justify-end gap-1.5 pl-8">
              <div className="rounded-full border border-[#0084FF]/40 bg-[#0084FF]/10 px-3 py-1 text-[11px] font-medium text-[#0084FF] transition hover:bg-[#0084FF]/20">
                ✅ Potwierdzam
              </div>
              <div className="rounded-full border border-glass-border bg-glass-fill px-3 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--text-bright)]">
                📅 Zmień termin
              </div>
              <div className="rounded-full border border-glass-border bg-glass-fill px-3 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-red-400">
                ❌ Odwołaj
              </div>
            </div>
          )}
        </div>

        {/* Messenger Input Simulation Bar */}
        <div className="mt-4 flex items-center gap-2 rounded-full border border-glass-border bg-glass-fill px-3 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-[#0084FF]">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
          <span className="flex-1 text-xs text-[var(--muted)]">
            Napisz wiadomość…
          </span>
          <div className="text-[#0084FF]">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
