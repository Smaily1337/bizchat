import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { customersApi, inboxApi } from "@/api";
import { ApiError } from "@/api/client";
import type { Channel, Conversation, Customer, InboxMessage } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassTextarea } from "@/components/ui/GlassInput";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

const CHANNEL_LABEL: Record<string, string> = {
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  widget: "Widget",
  admin: "Admin",
};

const THREAD_HEIGHT = "h-[min(70vh,calc(100dvh-13rem))]";

export function InboxPage() {
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("c") || null,
  );
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(
    () => searchParams.get("compose") === "1",
  );
  const [importing, setImporting] = useState(false);
  const [importPanel, setImportPanel] = useState(false);
  const [psidText, setPsidText] = useState("");
  const [compose, setCompose] = useState({
    customer_id: searchParams.get("customer") || "",
    channel: "messenger" as Channel,
    text: "",
  });
  const messagesRef = useRef<HTMLDivElement>(null);

  async function reloadList() {
    const list = await inboxApi.conversations();
    setConversations(list);
    const fromQuery = searchParams.get("c");
    setSelectedId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      if (fromQuery && list.some((c) => c.id === fromQuery)) return fromQuery;
      return list[0]?.id || null;
    });
  }

  async function reloadMessages(id: string) {
    const msgs = await inboxApi.messages(id);
    setMessages(msgs);
  }

  useEffect(() => {
    void Promise.all([reloadList(), customersApi.list()])
      .then(([, cust]) => setCustomers(cust))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void reloadMessages(selectedId).catch((e: Error) => setError(e.message));
  }, [selectedId]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, selectedId]);

  useRealtimeEvents(
    true,
    (ev) => {
      if (ev.type === "chat.message" || ev.type === "appointment.created") {
        void reloadList().catch(() => undefined);
        if (
          selectedId &&
          ev.payload?.conversation_id &&
          String(ev.payload.conversation_id) === selectedId
        ) {
          void reloadMessages(selectedId).catch(() => undefined);
        }
      }
    },
    { toasts: false },
  );

  async function onReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setError(null);
    try {
      const msg = await inboxApi.reply(selectedId, reply.trim());
      setMessages((m) => [...m, msg]);
      setReply("");
      await reloadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd wysyłki");
    }
  }

  async function onStart(e: FormEvent) {
    e.preventDefault();
    if (!compose.customer_id || !compose.text.trim()) return;
    setError(null);
    setInfo(null);
    try {
      const res = await inboxApi.start({
        customer_id: compose.customer_id,
        text: compose.text.trim(),
        channel: compose.channel,
      });
      setComposeOpen(false);
      setCompose({ customer_id: "", channel: "messenger", text: "" });
      await reloadList();
      setSelectedId(res.conversation.id);
      if (res.delivered) {
        setInfo("Wiadomość wysłana na Messenger.");
      } else {
        setError(
          res.detail ||
            "Zapisano rozmowę, ale Meta nie dostarczyła wiadomości.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd startu rozmowy");
    }
  }

  async function onImportMessenger() {
    setError(null);
    setInfo(null);
    setImporting(true);
    try {
      const res = await inboxApi.importMessenger(50);
      await reloadList();
      await customersApi.list().then(setCustomers);
      const names =
        res.imported_names.length > 0
          ? `: ${res.imported_names.slice(0, 8).join(", ")}`
          : "";
      setInfo(
        `Import Meta: ${res.threads_seen} wątków, +${res.customers_created} klientów, ` +
          `+${res.conversations_created} rozmów, +${res.messages_created} wiadomości${names}`,
      );
      setImportPanel(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Import z Messengera nieudany";
      setError(msg);
      setImportPanel(true);
    } finally {
      setImporting(false);
    }
  }

  async function onImportPsids(e: FormEvent) {
    e.preventDefault();
    if (!psidText.trim()) return;
    setError(null);
    setInfo(null);
    setImporting(true);
    try {
      const res = await inboxApi.importMessengerPsids(psidText.trim());
      await reloadList();
      await customersApi.list().then(setCustomers);
      setInfo(
        `Import PSID: +${res.customers_created} klientów, +${res.conversations_created} rozmów` +
          (res.imported_names.length
            ? `: ${res.imported_names.slice(0, 8).join(", ")}`
            : ""),
      );
      setPsidText("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Import PSID nieudany",
      );
    } finally {
      setImporting(false);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId);
  const selectedCustomer = customers.find((c) => c.id === selected?.customer_id);
  const messengerReady = customers.filter(
    (c) => c.external_ids?.messenger || c.external_ids?.instagram || c.external_ids?.telegram,
  );

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md font-black text-primary">
            Wiadomości
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Rozmowy z Messengera i innych kanałów. Jeśli ktoś pisał wcześniej —
            użyj „Importuj z Messengera”.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface-container/60 text-on-surface transition-all hover:border-white/20 hover:shadow-glow">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface-container/60 text-on-surface transition-all hover:border-white/20 hover:shadow-glow">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          </div>
          <GlassButton
            type="button"
            variant="ghost"
            disabled={importing}
            onClick={() => {
              setImportPanel((v) => !v);
              setError(null);
            }}
          >
            {importPanel ? "Zamknij import" : "Import Messenger"}
          </GlassButton>
          <GlassButton type="button" onClick={() => setComposeOpen((v) => !v)}>
            {composeOpen ? "Anuluj" : "Nowa wiadomość"}
          </GlassButton>
          <Link to="/customers">
            <GlassButton type="button" variant="ghost">
              Klienci
            </GlassButton>
          </Link>
        </div>
      </header>

      {error && (
        <pre className="whitespace-pre-wrap rounded-control border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 font-sans text-sm text-error">
          {error}
        </pre>
      )}
      {info && <p className="text-sm text-secondary">{info}</p>}

      {importPanel && (
        <GlassCard className="animate-fade-up space-y-4">
          <div>
            <p className="text-sm font-semibold text-on-surface">
              1. Automatycznie z Meta (wymaga pages_read_engagement)
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Token strony musi mieć pages_read_engagement. W trybie Live Meta
              wymaga App Review — w Development wystarczy dodać uprawnienie i
              wygenerować nowy Page token.
            </p>
            <div className="mt-3">
              <GlassButton
                type="button"
                disabled={importing}
                onClick={() => void onImportMessenger()}
              >
                {importing ? "Importuję…" : "Zaciągnij historię z Graph API"}
              </GlassButton>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm font-semibold text-on-surface">
              2. Import PSID (bez tej zgody)
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Wklej Page-Scoped ID osób, które pisały do fanpage — po jednym w
              linii. Format: <code className="font-data-mono">123456789</code> albo{" "}
              <code className="font-data-mono">Anna | 123456789</code>. PSID znajdziesz
              w Meta Business Suite → Inbox (szczegóły rozmowy) lub w logach
              webhooka.
            </p>
            <form className="mt-3 space-y-3" onSubmit={onImportPsids}>
              <GlassTextarea
                value={psidText}
                onChange={(e) => setPsidText(e.target.value)}
                placeholder={"Anna Kowalska | 1234567890123456\n9876543210987654"}
                rows={5}
                required
              />
              <GlassButton type="submit" disabled={importing}>
                {importing ? "Importuję…" : "Dodaj do Wiadomości"}
              </GlassButton>
            </form>
          </div>
        </GlassCard>
      )}

      {loading && (
        <p className="text-sm text-on-surface-variant">Ładowanie rozmów…</p>
      )}

      {composeOpen && (
        <GlassCard className="animate-fade-up">
          <p className="font-headline-md text-lg font-semibold text-on-surface">
            Napisz do klienta (Messenger)
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Nie trzeba mieć wcześniejszej rozmowy w Inbox — wystarczy PSID w
            karcie klienta. Meta wymaga, by klient kiedyś napisał do fanpage.
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onStart}>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-on-surface-variant">Klient</span>
              <select
                className="w-full rounded-control border border-white/10 bg-surface-container/60 px-3 py-2 text-sm text-on-surface"
                value={compose.customer_id}
                onChange={(e) =>
                  setCompose({ ...compose, customer_id: e.target.value })
                }
                required
              >
                <option value="">Wybierz…</option>
                {messengerReady.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "Bez nazwy"}
                    {c.external_ids?.messenger
                      ? " · Messenger"
                      : c.external_ids?.instagram
                        ? " · Instagram"
                        : " · Telegram"}
                  </option>
                ))}
              </select>
            </label>
            {messengerReady.length === 0 && (
              <p className="sm:col-span-2 text-xs text-on-surface-variant">
                Brak klientów z ID kanału.{" "}
                <Link className="underline" to="/customers">
                  Dodaj klienta z Messenger PSID
                </Link>
                .
              </p>
            )}
            <label className="space-y-1 text-sm">
              <span className="text-on-surface-variant">Kanał</span>
              <select
                className="w-full rounded-control border border-white/10 bg-surface-container/60 px-3 py-2 text-sm text-on-surface"
                value={compose.channel}
                onChange={(e) =>
                  setCompose({
                    ...compose,
                    channel: e.target.value as Channel,
                  })
                }
              >
                <option value="messenger">Messenger</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-on-surface-variant">Treść</span>
              <GlassTextarea
                value={compose.text}
                onChange={(e) =>
                  setCompose({ ...compose, text: e.target.value })
                }
                placeholder="Cześć! Piszę w sprawie wizyty…"
                required
              />
            </label>
            <div className="sm:col-span-2">
              <GlassButton type="submit">Wyślij i otwórz wątek</GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      <div className={`grid gap-4 lg:grid-cols-[340px_1fr] ${THREAD_HEIGHT}`}>
        <div className={`flex flex-col gap-3 overflow-y-auto pr-2`}>
          {conversations.length === 0 && !loading && (
            <p className="p-4 text-sm text-on-surface-variant">
              Brak rozmów. Użyj „Nowa wiadomość” albo poczekaj na klienta.
            </p>
          )}
          {conversations.map((c) => {
            const isUnread = false; // Add real unread logic if available
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`glass-panel flex w-full items-center gap-3 rounded-[28px] p-3 text-left transition-all ${
                  selectedId === c.id
                    ? "border-white/30 shadow-glow"
                    : "hover:border-white/20 hover:shadow-glow"
                }`}
              >
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-surface-container font-display text-lg font-bold text-primary">
                    {c.customer_name ? c.customer_name.charAt(0).toUpperCase() : "K"}
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-surface-container text-on-surface">
                    <span className="material-symbols-outlined text-[12px]">
                      {c.channel === "messenger"
                        ? "chat"
                        : c.channel === "instagram"
                          ? "photo_camera"
                          : "forum"}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="truncate font-body-md font-semibold text-on-surface">
                      {c.customer_name || "Klient"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm text-on-surface-variant">
                      {c.last_message || "—"}
                    </p>
                    {isUnread && (
                      <div className="ml-2 h-2 w-2 shrink-0 rounded-full bg-primary-container shadow-[0_0_8px_rgba(128,131,255,0.6)]" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className={`glass-panel flex flex-col rounded-[28px] !overflow-hidden ${THREAD_HEIGHT}`}>
          {selected ? (
            <div className="flex h-full min-h-0 flex-col p-5">
              <div className="mb-4 flex shrink-0 items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="font-headline-md text-xl font-bold text-on-surface">
                    {selected.customer_name || "Klient"}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">
                      {selected.channel === "messenger" ? "chat" : "forum"}
                    </span>
                    {CHANNEL_LABEL[selected.channel]} · stan: {selected.state}
                  </p>
                </div>
                {selectedCustomer?.tags && selectedCustomer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCustomer.tags.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-full px-3 py-1 font-label-caps text-[11px] font-semibold text-on-surface border border-white/10 bg-surface-container/60"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                ref={messagesRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[85%] ${
                      m.role === "customer" ? "mr-auto" : "ml-auto"
                    }`}
                  >
                    <div
                      className={[
                        "p-4 text-sm",
                        m.role === "customer"
                          ? "glass-panel rounded-2xl rounded-bl-none text-on-surface"
                          : "bg-gradient-to-r from-primary-container to-tertiary-container rounded-2xl rounded-br-none shadow-[0_4px_24px_rgba(128,131,255,0.25)] font-medium text-white",
                      ].join(" ")}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <p
                      className={`mt-1 font-data-mono text-[10px] text-on-surface-variant ${
                        m.role === "customer" ? "text-left" : "text-right"
                      }`}
                    >
                      {new Date(m.created_at).toLocaleString("pl-PL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <form className="mt-4 flex shrink-0 items-center gap-3" onSubmit={onReply}>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-container-high text-on-surface transition-all hover:border-white/20"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Napisz wiadomość..."
                    className="w-full rounded-3xl border border-white/10 bg-surface-container-high px-4 py-3 pr-12 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      sentiment_satisfied
                    </span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!reply.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-white shadow-[0_4px_16px_rgba(128,131,255,0.4)] transition-all hover:brightness-110 disabled:opacity-50"
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    send
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">
              Wybierz rozmowę
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
