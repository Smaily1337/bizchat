import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { inboxApi } from "@/api";
import type { Conversation, InboxMessage } from "@/api/types";
import { GlassButton, GlassCard, PageHeader } from "@/components/ui";
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
  const [params] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reloadList() {
    const list = await inboxApi.conversations();
    setConversations(list);
    const customer = params.get("customer");
    const fromCustomer = customer
      ? list.find((c) => c.customer_id === customer)?.id
      : undefined;
    setSelectedId((prev) => fromCustomer || prev || list[0]?.id || null);
  }

  async function reloadMessages(id: string) {
    const msgs = await inboxApi.messages(id);
    setMessages(msgs);
  }

  useEffect(() => {
    void reloadList()
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

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="chat"
        title="Inbox"
        subtitle="Rozmowy z botem na żywo · odpowiedź ręczna właściciela"
      />

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {loading && (
        <p className="text-sm text-[var(--muted)]">Ładowanie rozmów…</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <GlassCard padding="none" className="max-h-[70vh] overflow-y-auto">
          {conversations.length === 0 && !loading && (
            <p className="p-4 text-sm text-[var(--muted)]">
              Brak rozmów. Napisz coś przez widget WWW.
            </p>
          )}
          <ul>
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={[
                    "w-full border-b border-[var(--border)] px-4 py-3 text-left transition",
                    selectedId === c.id
                      ? "bg-[var(--ink)]/10"
                      : "hover:bg-[var(--surface)]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display text-sm font-semibold">
                      {c.customer_name || "Klient"}
                    </p>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text)]">
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
              <div className="mb-4 border-b border-[var(--border)] pb-3">
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
                      "max-w-[85%] rounded-2xl border px-3 py-2 text-sm",
                      m.role === "customer"
                        ? "ml-0 border-[var(--border)] bg-[var(--surface)]"
                        : m.role === "owner"
                          ? "ml-auto border-[var(--border)] bg-[var(--surface-hover)]"
                          : "ml-auto border-[var(--border)] bg-[var(--surface)]Strong",
                    ].join(" ")}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      {m.role === "customer"
                        ? "Klient"
                        : m.role === "owner"
                          ? "Ty"
                          : "Bot"}
                    </p>
                    <p className="whitespace-pre-wrap text-[var(--text)]">{m.content}</p>
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
