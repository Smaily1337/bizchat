import { useAuth } from "@/auth/AuthContext";
import { GlassCard } from "@/components/ui";

export function ChannelsPage() {
  const { business } = useAuth();

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Kanały</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Konfiguracja webhooków — tokeny w zmiennych środowiskowych
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            name: "Telegram",
            hint: "TELEGRAM_BOT_TOKEN + webhook POST /webhooks/telegram",
          },
          {
            name: "Meta (Messenger / IG)",
            hint: "META_PAGE_ACCESS_TOKEN · verify GET /webhooks/meta",
          },
          {
            name: "Widget WWW",
            hint: "POST /webhooks/widget/session + /webhooks/widget",
          },
        ].map((ch) => (
          <GlassCard key={ch.name} className="animate-fade-up">
            <p className="font-display text-lg font-semibold">{ch.name}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{ch.hint}</p>
            <p className="mt-4 font-mono text-xs text-[var(--muted)]">
              business_id: {business?.id || "—"}
            </p>
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        <p className="font-display text-base font-semibold">Snippet widgetu</p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-black/30 p-4 text-xs text-[var(--muted)]">
{`<script src="https://YOUR_CDN/bizchat-widget.js"
  data-api="http://localhost:8000"
  data-business-id="${business?.id || "BUSINESS_UUID"}"></script>`}
        </pre>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Lokalnie otwórz <code className="text-[var(--text)]">widget/index.html</code> i
          wklej business_id z seeda / panelu.
        </p>
      </GlassCard>
    </div>
  );
}
