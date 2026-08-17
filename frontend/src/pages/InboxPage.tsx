import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { customersApi, inboxApi } from "@/api";
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

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({
    customer_id: "",
    channel: "messenger" as Channel,
    text: "",
  });

  async function reloadList() {
    const list = await inboxApi.conversations();
    setConversations(list);
    setSelectedId((prev) => prev || list[0]?.id || null);
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

  const selected = conversations.find((c) => c.id === selectedId);
  const messengerReady = customers.filter(
    (c) => c.external_ids?.messenger || c.external_ids?.instagram || c.external_ids?.telegram,
  );

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Inbox</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Rozmowy na żywo · odpowiedź właściciela · start wiadomości bez wcześniejszego czatu
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}
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
                className="w-full rounded-control border border-glass-border bg-glass-fill px-3 py-2 text-sm text-white"
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
                className="w-full rounded-control border border-glass-border bg-glass-fill px-3 py-2 text-sm text-white"
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

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <GlassCard padding="none" className="max-h-[70vh] overflow-y-auto">
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
                      ? "bg-white/5"
                      : "hover:bg-glass-fill",
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
        </GlassCard>

        <GlassCard className="flex min-h-[70vh] flex-col">
          {selected ? (
            <>
              <div className="mb-4 border-b border-glass-border pb-3">
                <p className="font-display text-lg font-semibold">
                  {selected.customer_name || "Klient"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {CHANNEL_LABEL[selected.channel]} · stan: {selected.state}
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={[
                      "max-w-[85%] rounded-soft border px-3 py-2 text-sm",
                      m.role === "customer"
                        ? "ml-0 border-glass-border bg-glass-fill"
                        : m.role === "owner"
                          ? "ml-auto border-white/40 bg-white/10"
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
                    <p className="whitespace-pre-wrap text-white">{m.content}</p>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      {new Date(m.created_at).toLocaleString("pl-PL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <form className="mt-4 flex gap-2" onSubmit={onReply}>
                <GlassTextarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Odpowiedz jako właściciel…"
                  className="min-h-[3rem] flex-1"
                />
                <GlassButton type="submit" className="self-end">
                  Wyślij
                </GlassButton>
              </form>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Wybierz rozmowę</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
