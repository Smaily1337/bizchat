import { type FormEvent, useCallback, useEffect, useState } from "react";
import { customersApi, inboxApi, tagsApi } from "@/api";
import type { Channel, Customer, CustomerTag } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassTextarea } from "@/components/ui/GlassInput";

const TAG_COLORS = [
  "#3D7A6A",
  "#4A6FA5",
  "#A67C52",
  "#8B5E6B",
  "#5C6B4A",
  "#6B5B8C",
];

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    messenger_psid: "",
  });
  const [tagForm, setTagForm] = useState({
    name: "",
    color: TAG_COLORS[0],
  });
  const [messageFor, setMessageFor] = useState<Customer | null>(null);
  const [messageText, setMessageText] = useState("");
  const [channel, setChannel] = useState<Channel>("messenger");
  const [editId, setEditId] = useState<string | null>(null);
  const [editPsid, setEditPsid] = useState("");
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [filterTagId, setFilterTagId] = useState<string>("");

  const reload = useCallback(async () => {
    const [cust, tagList] = await Promise.all([
      customersApi.list(),
      tagsApi.list(),
    ]);
    setCustomers(cust);
    setTags(tagList);
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

  async function onCreateTag(e: FormEvent) {
    e.preventDefault();
    if (!tagForm.name.trim()) return;
    setError(null);
    setMsg(null);
    try {
      await tagsApi.create({
        name: tagForm.name.trim(),
        color: tagForm.color,
      });
      setTagForm({ name: "", color: TAG_COLORS[0] });
      setMsg("Tag utworzony");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tagu");
    }
  }

  async function removeTag(tag: CustomerTag) {
    if (!confirm(`Usunąć tag „${tag.name}”? Zostanie odpięty od klientów.`)) {
      return;
    }
    setError(null);
    try {
      await tagsApi.remove(tag.id);
      if (filterTagId === tag.id) setFilterTagId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function toggleCustomerTag(customer: Customer, tag: CustomerTag) {
    setError(null);
    const current = new Set((customer.tags || []).map((t) => t.id));
    if (current.has(tag.id)) current.delete(tag.id);
    else current.add(tag.id);
    try {
      const next = await customersApi.setTags(customer.id, [...current]);
      setCustomers((list) =>
        list.map((c) => (c.id === customer.id ? { ...c, tags: next } : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tagów");
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

  const visible = filterTagId
    ? customers.filter((c) => (c.tags || []).some((t) => t.id === filterTagId))
    : customers;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Klienci</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Dodawaj klientów, oznaczaj własnymi tagami i pisz na Messenger nawet
          bez wcześniejszej rozmowy w Inbox (wymagany PSID).
        </p>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Tagi</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Twórz własne etykiety (np. VIP, nowy, lojalny) i przypinaj je do
          klientów.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={onCreateTag}
        >
          <label className="min-w-[160px] flex-1 space-y-1 text-sm">
            <span className="text-[var(--muted)]">Nazwa tagu</span>
            <GlassInput
              value={tagForm.name}
              onChange={(e) =>
                setTagForm({ ...tagForm, name: e.target.value })
              }
              placeholder="VIP"
              required
            />
          </label>
          <div className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Kolor</span>
            <div className="flex gap-1.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Kolor ${c}`}
                  onClick={() => setTagForm({ ...tagForm, color: c })}
                  className={[
                    "h-8 w-8 rounded-control border transition",
                    tagForm.color === c
                      ? "border-white scale-110"
                      : "border-transparent opacity-80 hover:opacity-100",
                  ].join(" ")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <GlassButton type="submit">Dodaj tag</GlassButton>
        </form>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-glass-border pt-4">
            {tags.map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-control border border-glass-border px-2.5 py-1 text-sm"
                style={{
                  backgroundColor: `${t.color || "#555"}33`,
                  borderColor: t.color || undefined,
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: t.color || "#888" }}
                />
                {t.name}
                <button
                  type="button"
                  className="ml-1 text-xs text-[var(--muted)] hover:text-white"
                  onClick={() => void removeTag(t)}
                  aria-label={`Usuń tag ${t.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="animate-fade-up">
        <p className="font-display text-lg font-semibold">Import CSV</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Kolumny: name, phone, email, messenger_psid, whatsapp
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-3 block w-full text-sm text-[var(--muted)]"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void customersApi
              .importCsv(file)
              .then(async (r) => {
                setMsg(
                  `Import: +${r.created} nowych, ${r.updated} zaktualizowanych, ${r.skipped} pominiętych`,
                );
                await reload();
              })
              .catch((err: Error) => setError(err.message));
          }}
        />
      </GlassCard>

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

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--muted)]">Filtr tagu:</p>
        <select
          className="rounded-control border border-glass-border bg-glass-fill px-3 py-1.5 text-sm text-white"
          value={filterTagId}
          onChange={(e) => setFilterTagId(e.target.value)}
        >
          <option value="">Wszyscy</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {visible.map((c) => {
          const psid = c.external_ids?.messenger || "";
          const assigned = new Set((c.tags || []).map((t) => t.id));
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
                  {(c.tags || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(c.tags || []).map((t) => (
                        <span
                          key={t.id}
                          className="rounded-control px-2 py-0.5 text-[11px] font-medium text-white"
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
                <div className="flex flex-wrap gap-2">
                  <GlassButton
                    type="button"
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() =>
                      setTagEditId(tagEditId === c.id ? null : c.id)
                    }
                  >
                    Tagi
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setMessageFor(c);
                      setChannel("messenger");
                      setMessageText("");
                    }}
                    disabled={
                      !psid &&
                      !c.external_ids?.instagram &&
                      !c.external_ids?.telegram
                    }
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
              {tagEditId === c.id && (
                <div className="mt-3 border-t border-glass-border pt-3">
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    Kliknij tag, żeby dodać / usunąć
                  </p>
                  {tags.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      Najpierw utwórz tag powyżej.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => {
                        const on = assigned.has(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => void toggleCustomerTag(c, t)}
                            className={[
                              "rounded-control border px-3 py-1 text-sm transition",
                              on
                                ? "border-white/50 text-white"
                                : "border-glass-border text-[var(--muted)] hover:text-white",
                            ].join(" ")}
                            style={
                              on
                                ? {
                                    backgroundColor:
                                      t.color || "rgba(255,255,255,0.15)",
                                  }
                                : undefined
                            }
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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
        {visible.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Brak klientów.</p>
        )}
      </div>
    </div>
  );
}
