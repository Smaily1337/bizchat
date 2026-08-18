import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { useTour } from "@/tour/TourContext";

type ChannelDef = {
  id: string;
  name: string;
  licenseKeys: string[];
  summary: string;
  steps: string[];
  webhookPath: string;
  envVars: string[];
};

const CHANNELS: ChannelDef[] = [
  {
    id: "messenger",
    name: "Messenger / Instagram",
    licenseKeys: ["messenger", "instagram", "meta"],
    summary:
      "Klienci piszą do fanpage — bot umawia wizyty, a Ty odpowiadasz w Inbox lub piszesz proaktywnie z karty klienta (PSID). Reminder ma przyciski Potwierdzam / Odwołuję.",
    steps: [
      "W Meta Developers utwórz aplikację z produktem Messenger.",
      "Callback URL w Meta MUSI zawierać ?business_id=… (skopiuj pełny adres poniżej) — bez tego wiadomości nie trafią do Wiadomości.",
      "Verify token: META_VERIFY_TOKEN (domyślnie bizchat-verify — zostaw, jeśli już jest w Meta).",
      "Subskrypcje: messages, messaging_postbacks.",
      "Ustaw META_PAGE_ACCESS_TOKEN na API i zredeployuj. Opcjonalnie META_DEFAULT_BUSINESS_ID = Twój business_id.",
    ],
    webhookPath: "/webhooks/meta",
    envVars: [
      "META_PAGE_ACCESS_TOKEN",
      "META_VERIFY_TOKEN",
      "META_APP_SECRET",
      "META_DEFAULT_BUSINESS_ID",
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    licenseKeys: ["whatsapp"],
    summary:
      "WhatsApp Cloud API (Meta) — ten sam inbox i outreach co Messenger. Numer w external_ids.whatsapp.",
    steps: [
      "W Meta Business włącz WhatsApp Cloud API i skopiuj Phone Number ID.",
      "Ustaw WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN (lub page token).",
      "Webhook: URL poniżej, verify token jak Meta / WHATSAPP_VERIFY_TOKEN.",
      "Subskrypcje: messages.",
    ],
    webhookPath: "/webhooks/whatsapp",
    envVars: [
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_VERIFY_TOKEN",
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    licenseKeys: ["telegram"],
    summary:
      "Bot Telegram przyjmuje rezerwacje 24/7. Ustaw webhook BotFatherem na adres API z business_id.",
    steps: [
      "Utwórz bota w @BotFather i skopiuj token.",
      "Ustaw TELEGRAM_BOT_TOKEN w API.",
      "Zarejestruj webhook na URL poniżej (opcjonalnie TELEGRAM_WEBHOOK_SECRET).",
      "Napisz do bota /start — rozmowa pojawi się w Inbox.",
    ],
    webhookPath: "/webhooks/telegram",
    envVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
  },
  {
    id: "widget",
    name: "Widget WWW",
    licenseKeys: ["widget"],
    summary:
      "Bąbelek czatu na stronie salonu. Osadź snippet poniżej — sesja idzie przez webhook widgetu.",
    steps: [
      "Skopiuj snippet HTML z business_id.",
      "Ustaw data-api na publiczny URL API.",
      "Dodaj origin strony do CORS_ORIGINS na serwerze.",
      "Otwórz stronę i wyślij testową wiadomość.",
    ],
    webhookPath: "/webhooks/widget",
    envVars: ["CORS_ORIGINS"],
  },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setOk(true);
      window.setTimeout(() => setOk(false), 1600);
    } catch {
      setOk(false);
    }
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-soft border border-glass-border bg-black/35 px-3 py-2 font-mono text-[11px] text-frost">
          {value}
        </code>
        <GlassButton type="button" variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => void copy()}>
          {ok ? "Skopiowano" : "Kopiuj"}
        </GlassButton>
      </div>
    </div>
  );
}

function channelEnabled(
  enabled: string[] | null | undefined,
  keys: string[],
): boolean {
  if (!enabled || enabled.length === 0) return true;
  const set = new Set(enabled.map((x) => x.toLowerCase()));
  return keys.some((k) => set.has(k));
}

