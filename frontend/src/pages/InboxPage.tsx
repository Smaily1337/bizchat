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
          <h1 className="font-display text-2xl font-semibold text-[var(--text-bright)] sm:text-3xl">
            Wiadomości
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Rozmowy z Messengera i innych kanałów. Jeśli ktoś pisał wcześniej —
            użyj „Importuj z Messengera”.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        <pre className="whitespace-pre-wrap rounded-control border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 font-sans text-sm text-[var(--danger)]">
          {error}
        </pre>
      )}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}

      {importPanel && (
        <GlassCard className="animate-fade-up space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text-bright)]">
              1. Automatycznie z Meta (wymaga pages_read_engagement)
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
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
          <div className="border-t border-glass-border pt-4">
            <p className="text-sm font-semibold text-[var(--text-bright)]">
              2. Import PSID (bez tej zgody)
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Wklej Page-Scoped ID osób, które pisały do fanpage — po jednym w
              linii. Format: <code className="font-mono">123456789</code> albo{" "}
              <code className="font-mono">Anna | 123456789</code>. PSID znajdziesz
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
        <p className="text-sm text-[var(--muted)]">Ładowanie rozmów…</p>
      )}

      {composeOpen && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">
            Napisz do klienta (Messenger)
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Nie trzeba mieć wcześniejszej rozmowy w Inbox — wystarczy PSID w
            karcie klienta. Meta wymaga, by klient kiedyś napisał do fanpage.
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onStart}>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Klient</span>
              <select
                className="w-full rounded-control border border-glass-border bg-glass-fill px-3 py-2 text-sm text-[var(--text-bright)]"
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
              <p className="sm:col-span-2 text-xs text-[var(--muted)]">
                Brak klientów z ID kanału.{" "}
                <Link className="underline" to="/customers">
                  Dodaj klienta z Messenger PSID
                </Link>
                .
              </p>
            )}
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Kanał</span>
              <select
                className="w-full rounded-control border border-glass-border bg-glass-fill px-3 py-2 text-sm text-[var(--text-bright)]"
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
              <span className="text-[var(--muted)]">Treść</span>
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

      <div className={`grid gap-4 lg:grid-cols-[320px_1fr] ${THREAD_HEIGHT}`}>
        <GlassCard
          padding="none"
          className={`!overflow-hidden flex flex-col ${THREAD_HEIGHT}`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 && !loading && (
              <p className="p-4 text-sm text-[var(--muted)]">
                Brak rozmów. Użyj „Nowa wiadomość” albo poczekaj na klienta.
              </p>
            )}
            <ul>
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={[
                      "w-full border-b border-glass-border px-4 py-3 text-left transition",
                      selectedId === c.id
                        ? "bg-[var(--accent-soft)]"
                        : "hover:bg-[var(--row-hover)]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-display text-sm font-semibold">
                        {c.customer_name || "Klient"}
                      </p>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-canary">
                        {CHANNEL_LABEL[c.channel] || c.channel}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {c.last_message || "—"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>

        <GlassCard
          padding="none"
          className={`!overflow-hidden flex flex-col ${THREAD_HEIGHT}`}
        >
          {selected ? (
            <div className="flex h-full min-h-0 flex-col p-5">
              <div className="mb-3 shrink-0 border-b border-glass-border pb-3">
                <p className="font-display text-lg font-semibold">
                  {selected.customer_name || "Klient"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {CHANNEL_LABEL[selected.channel]} · stan: {selected.state}
                </p>
                {selectedCustomer?.tags && selectedCustomer.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedCustomer.tags.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-control px-2 py-0.5 text-[11px] font-medium text-[var(--text-bright)]"
                        style={{
                          backgroundColor: t.color || "rgba(255,255,255,0.15)",
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                ref={messagesRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={[
                      "max-w-[85%] rounded-soft border px-3 py-2 text-sm",
                      m.role === "customer"
                        ? "mr-auto border-glass-border bg-glass-fill"
                        : m.role === "owner"
                          ? "ml-auto border-[var(--accent)]/40 bg-[var(--accent-soft)]"
                          : "ml-auto border-glass-border bg-glass-fillStrong",
                    ].join(" ")}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      {m.role === "customer"
                        ? "Klient"
                        : m.role === "owner"
                          ? "Ty"
                          : "Bot"}
                    </p>
                    <p className="whitespace-pre-wrap text-[var(--text-bright)]">
                      {m.content}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      {new Date(m.created_at).toLocaleString("pl-PL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <form className="mt-3 flex shrink-0 gap-2" onSubmit={onReply}>
                <GlassTextarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Odpowiedz jako właściciel…"
                  className="min-h-[3rem] max-h-28 flex-1"
                />
                <GlassButton type="submit" className="self-end">
                  Wyślij
                </GlassButton>
              </form>
            </div>
          ) : (
            <p className="p-5 text-sm text-[var(--muted)]">Wybierz rozmowę</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
