import { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { channelsApi } from "@/api";
import { API_BASE } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { GlassButton, GlassCard } from "@/components/ui";
import { useTour } from "@/tour/TourContext";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any;
  }
}

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

function initFb(appId: string) {
  if (typeof window !== "undefined" && window.FB && typeof window.FB.init === "function") {
    try {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      return true;
    } catch (err) {
      console.warn("FB.init error:", err);
    }
  }
  return false;
}

function loadFacebookSdk(appId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.FB && typeof window.FB.login === "function") {
      initFb(appId);
      return resolve(window.FB);
    }

    window.fbAsyncInit = function () {
      initFb(appId);
      resolve(window.FB);
    };

    if (document.getElementById("facebook-jssdk")) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.FB && typeof window.FB.login === "function") {
          clearInterval(interval);
          initFb(appId);
          resolve(window.FB);
        } else if (attempts > 50) {
          clearInterval(interval);
          reject(new Error("Nie udało się zainicjalizować SDK Facebooka (timeout)."));
        }
      }, 100);
      return;
    }

    const js = document.createElement("script");
    js.id = "facebook-jssdk";
    js.src = "https://connect.facebook.net/pl_PL/sdk.js";
    js.async = true;
    js.defer = true;
    js.onerror = () => reject(new Error("Nie udało się pobrać skryptu Facebook SDK."));
    document.body.appendChild(js);
  });
}