export function ChannelsPage() {
  const { business } = useAuth();
  const { start } = useTour();
  const businessId = business?.id || "BUSINESS_UUID";
  const enabled = business?.enabled_channels;

  const metaUrl = useMemo(
    () => `${API_BASE}/webhooks/meta?business_id=${businessId}`,
    [businessId],
  );
  const whatsappUrl = useMemo(
    () => `${API_BASE}/webhooks/whatsapp?business_id=${businessId}`,
    [businessId],
  );
  const telegramUrl = useMemo(
    () => `${API_BASE}/webhooks/telegram?business_id=${businessId}`,
    [businessId],
  );
  const widgetSnippet = useMemo(
    () =>
      `<script src="https://YOUR_CDN/automovia-widget.js"
  data-api="${API_BASE}"
  data-business-id="${businessId}"></script>`,
    [businessId],
  );

  const webhookFor = (ch: ChannelDef) => {
    if (ch.id === "messenger") return metaUrl;
    if (ch.id === "whatsapp") return whatsappUrl;
    if (ch.id === "telegram") return telegramUrl;
    return `${API_BASE}${ch.webhookPath}`;
  };

  return (
    <div className="space-y-6" data-tour="page-channels">
      <header className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Kanały</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Podłącz Messenger, Telegram i widget — tu znajdziesz webhooki,
            checklistę i snippet. Tokeny trzymasz w zmiennych środowiskowych API.
          </p>
        </div>
        <GlassButton type="button" variant="ghost" onClick={start}>
          Uruchom samouczek
        </GlassButton>
      </header>

      <GlassCard className="animate-fade-up" data-tour="channels-overview">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold">Twój salon</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {business?.name || "—"} · strefa {business?.timezone || "—"}
            </p>
          </div>
          <CopyField label="business_id" value={businessId} />
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Plan: {business?.plan || "—"} · kanały w licencji:{" "}
          {(enabled && enabled.length > 0 ? enabled : ["wszystkie"]).join(", ")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/inbox">
            <GlassButton type="button" variant="ghost" className="!px-3 !py-1.5 text-xs">
              Otwórz Inbox
            </GlassButton>
          </Link>
          <Link to="/customers">
            <GlassButton type="button" variant="ghost" className="!px-3 !py-1.5 text-xs">
              Klienci + PSID
            </GlassButton>
          </Link>
          {business?.public_slug || business?.id ? (
            <a
              href={`/book/${business.public_slug || business.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <GlassButton type="button" variant="ghost" className="!px-3 !py-1.5 text-xs">
                Publiczna rezerwacja
              </GlassButton>
            </a>
          ) : null}
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {CHANNELS.map((ch) => {
          const on = channelEnabled(enabled, ch.licenseKeys);
          return (
            <GlassCard
              key={ch.id}
              className="animate-fade-up flex flex-col"
              data-tour={`channel-${ch.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold">{ch.name}</p>
                <span
                  className={[
                    "shrink-0 rounded-control px-2 py-0.5 text-[10px] uppercase tracking-wider",
                    on
                      ? "border border-[var(--accent)]/40 text-[var(--text-bright)]"
                      : "border border-glass-border text-[var(--muted)]",
                  ].join(" ")}
                >
                  {on ? "w planie" : "poza planem"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{ch.summary}</p>
              <ol className="mt-4 list-decimal space-y-1.5 pl-4 text-xs text-[var(--muted)]">
                {ch.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="mt-4 space-y-3">
                <CopyField label="Webhook / endpoint" value={webhookFor(ch)} />
                <p className="font-mono text-[10px] text-[var(--muted)]">
                  Env: {ch.envVars.join(" · ")}
                </p>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="animate-fade-up" data-tour="channels-widget">
        <p className="font-display text-lg font-semibold">Snippet widgetu</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Wklej przed{" "}
          <code className="text-frost">&lt;/body&gt;</code> na stronie salonu.
          Lokalnie możesz też otworzyć{" "}
          <code className="text-frost">widget/index.html</code>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-soft border border-glass-border bg-black/30 p-4 text-xs text-[var(--muted)]">
          {widgetSnippet}
        </pre>
        <div className="mt-3">
          <GlassButton
            type="button"
            variant="ghost"
            className="!px-3 !py-1.5 text-xs"
            onClick={() => void navigator.clipboard.writeText(widgetSnippet)}
          >
            Kopiuj snippet
          </GlassButton>
        </div>
      </GlassCard>

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">
          Pisanie do klienta bez rozmowy
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Meta wymaga Page-Scoped ID (PSID). Pojawia się, gdy klient choć raz
          napisze do fanpage. Możesz też wkleić PSID ręcznie w{" "}
          <Link className="underline underline-offset-2" to="/customers">
            Klienci
          </Link>
          , a potem wysłać wiadomość z Inbox → „Nowa wiadomość”.
        </p>
      </GlassCard>
    </div>
  );
}
