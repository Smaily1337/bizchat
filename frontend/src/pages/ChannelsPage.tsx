import { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate, useSearchParams } from "react-router-dom";
import { channelsApi, inboxApi } from "@/api";
import { API_BASE } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { useToast } from "@/components/ToastProvider";
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
  const { section: active } = useParams<{ section: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { business } = useAuth();
  const { push } = useToast();
  const { start } = useTour();
  const businessId = business?.id || "BUSINESS_UUID";
  const enabled = business?.enabled_channels;

  const [health, setHealth] = useState<
    Awaited<ReturnType<typeof channelsApi.status>> | null
  >(null);
  const [metaDetails, setMetaDetails] = useState<
    Awaited<ReturnType<typeof channelsApi.getMetaDetails>> | null
  >(null);

  // Advanced Fallback
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [directPageId, setDirectPageId] = useState("");
  const [directToken, setDirectToken] = useState("");
  const [directBusy, setDirectBusy] = useState(false);

  // History Sync State
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStats, setSyncStats] = useState<{
    conversations_created: number;
    messages_created: number;
    customers_created: number;
    imported_names: string[];
  } | null>(null);

  // Edit Page Profile State
  const [editAbout, setEditAbout] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  // Picture Change State
  const [pictureUrl, setPictureUrl] = useState("");
  const [pictureBusy, setPictureBusy] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  function reloadMetaDetails() {
    channelsApi
      .getMetaDetails()
      .then((d) => {
        setMetaDetails(d);
        if (d?.connected) {
          setEditAbout(d.about || "");
          setEditDesc(d.description || "");
          setEditPhone(d.phone || "");
          setEditWebsite(d.website || "");
        }
      })
      .catch(() => setMetaDetails(null));
  }

  useEffect(() => {
    channelsApi
      .status()
      .then(setHealth)
      .catch(() => setHealth(null));
    reloadMetaDetails();
  }, []);

  // Handle OAuth Redirect URL Params
  useEffect(() => {
    const metaConnected = searchParams.get("meta_connected");
    const pageName = searchParams.get("page_name");
    const oauthError = searchParams.get("oauth_error");

    if (metaConnected === "true") {
      push({
        title: "Pomyślnie połączono z Meta!",
        message: `Strona "${pageName || "Twój Fanpage"}" została połączona z systemem Automovia.`,
        tone: "canary",
      });
      reloadMetaDetails();
      setSearchParams({});
    } else if (oauthError) {
      push({
        title: "Błąd autoryzacji Meta",
        message:
          oauthError === "meta_app_id_not_configured"
            ? "Aplikacja Meta nie została jeszcze skonfigurowana przez administratora platformy."
            : `Szczegóły: ${oauthError}`,
        tone: "danger",
      });
      setSearchParams({});
    }
  }, [searchParams, push, setSearchParams]);

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

  const webhookFor = (ch: ChannelDef) => {
    if (ch.id === "messenger") return metaUrl;
    if (ch.id === "whatsapp") return whatsappUrl;
    if (ch.id === "telegram") return telegramUrl;
    return `${API_BASE}${ch.webhookPath}`;
  };

  function handleStartMetaOAuth() {
    window.location.href = `${API_BASE}/api/auth/meta/authorize?business_id=${businessId}`;
  }

  async function handleSyncHistory() {
    setSyncBusy(true);
    setSyncStats(null);
    try {
      const res = await inboxApi.importMessenger(50);
      setSyncStats(res);
      push({
        title: "Zsynchronizowano historię z Meta!",
        message: `Pobrano ${res.conversations_created} wątków, ${res.messages_created} wiadomości i ${res.customers_created} nowych kontaktów.`,
        tone: "canary",
      });
    } catch (err) {
      push({
        title: "Błąd synchronizacji",
        message: err instanceof Error ? err.message : "Błąd importu z Meta Graph API",
        tone: "danger",
      });
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleDisconnectMeta() {
    if (!confirm("Czy na pewno chcesz odłączyć stronę Facebook od Automovia?")) return;
    setDisconnectBusy(true);
    try {
      await channelsApi.disconnectMeta();
      push({
        title: "Odłączono stronę",
        message: "Strona Facebook została pomyślnie odłączona.",
        tone: "canary",
      });
      reloadMetaDetails();
    } catch (err) {
      push({
        title: "Błąd odłączania",
        message: err instanceof Error ? err.message : "Błąd",
        tone: "danger",
      });
    } finally {
      setDisconnectBusy(false);
    }
  }

  async function handleDirectConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!directPageId.trim() || !directToken.trim()) return;
    setDirectBusy(true);
    try {
      const res = await channelsApi.directConnectMeta({
        page_id: directPageId.trim(),
        access_token: directToken.trim(),
      });
      push({
        title: "Połączono z Meta!",
        message: `Pomyślnie podłączono stronę: ${res.page_name || res.page_id}`,
        tone: "canary",
      });
      setDirectPageId("");
      setDirectToken("");
      reloadMetaDetails();
    } catch (err) {
      push({
        title: "Błąd połączenia",
        message: err instanceof Error ? err.message : "Błąd weryfikacji tokena",
        tone: "danger",
      });
    } finally {
      setDirectBusy(false);
    }
  }

  async function handleSavePageDetails(e: React.FormEvent) {
    e.preventDefault();
    setEditBusy(true);
    try {
      await channelsApi.updateMetaPage({
        about: editAbout || undefined,
        description: editDesc || undefined,
        phone: editPhone || undefined,
        website: editWebsite || undefined,
      });
      push({
        title: "Zaktualizowano profil",
        message: "Dane strony zostały zaktualizowane w Meta Graph API",
        tone: "canary",
      });
      reloadMetaDetails();
    } catch (err) {
      push({
        title: "Błąd aktualizacji",
        message: err instanceof Error ? err.message : "Błąd zapisu danych",
        tone: "danger",
      });
    } finally {
      setEditBusy(false);
    }
  }

  async function handleChangePicture(e: React.FormEvent) {
    e.preventDefault();
    if (!pictureUrl.trim()) return;
    setPictureBusy(true);
    try {
      await channelsApi.changeMetaPicture(pictureUrl.trim());
      push({
        title: "Zmieniono zdjęcie",
        message: "Zdjęcie profilowe strony zostało zaktualizowane w Meta",
        tone: "canary",
      });
      setPictureUrl("");
      reloadMetaDetails();
    } catch (err) {
      push({
        title: "Błąd zmiany zdjęcia",
        message: err instanceof Error ? err.message : "Błąd Meta Graph API",
        tone: "danger",
      });
    } finally {
      setPictureBusy(false);
    }
  }

  if (active && !["integrations"].includes(active)) {
    return <Navigate to="/channels" replace />;
  }

  const isMetaConnected = Boolean(metaDetails?.connected && metaDetails?.page_id);

  return (
    <div className="space-y-6 animate-fade-up" data-tour="page-channels">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">hub</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Kanały i Integracje
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Zarządzaj połączeniem z Meta (Facebook, Messenger), WhatsApp i botami
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/channels"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              !active
                ? "bg-[var(--primary-container)] text-white shadow"
                : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5"
            }`}
          >
            Przegląd webhooków
          </Link>
          <Link
            to="/channels/integrations"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active === "integrations"
                ? "bg-[var(--primary-container)] text-white shadow"
                : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5"
            }`}
          >
            Zarządzanie Stroną Meta
          </Link>
        </div>
      </header>

      {!active && (
        <>
          <GlassCard className="animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-display text-lg font-semibold text-[var(--text-bright)]">
                  Gotowość kanałów komunikacji
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Sprawdź, czy webhooki i tokeny są poprawnie podpięte.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <GlassButton
                  type="button"
                  variant="ghost"
                  className="!text-xs !py-1.5"
                  onClick={() => start()}
                >
                  <span className="material-symbols-outlined text-[16px]">help</span>
                  Samouczek
                </GlassButton>
                <Link to="/channels/integrations">
                  <GlassButton variant="primary" className="!text-xs">
                    <span className="material-symbols-outlined text-[16px]">add_link</span>
                    Zarządzaj stroną Meta
                  </GlassButton>
                </Link>
              </div>
            </div>

            {health && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 pt-3 border-t border-glass-border">
                {health.channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="rounded-lg border border-glass-border bg-white/[0.02] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--text-bright)]">
                        {ch.configured ? "🟢" : "⚪"} {ch.name}
                      </span>
                      <span
                        className={
                          ch.configured
                            ? "text-green-400 font-semibold"
                            : "text-[var(--muted)]"
                        }
                      >
                        {ch.configured ? "Aktywny" : "Wymaga konfiguracji"}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--muted)] text-[11px]">{ch.detail}</p>
                  </div>
                ))}
              </div>
            )}
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
                  <div className="mt-4 space-y-3">
                    <CopyField label="Webhook / endpoint" value={webhookFor(ch)} />
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {active === "integrations" && (
        <div className="space-y-6 animate-fade-up">
          {/* Main Hero Card for Meta Connection */}
          {!isMetaConnected ? (
            <GlassCard className="p-8 relative overflow-hidden border border-blue-500/20 shadow-2xl">
              <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <span className="material-symbols-outlined text-[28px]">facebook</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-bright)]">
                      Połącz swój Fanpage Facebook & Instagram
                    </h2>
                    <p className="text-xs text-[var(--muted)]">
                      Oficjalna integracja Meta Business dla salonów i specjalistów
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[var(--text)] mb-6 leading-relaxed">
                  Podłącz swój profil jednym kliknięciem. Automovia automatycznie przejmie obsługę zapytań od klientów, umożliwi rezerwację wizyt 24/7 i zsynchronizuje wszystkie wątki w Twojej skrzynce odbiorczej.
                </p>

                <div className="grid sm:grid-cols-3 gap-3 mb-8">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                    <span className="text-green-400 font-bold block mb-1">✓ Rezerwacje 24/7</span>
                    <span className="text-[var(--muted)] text-[11px]">Klienci umawiają się bezpośrednio w Messengerze</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                    <span className="text-green-400 font-bold block mb-1">✓ Wszystko w 1 Inboxie</span>
                    <span className="text-[var(--muted)] text-[11px]">Odpowiadaj klientom z poziomu jednego panelu</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                    <span className="text-green-400 font-bold block mb-1">✓ 100% Bezpieczeństwa</span>
                    <span className="text-[var(--muted)] text-[11px]">Oficjalna autoryzacja OAuth 2.0 bez haseł</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <button
                    type="button"
                    onClick={handleStartMetaOAuth}
                    className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white font-bold py-3.5 px-8 rounded-xl text-sm flex items-center justify-center gap-3 shadow-xl shadow-blue-500/25 hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">link</span>
                    Połącz z Facebookiem
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--text-bright)] py-2 text-center"
                  >
                    {showAdvanced ? "Ukryj opcje zaawansowane" : "Opcje zaawansowane (ręczny token)"}
                  </button>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  {metaDetails?.picture_url ? (
                    <img
                      src={metaDetails.picture_url}
                      alt={metaDetails.page_name || "Fanpage"}
                      className="w-16 h-16 rounded-full border-2 border-green-500/50 object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center text-blue-400">
                      <span className="material-symbols-outlined text-3xl">facebook</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[var(--text-bright)]">
                        {metaDetails?.page_name || "Facebook Fanpage"}
                      </h2>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Połączono i Aktywne
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      ID Strony: <span className="font-mono text-[var(--text-bright)]">{metaDetails?.page_id}</span>
                      {metaDetails?.followers_count !== undefined ? ` · ${metaDetails.followers_count} obserwujących` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link to="/inbox">
                    <GlassButton variant="primary" className="!text-xs">
                      <span className="material-symbols-outlined text-[16px]">chat</span>
                      Otwórz Messenger Inbox
                    </GlassButton>
                  </Link>

                  <button
                    type="button"
                    onClick={handleStartMetaOAuth}
                    className="px-3 py-1.5 rounded-lg border border-glass-border bg-white/5 text-xs text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/10 transition-colors"
                  >
                    Zmień stronę
                  </button>

                  <button
                    type="button"
                    disabled={disconnectBusy}
                    onClick={handleDisconnectMeta}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    {disconnectBusy ? "Odłączanie..." : "Odłącz"}
                  </button>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Facebook History Sync Banner */}
          {isMetaConnected && (
            <GlassCard className="p-6 border border-blue-500/20 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <span className="material-symbols-outlined text-2xl">history</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[var(--text-bright)] flex items-center gap-2">
                      Zaciągnij historię rozmów z Meta
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/20 text-blue-300">
                        1-Click Sync
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Pobierz dotychczasowe wątki, wiadomości i profile klientów z Messengera do panelu Wiadomości (Inbox).
                    </p>
                  </div>
                </div>

                <GlassButton
                  type="button"
                  variant="primary"
                  disabled={syncBusy}
                  onClick={handleSyncHistory}
                  className="!px-5 !py-2.5 text-xs flex items-center gap-2 shrink-0 shadow-lg shadow-blue-500/20"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {syncBusy ? "sync" : "cloud_download"}
                  </span>
                  {syncBusy ? "Pobieranie historii z Meta..." : "Zaciągnij historię z Meta"}
                </GlassButton>
              </div>

              {syncStats && (
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-3 animate-fade-up">
                  <div className="p-3 rounded-lg bg-black/20 text-center">
                    <span className="text-lg font-bold text-green-400 block">{syncStats.conversations_created}</span>
                    <span className="text-[11px] text-[var(--muted)]">Zaimportowanych wątków</span>
                  </div>
                  <div className="p-3 rounded-lg bg-black/20 text-center">
                    <span className="text-lg font-bold text-blue-400 block">{syncStats.messages_created}</span>
                    <span className="text-[11px] text-[var(--muted)]">Zapisanych wiadomości</span>
                  </div>
                  <div className="p-3 rounded-lg bg-black/20 text-center">
                    <span className="text-lg font-bold text-purple-400 block">{syncStats.customers_created}</span>
                    <span className="text-[11px] text-[var(--muted)]">Nowych klientów w CRM</span>
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Advanced Manual Token Fallback (Collapsible) */}
          {showAdvanced && !isMetaConnected && (
            <GlassCard className="p-6 animate-fade-up">
              <div className="flex items-center gap-2 text-[var(--primary)] mb-2">
                <span className="material-symbols-outlined text-[20px]">key</span>
                <h3 className="font-bold text-base text-[var(--text-bright)]">Ręczne połączenie Tokenem (dla deweloperów)</h3>
              </div>
              <p className="text-xs text-[var(--muted)] mb-4">
                Wklej ID fanpage'a oraz Page Access Token z Meta for Developers lub Graph API Explorer.
              </p>

              <form onSubmit={handleDirectConnect} className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">
                    Facebook Page ID
                  </label>
                  <input
                    type="text"
                    value={directPageId}
                    onChange={(e) => setDirectPageId(e.target.value)}
                    placeholder="np. 1029384756182"
                    className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">
                    Page Access Token
                  </label>
                  <input
                    type="password"
                    value={directToken}
                    onChange={(e) => setDirectToken(e.target.value)}
                    placeholder="EAAB..."
                    className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <GlassButton
                    type="submit"
                    variant="primary"
                    disabled={directBusy}
                    className="!py-2 text-xs flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    {directBusy ? "Łączenie..." : "Zapisz i aktywuj stronę"}
                  </GlassButton>
                </div>
              </form>
            </GlassCard>
          )}

          {/* Facebook Page Management Tools */}
          {isMetaConnected && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form 1: Edit Page Details */}
              <GlassCard className="p-6">
                <div className="flex items-center gap-2 text-[var(--primary)] mb-2">
                  <span className="material-symbols-outlined text-[20px]">edit_note</span>
                  <h3 className="font-bold text-base text-[var(--text-bright)]">Edycja Danych Fanpage</h3>
                </div>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Aktualizuj opis, telefon i stronę WWW bezpośrednio w Meta Graph API.
                </p>

                <form onSubmit={handleSavePageDetails} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">
                      Krótki opis (About)
                    </label>
                    <input
                      type="text"
                      value={editAbout}
                      onChange={(e) => setEditAbout(e.target.value)}
                      placeholder="Krótki opis widoczny na profilu..."
                      className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">
                      Pełny opis (Description)
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      placeholder="Szczegółowy opis salonu i oferty..."
                      className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg p-3 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">
                        Telefon kontaktowy
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+48 000 000 000"
                        className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">
                        Strona WWW
                      </label>
                      <input
                        type="text"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        placeholder="https://twojsalon.pl"
                        className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                  <GlassButton
                    type="submit"
                    variant="primary"
                    disabled={editBusy}
                    className="w-full !py-2 text-xs flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    {editBusy ? "Zapisywanie w Meta..." : "Zapisz zmiany w Meta"}
                  </GlassButton>
                </form>
              </GlassCard>

              {/* Form 2: Change Profile Picture */}
              <GlassCard className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[var(--secondary)] mb-2">
                    <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                    <h3 className="font-bold text-base text-[var(--text-bright)]">Zmiana Zdjęcia Profilowego</h3>
                  </div>
                  <p className="text-xs text-[var(--muted)] mb-4">
                    Podaj bezpośredni link URL do nowego zdjęcia profilowego, aby zmienić avatar strony na Facebooku.
                  </p>

                  <form onSubmit={handleChangePicture} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase mb-1">
                        URL nowego zdjęcia (HTTPS)
                      </label>
                      <input
                        type="url"
                        value={pictureUrl}
                        onChange={(e) => setPictureUrl(e.target.value)}
                        placeholder="https://example.com/logo-salonu.jpg"
                        className="w-full bg-[var(--surface-container)] border border-white/10 rounded-lg px-3 py-2 text-xs text-[var(--text-bright)] focus:outline-none focus:border-[var(--primary)]"
                        required
                      />
                    </div>
                    {pictureUrl && (
                      <div className="p-2 border border-white/10 rounded-lg bg-[var(--surface-container)] flex items-center gap-3">
                        <img
                          src={pictureUrl}
                          alt="Podgląd"
                          className="w-12 h-12 rounded-full object-cover border border-[var(--primary)]"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                        <span className="text-xs text-[var(--muted)]">Podgląd zdjęcia</span>
                      </div>
                    )}
                    <GlassButton
                      type="submit"
                      variant="ghost"
                      disabled={pictureBusy}
                      className="w-full !py-2 text-xs flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">upload</span>
                      {pictureBusy ? "Wysyłanie do Meta..." : "Zmień zdjęcie na Facebooku"}
                    </GlassButton>
                  </form>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-[var(--surface-container)] border border-white/5 text-xs text-[var(--muted)]">
                  <p className="font-semibold text-[var(--text-bright)] mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[var(--primary)] text-base">info</span>
                    Wskazówka
                  </p>
                  Wszystkie wiadomości od klientów z Twojego fanpage trafiają w czasie rzeczywistym do zakładki{" "}
                  <Link to="/inbox" className="text-[var(--primary)] font-semibold hover:underline">
                    Wiadomości (Inbox)
                  </Link>
                  .
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