function ChannelCard({ 
  ch, 
  on, 
  webhookUrl, 
  widgetSnippet 
}: { 
  ch: ChannelDef; 
  on: boolean; 
  webhookUrl: string; 
  widgetSnippet?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <GlassCard className="animate-fade-up flex flex-col" data-tour={`channel-${ch.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-semibold">{ch.name}</p>
          <span
            className={[
              "w-fit rounded-control px-2 py-0.5 text-[10px] uppercase tracking-wider",
              on
                ? "border border-[var(--accent)]/40 text-[var(--text-bright)] bg-[var(--accent-soft)]"
                : "border border-glass-border text-[var(--muted)]",
            ].join(" ")}
          >
            {on ? "w planie" : "poza planem"}
          </span>
        </div>
        <GlassButton
          type="button"
          variant={expanded ? "ghost" : "subtle"}
          className="!px-3 !py-1.5 text-xs shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Zwiń" : "Instrukcja"}
        </GlassButton>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">{ch.summary}</p>
      
      {expanded && (
        <div className="mt-4 animate-fade-in space-y-5 border-t border-glass-border pt-5">
          <ol className="list-decimal space-y-2 pl-4 text-xs text-[var(--muted)]">
            {ch.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {ch.id === "messenger" && (
            <div className="rounded-soft border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-3 text-xs text-[var(--text-bright)]">
              <strong>Wskazówka (PSID):</strong> Aby napisać do klienta z którym nie rozmawiałeś, potrzebujesz jego ID ze strony (Page-Scoped ID). Wygeneruje się ono automatycznie, gdy klient po raz pierwszy do Ciebie napisze.
            </div>
          )}
          {ch.id === "widget" && widgetSnippet && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-bright)]">Snippet widgetu</p>
              <pre className="overflow-x-auto rounded-soft border border-glass-border bg-black/30 p-3 text-[11px] text-[var(--muted)]">
                {widgetSnippet}
              </pre>
              <GlassButton
                type="button"
                variant="subtle"
                className="!px-3 !py-1.5 text-xs"
                onClick={() => void navigator.clipboard.writeText(widgetSnippet)}
              >
                Kopiuj snippet
              </GlassButton>
            </div>
          )}
          <div className="space-y-3">
            <CopyField label="Webhook / endpoint" value={webhookUrl} />
            <p className="font-mono text-[10px] text-[var(--muted)]">
              Env: {ch.envVars.join(" · ")}
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export function ChannelsPage() {
  const { section: active } = useParams<{ section: string }>();
  const [msg, setMsg] = useState("");
  const { business } = useAuth();
  const { start } = useTour();
  const businessId = business?.id || "BUSINESS_UUID";
  const enabled = business?.enabled_channels;
  const [health, setHealth] = useState<
    Awaited<ReturnType<typeof channelsApi.status>> | null
  >(null);

  useEffect(() => {
    channelsApi
      .status()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    const appId = (import.meta.env.VITE_META_APP_ID || "").trim();
    if (appId) {
      loadFacebookSdk(appId).catch((err) => console.warn(err));
    }
  }, []);

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
      `<script src="${API_BASE.replace(/\/$/, "")}/widget/bizchat-widget.js"
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

  if (active && !["integrations"].includes(active)) {
    return <Navigate to="/channels" replace />;
  }

  return (
    <div className="space-y-6" data-tour="page-channels">
      <header className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start gap-3">
          {active && (
            <Link to="/channels" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text-bright)] transition-colors">
              <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Wróć do kanałów
            </Link>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold">
              {!active ? "Kanały" : "Integracje"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              {!active 
                ? "Podłącz Messenger, Telegram i widget — tu znajdziesz webhooki, checklistę i snippet."
                : "Połącz swoje konta społecznościowe z platformą Automovia."}
            </p>
          </div>
        </div>
        {!active && (
          <GlassButton type="button" variant="ghost" onClick={start}>
            Uruchom samouczek
          </GlassButton>
        )}
      </header>

      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      {!active && (
        <>
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
        {health && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {health.channels.map((ch) => (
              <div
                key={ch.id}
                className="rounded-soft border border-glass-border bg-black/20 px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[var(--text-bright)]">
                  {ch.configured ? "●" : "○"} {ch.name}
                </p>
                <p className="mt-0.5 text-[var(--muted)]">{ch.detail}</p>
              </div>
            ))}
            <p className="sm:col-span-2 text-[11px] text-[var(--muted)]">
              Verify token Meta:{" "}
              <code className="text-[var(--text-bright)]">
                {health.meta_verify_token}
              </code>
              {health.meta_default_business_id_set
                ? " · META_DEFAULT_BUSINESS_ID ustawione"
                : " · ustaw META_DEFAULT_BUSINESS_ID albo ?business_id= w callbacku"}
            </p>
          </div>
        )}
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

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-2">
        {CHANNELS.map((ch) => {
          const on = channelEnabled(enabled, ch.licenseKeys);
          return (
            <ChannelCard
              key={ch.id}
              ch={ch}
              on={on}
              webhookUrl={webhookFor(ch)}
              widgetSnippet={ch.id === "widget" ? widgetSnippet : undefined}
            />
          );
        })}
      </div>
        </>
      )}

      {active === "integrations" && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">Integracja z Meta (Facebook, Instagram)</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Połącz swoje konta z ekosystemu Meta, aby Automovia mogła zarządzać Twoim kalendarzem i wiadomościami za pomocą jednego przycisku.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-glass-border bg-[var(--surface-solid)] p-8 text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <svg viewBox="0 0 36 36" className="w-12 h-12" fill="url(#messengerGrad)"><defs><linearGradient id="messengerGrad" x1="19.23%" y1="102.1%" x2="84.91%" y2="-0.65%"><stop offset="0%" stopColor="#00B2FF"/><stop offset="100%" stopColor="#FF6680"/></linearGradient></defs><path d="M18 1.4C8.8 1.4 1.4 8.2 1.4 16.5c0 4.7 2.4 8.9 6.2 11.7v6.4l5.7-3.2c1.5.4 3.1.6 4.7.6 9.2 0 16.6-6.8 16.6-15.1S27.2 1.4 18 1.4zm1 20.3l-3.9-4.2-7.6 4.2 8.3-8.9 4 4.2 7.5-4.2-8.3 8.9z"/></svg>
              <svg viewBox="0 0 24 24" className="w-12 h-12"><defs><linearGradient id="ig" x1="20%" y1="100%" x2="80%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig)" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85C2.38 3.85 3.92 2.31 7.15 2.16c1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07c-4.27.2-6.78 2.71-6.98 6.98C0 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.27 2.71 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.27-.2 6.78-2.71 6.98-6.98C23.99 15.67 24 15.26 24 12s-.01-3.67-.07-4.95c-.2-4.27-2.71-6.78-6.98-6.98C15.67.01 15.26 0 12 0z"/><path fill="#fff" d="M12 5.84A6.16 6.16 0 1018.16 12 6.16 6.16 0 0012 5.84zm0 10.16A4 4 0 1116 12a4 4 0 01-4 4zM18.41 4.15a1.44 1.44 0 101.43 1.44 1.44 1.44 0 00-1.43-1.44z"/></svg>
            </div>
            <h3 className="font-semibold text-lg text-[var(--text-bright)]">
              {typeof business?.settings?.meta_page_name === "string" && business.settings.meta_page_name
                ? `Połączono z: ${business.settings.meta_page_name}`
                : "Połącz z fanpage'em i Instagramem"}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)] max-w-sm mb-6">
              {typeof business?.settings?.meta_page_id === "string" && business.settings.meta_page_id
                ? "Twój fanpage jest połączony. Zaloguj się ponownie, by zmienić powiązany profil."
                : "Jednym kliknięciem wybierz swój profil, aby aktywować integrację."}
            </p>
            <GlassButton
              type="button"
              onClick={async () => {
                setMsg("");
                const appId = (import.meta.env.VITE_META_APP_ID || "").trim();
                if (!appId || appId === "twoje_app_id" || appId === "dummy_app_id") {
                  setMsg("Błąd: Nie skonfigurowano VITE_META_APP_ID. Podaj prawidłowe ID aplikacji Facebook podczas deployu.");
                  return;
                }

                setMsg("Inicjowanie okna logowania Facebook...");
                try {
                  const FB = await loadFacebookSdk(appId) as { login: (cb: (res: { authResponse?: { accessToken?: string } }) => void, opts: { scope: string }) => void };
                  initFb(appId);

                  FB.login(
                    (response) => {
                      if (response?.authResponse?.accessToken) {
                        setMsg("Pobrano uprawnienia z Meta. Zapisywanie konfiguracji i podpinanie webhooka...");
                        channelsApi
                          .linkMeta(response.authResponse.accessToken)
                          .then((res) => {
                            setMsg(`Sukces! Połączono z fanpagem: ${res?.page_name || "Twój Fanpage"}.`);
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          })
                          .catch((err: Error) => {
                            setMsg("Błąd połączenia na backendzie: " + (err.message || String(err)));
                          });
                      } else {
                        setMsg("Logowanie przerwane lub anulowane.");
                      }
                    },
                    { scope: "pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata" }
                  );
                } catch (err) {
                  setMsg("Błąd: " + (err instanceof Error ? err.message : String(err)));
                }
              }}
              className="!bg-[#1877F2] hover:!bg-[#1877F2]/90 !text-white font-medium"
            >
              {typeof business?.settings?.meta_page_name === "string" && business.settings.meta_page_name ? 'Zmień połączony profil (zaloguj ponownie)' : 'Połącz profil z Meta'}
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
