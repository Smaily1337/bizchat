import { type FormEvent, useCallback, useEffect, useState } from "react";
import { customersApi, inboxApi } from "@/api";
import type { Channel, Customer } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassTextarea } from "@/components/ui/GlassInput";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    messenger_psid: "",
  });
  const [messageFor, setMessageFor] = useState<Customer | null>(null);
  const [messageText, setMessageText] = useState("");
  const [channel, setChannel] = useState<Channel>("messenger");
  const [editId, setEditId] = useState<string | null>(null);
  const [editPsid, setEditPsid] = useState("");

  const reload = useCallback(async () => {
    setCustomers(await customersApi.list());
  }, []);

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, [reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await customersApi.create({
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        messenger_psid: form.messenger_psid.trim() || undefined,
      });
      setForm({ name: "", phone: "", email: "", messenger_psid: "" });
      setMsg("Klient dodany");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function savePsid(customer: Customer) {
    setError(null);
    try {
      await customersApi.update(customer.id, {
        messenger_psid: editPsid.trim(),
      });
      setEditId(null);
      setMsg("Zapisano Messenger PSID");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!messageFor || !messageText.trim()) return;
    setError(null);
    setMsg(null);
    try {
      const res = await inboxApi.start({
        customer_id: messageFor.id,
        text: messageText.trim(),
        channel,
      });
      setMessageText("");
      setMessageFor(null);
      if (res.delivered) {
        setMsg(`Wysłano na ${channel}. Otwórz Inbox, by kontynuować rozmowę.`);
      } else {
        setError(
          res.detail ||
            "Zapisano w Inbox, ale Meta nie dostarczyła wiadomości (sprawdź PSID / token).",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd wysyłki");
    }
  }

  async function removeCustomer(customer: Customer) {
    if (!confirm(`Usunąć klienta ${customer.name || customer.id}?`)) return;
    setError(null);
    try {
      await customersApi.remove(customer.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Klienci</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Dodawaj klientów ręcznie i pisz na Messenger nawet bez wcześniejszej
          rozmowy w Inbox (wymagany PSID).
        </p>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Nowy klient</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Imię / nazwa</span>
            <GlassInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Anna Kowalska"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Telefon</span>
            <GlassInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">E-mail</span>
            <GlassInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Messenger PSID</span>
            <GlassInput
              value={form.messenger_psid}
              onChange={(e) =>
                setForm({ ...form, messenger_psid: e.target.value })
              }
              placeholder="Page-Scoped ID z Meta"
            />
          </label>
          <p className="sm:col-span-2 text-xs text-[var(--muted)]">
            PSID pojawia się, gdy klient choć raz napisze do fanpage (webhook).
            Możesz też wkleić go ręcznie z narzędzi Meta / logów API.
          </p>
          <div className="sm:col-span-2">
            <GlassButton type="submit">Dodaj klienta</GlassButton>
          </div>
        </form>
      </GlassCard>

      {messageFor && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">
            Wiadomość do {messageFor.name || "klienta"}
          </p>
          <form className="mt-4 space-y-3" onSubmit={sendMessage}>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Kanał</span>
              <select
                className="w-full rounded-control border border-glass-border bg-glass-fill px-3 py-2 text-sm text-white"
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                <option value="messenger">Messenger</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
              </select>
            </label>
            <GlassTextarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Cześć! Przypominamy o wizycie…"
              required
            />
            <div className="flex flex-wrap gap-2">
              <GlassButton type="submit">Wyślij</GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setMessageFor(null)}
              >
                Anuluj
              </GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      <div className="space-y-3">
        {customers.map((c) => {
          const psid = c.external_ids?.messenger || "";
          return (
            <GlassCard key={c.id} className="animate-fade-up">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {c.name || "Bez nazwy"}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                    Messenger PSID: {psid || "brak"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GlassButton
                    type="button"
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setMessageFor(c);
                      setChannel("messenger");
                      setMessageText("");
                    }}
                    disabled={!psid && !c.external_ids?.instagram && !c.external_ids?.telegram}
                  >
                    Napisz
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setEditId(c.id);
                      setEditPsid(psid);
                    }}
                  >
                    PSID
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => void removeCustomer(c)}
                  >
                    Usuń
                  </GlassButton>
                </div>
              </div>
              {editId === c.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-glass-border pt-3">
                  <label className="min-w-[220px] flex-1 space-y-1 text-sm">
                    <span className="text-[var(--muted)]">Messenger PSID</span>
                    <GlassInput
                      value={editPsid}
                      onChange={(e) => setEditPsid(e.target.value)}
                    />
                  </label>
                  <GlassButton type="button" onClick={() => void savePsid(c)}>
                    Zapisz
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    onClick={() => setEditId(null)}
                  >
                    Anuluj
                  </GlassButton>
                </div>
              )}
            </GlassCard>
          );
        })}
        {customers.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Brak klientów.</p>
        )}
      </div>
    </div>
  );
}
