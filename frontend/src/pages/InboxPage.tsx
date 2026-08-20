import { type FormEvent, useEffect, useRef, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { customersApi, inboxApi } from "@/api";
import { ApiError } from "@/api/client";
import type { Channel, Conversation, Customer, InboxMessage } from "@/api/types";
import { GlassButton } from "@/components/ui";
import { GlassTextarea } from "@/components/ui/GlassInput";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

const CHANNEL_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  messenger: { label: "Messenger", icon: "chat", color: "bg-[#0084FF]" },
  instagram: { label: "Instagram", icon: "photo_camera", color: "bg-[#E1306C]" },
  telegram: { label: "Telegram", icon: "send", color: "bg-[#229ED9]" },
  whatsapp: { label: "WhatsApp", icon: "phone_iphone", color: "bg-[#25D366]" },
  widget: { label: "Widget WWW", icon: "language", color: "bg-[var(--accent)]" },
  admin: { label: "Panel", icon: "shield", color: "bg-[var(--secondary)]" },
};

function getInitials(name?: string | null) {
  if (!name) return "KL";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

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

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const q = searchFilter.toLowerCase();
      const matchesSearch =
        !q ||
        (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
        (c.last_message && c.last_message.toLowerCase().includes(q));
      return matchesSearch;
    });
  }, [conversations, searchFilter]);

  const selected = conversations.find((c) => c.id === selectedId);
  const selectedCustomer = customers.find((c) => c.id === selected?.customer_id);
  const messengerReady = customers.filter(
    (c) => c.external_ids?.messenger || c.external_ids?.instagram || c.external_ids?.telegram,
  );

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">chat</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Wiadomości
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Wszystkie kanały komunikacji w jednym szklanym cockpit
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <GlassButton
            type="button"
            variant="ghost"
            disabled={importing}
            onClick={() => {
              setImportPanel((v) => !v);
              setError(null);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">sync_alt</span>
            {importPanel ? "Zamknij import" : "Import Messenger"}
          </GlassButton>
          <GlassButton
            type="button"
            variant="primary"
            onClick={() => setComposeOpen((v) => !v)}
          >
            <span className="material-symbols-outlined text-[18px]">
              {composeOpen ? "close" : "edit_square"}
            </span>
            {composeOpen ? "Anuluj" : "Nowa wiadomość"}
          </GlassButton>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{info}</span>
        </div>
      )}

      {/* Import panel */}
      {importPanel && (
        <div className="glass-panel rounded-xl p-6 border-t-2 border-t-[var(--primary)] space-y-5 animate-fade-up shadow-2xl">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
              1. Automatyczny import z Meta Graph API
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Pobierz ostatnie 50 wątków z podłączonej strony na Facebooku.
            </p>
            <div className="mt-3">
              <GlassButton
                type="button"
                variant="primary"
                disabled={importing}
                onClick={() => void onImportMessenger()}
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                {importing ? "Importuję…" : "Zaciągnij historię z Meta"}
              </GlassButton>
            </div>
          </div>

          <div className="border-t border-glass-border pt-4">
            <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
              2. Ręczny import identyfikatorów PSID
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Wklej identyfikatory PSID klientów (np. <code>Anna | 123456789</code> lub same numery).
            </p>
            <form className="mt-3 space-y-3" onSubmit={onImportPsids}>
              <GlassTextarea
                value={psidText}
                onChange={(e) => setPsidText(e.target.value)}
                placeholder={"Anna Kowalska | 1234567890123456\nJan Nowak | 9876543210987654"}
                rows={4}
                required
              />
              <GlassButton type="submit" variant="primary" disabled={importing}>
                {importing ? "Importuję…" : "Dodaj identyfikatory"}
              </GlassButton>
            </form>
          </div>
        </div>
      )}

      {/* Compose new message panel */}
      {composeOpen && (
        <div className="glass-panel rounded-xl p-6 border-t-2 border-t-[var(--primary)] shadow-2xl animate-fade-up">
          <h2 className="font-display text-lg font-bold text-[var(--text-bright)] mb-1">
            Nowa wiadomość do klienta
          </h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Wybierz klienta z podłączonym identyfikatorem kanału, aby rozpocząć wątek.
          </p>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onStart}>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)] sm:col-span-2">
              <span>Wybierz klienta *</span>
              <select
                className="w-full rounded-lg border border-glass-border bg-[var(--surface-container)] px-3.5 py-2.5 text-sm text-[var(--text-bright)] outline-none focus:border-[var(--primary)]"
                value={compose.customer_id}
                onChange={(e) =>
                  setCompose({ ...compose, customer_id: e.target.value })
                }
                required
              >
                <option value="">— Wybierz klienta —</option>
                {messengerReady.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "Bez nazwy"} {c.phone ? `(${c.phone})` : ""}
                    {c.external_ids?.messenger
                      ? " · Messenger"
                      : c.external_ids?.instagram
                        ? " · Instagram"
                        : " · Telegram"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Kanał docelowy</span>
              <select
                className="w-full rounded-lg border border-glass-border bg-[var(--surface-container)] px-3.5 py-2.5 text-sm text-[var(--text-bright)] outline-none focus:border-[var(--primary)]"
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
            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)] sm:col-span-2">
              <span>Treść wiadomości *</span>
              <GlassTextarea
                value={compose.text}
                onChange={(e) =>
                  setCompose({ ...compose, text: e.target.value })
                }
                placeholder="Cześć! Piszę z salonu w sprawie..."
                required
              />
            </label>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <GlassButton type="submit" variant="primary">
                <span className="material-symbols-outlined text-[18px]">send</span>
                Wyślij wiadomość
              </GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setComposeOpen(false)}
              >
                Anuluj
              </GlassButton>
            </div>
          </form>
        </div>
      )}

      {/* Main 2-Column Inbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px] max-h-[calc(100vh-14rem)]">
        {/* Left Column: Conversations List */}
        <section className="lg:col-span-4 glass-panel rounded-xl flex flex-col overflow-hidden shadow-2xl">
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-glass-border bg-[var(--surface-container-low)] space-y-3 shrink-0">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Szukaj w rozmowach..."
                className="w-full bg-[var(--surface-container)] border border-glass-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`pb-1 transition-colors border-b-2 ${
                  activeTab === "all"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--text-bright)]"
                }`}
              >
                Wszystkie ({conversations.length})
              </button>
            </div>
          </div>

          {/* Conversations Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--muted)]">
                <span className="material-symbols-outlined text-3xl mb-2 block opacity-40">
                  inbox
                </span>
                {loading ? "Wczytywanie..." : "Brak konwersacji."}
              </div>
            ) : (
              filteredConversations.map((c) => {
                const conf = CHANNEL_CONFIG[c.channel] || CHANNEL_CONFIG.widget;
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full p-4 text-left transition-all flex items-start gap-3 relative ${
                      isSelected
                        ? "bg-[var(--primary-container)]/15 border-l-4 border-l-[var(--primary)]"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[var(--surface-solid)] border border-glass-border flex items-center justify-center text-xs font-bold text-[var(--primary)]">
                        {getInitials(c.customer_name)}
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${conf.color} border border-white flex items-center justify-center text-white`}
                        title={conf.label}
                      >
                        <span className="material-symbols-outlined text-[10px]">
                          {conf.icon}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`truncate text-sm font-semibold ${
                            isSelected
                              ? "text-[var(--text-bright)]"
                              : "text-[var(--text)]"
                          }`}
                        >
                          {c.customer_name || "Klient"}
                        </p>
                        <span className="text-[10px] text-[var(--muted)] font-mono shrink-0">
                          {conf.label}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {c.last_message || "Nowa konwersacja"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Active Chat Stream */}
        <section className="lg:col-span-8 glass-panel rounded-xl flex flex-col overflow-hidden shadow-2xl">
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-glass-border bg-[var(--surface-container-low)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--surface-solid)] border border-glass-border flex items-center justify-center text-sm font-bold text-[var(--primary)]">
                    {getInitials(selected.customer_name)}
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-bright)]">
                      {selected.customer_name || "Klient"}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span className="flex items-center gap-1 text-[var(--accent)] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                        Kanał: {CHANNEL_CONFIG[selected.channel]?.label || selected.channel}
                      </span>
                      {selectedCustomer?.phone && (
                        <span>· {selectedCustomer.phone}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link to="/appointments">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border border-glass-border text-xs font-semibold text-[var(--text)] hover:bg-white/5 transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      Rezerwacje
                    </button>
                  </Link>
                  <Link to="/customers">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border border-glass-border text-xs font-semibold text-[var(--text)] hover:bg-white/5 transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">person</span>
                      Karta klienta
                    </button>
                  </Link>
                </div>
              </div>

              {/* Chat Messages Stream */}
              <div
                ref={messagesRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/10"
              >
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-[var(--muted)] py-12">
                    Brak wiadomości w tym wątku.
                  </p>
                ) : (
                  messages.map((m) => {
                    const isOwner = m.role === "owner";
                    const isBot = m.role === "bot";
                    const isCustomer = m.role === "customer";
                    const timeStr = new Date(m.created_at).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          isOwner
                            ? "items-end"
                            : isBot
                              ? "items-end"
                              : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${
                            isOwner
                              ? "bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white rounded-br-none"
                              : isBot
                                ? "bg-[var(--surface-solid)] border border-glass-border text-[var(--text-bright)] rounded-br-none"
                                : "glass-panel text-[var(--text-bright)] rounded-bl-none"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                            <span className="font-semibold uppercase tracking-wider">
                              {isCustomer ? "Klient" : isOwner ? "Ty (Właściciel)" : "Automovia Bot"}
                            </span>
                            <span className="font-mono">{timeStr}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Composer */}
              <form
                onSubmit={onReply}
                className="p-4 border-t border-glass-border bg-[var(--surface-container-low)] flex gap-3 items-end shrink-0"
              >
                <div className="flex-1 relative">
                  <textarea
                    rows={2}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Wpisz odpowiedź do klienta..."
                    className="w-full bg-[var(--surface-container)] border border-glass-border rounded-xl px-4 py-2.5 text-sm text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] resize-none transition-colors"
                  />
                </div>
                <GlassButton type="submit" variant="primary" className="!py-3 !px-5">
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Wyślij
                </GlassButton>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--muted)]">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-30">
                forum
              </span>
              <p className="font-display text-base font-semibold text-[var(--text)]">
                Wybierz rozmowę z listy
              </p>
              <p className="text-xs text-[var(--muted)] mt-1 max-w-sm">
                Kliknij na wybranego klienta po lewej stronie, aby przeglądać i odpowiadać na wiadomości.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

