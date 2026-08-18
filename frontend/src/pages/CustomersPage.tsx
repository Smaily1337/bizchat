import { type FormEvent, useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { customersApi, inboxApi, tagsApi } from "@/api";
import type { Channel, Customer, CustomerTag } from "@/api/types";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

const TAG_COLORS = [
  "#0c6b5c",
  "#3a6ea5",
  "#a0673a",
  "#8b4f6a",
  "#4f6b3a",
  "#5b4f8c",
];

function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function contactLine(c: Customer) {
  return [c.phone, c.email].filter(Boolean).join(" · ") || "Brak kontaktu";
}

function channelBadges(c: Customer) {
  const ext = c.external_ids || {};
  const out: string[] = [];
  if (ext.messenger) out.push("Messenger");
  if (ext.instagram) out.push("IG");
  if (ext.telegram) out.push("Telegram");
  if (ext.whatsapp) out.push("WhatsApp");
  return out;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      setToolsOpen(false);
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
        setMsg(`Wysłano na ${channel}. Otwórz Wiadomości, by kontynuować.`);
      } else {
        setError(
          res.detail ||
            "Zapisano w Wiadomościach, ale Meta nie dostarczyła (PSID / token).",
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (filterTagId && !(c.tags || []).some((t) => t.id === filterTagId)) {
        return false;
      }
      if (!q) return true;
      const hay = [
        c.name,
        c.phone,
        c.email,
        c.external_ids?.messenger,
        ...(c.tags || []).map((t) => t.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [customers, filterTagId, query]);

  return (
    <div className="space-y-5">
      <header className="page-hero animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-caps">Baza</p>
            <h1 className="font-display text-3xl font-bold text-[var(--text-bright)] sm:text-4xl">
              Klienci
            </h1>
            <p className="mt-1 max-w-lg text-sm text-[var(--muted)]">
              Szukaj, filtruj tagami i pisz na Messenger — bez stosu kart.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GlassButton type="button" onClick={() => setToolsOpen((v) => !v)}>
              {toolsOpen ? "Ukryj narzędzia" : "Dodaj / import"}
            </GlassButton>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <GlassInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po imieniu, telefonie, e-mailu, tagu…"
              aria-label="Szukaj klientów"
            />
          </div>
          <GlassSelect
            className="sm:w-48"
            value={filterTagId}
            onChange={(e) => setFilterTagId(e.target.value)}
            aria-label="Filtr tagu"
          >
            <option value="">Wszystkie tagi</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </GlassSelect>
          <p className="shrink-0 text-sm text-[var(--muted)]">
            {visible.length} / {customers.length}
          </p>
        </div>
      </header>

      {error && (
        <p className="rounded-control border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {msg && (
        <p className="rounded-control border border-[var(--success)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--success)]">
          {msg}
        </p>
      )}

      {toolsOpen && (
        <div className="grid animate-fade-up gap-4 lg:grid-cols-2">
          <GlassCard className="glass-panel-interactive">
            <p className="font-display text-lg font-semibold text-[var(--text-bright)]">
              Nowy klient
            </p>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
              <label className="space-y-1 text-sm sm:col-span-2">
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
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">Messenger PSID</span>
                <GlassInput
                  value={form.messenger_psid}
                  onChange={(e) =>
                    setForm({ ...form, messenger_psid: e.target.value })
                  }
                  placeholder="Opcjonalnie — z Meta / webhooka"
                />
              </label>
              <div className="sm:col-span-2">
                <GlassButton type="submit">Zapisz klienta</GlassButton>
              </div>
            </form>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard className="glass-panel-interactive">
              <p className="font-display text-lg font-semibold text-[var(--text-bright)]">
                Tagi
              </p>
              <form
                className="mt-3 flex flex-wrap items-end gap-3"
                onSubmit={onCreateTag}
              >
                <label className="min-w-[140px] flex-1 space-y-1 text-sm">
                  <span className="text-[var(--muted)]">Nazwa</span>
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
                          "h-8 w-8 rounded-full border-2 transition",
                          tagForm.color === c
                            ? "scale-110 border-[var(--text-bright)]"
                            : "border-transparent opacity-80 hover:opacity-100",
                        ].join(" ")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <GlassButton type="submit">Dodaj</GlassButton>
              </form>
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-glass-border pt-3">
                  {tags.map((t) => (
                    <div
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm"
                      style={{
                        backgroundColor: `${t.color || "#555"}22`,
                        borderColor: `${t.color || "#888"}66`,
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: t.color || "#888" }}
                      />
                      {t.name}
                      <button
                        type="button"
                        className="ml-0.5 text-[var(--muted)] hover:text-[var(--danger)]"
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

            <GlassCard className="glass-panel-interactive">
              <p className="font-display text-lg font-semibold text-[var(--text-bright)]">
                Import CSV
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Kolumny: name, phone, email, messenger_psid, whatsapp
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                className="mt-3 block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-control file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--on-accent)]"
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
          </div>
        </div>
      )}

      {messageFor && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold text-[var(--text-bright)]">
            Wiadomość do {messageFor.name || "klienta"}
          </p>
          <form className="mt-4 space-y-3" onSubmit={sendMessage}>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Kanał</span>
              <GlassSelect
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                <option value="messenger">Messenger</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
              </GlassSelect>
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

      <GlassCard padding="none" className="animate-fade-up overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Klient</th>
                <th>Kontakt</th>
                <th>Tagi</th>
                <th>Kanały</th>
                <th className="!text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const psid = c.external_ids?.messenger || "";
                const assigned = new Set((c.tags || []).map((t) => t.id));
                const channels = channelBadges(c);
                const open = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="avatar-chip">{initials(c.name)}</span>
                          <div>
                            <p className="font-semibold text-[var(--text-bright)]">
                              {c.name || "Bez nazwy"}
                            </p>
                            <p className="font-mono text-[11px] text-[var(--muted)]">
                              PSID: {psid ? `${psid.slice(0, 10)}…` : "brak"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-[var(--muted)]">
                        {contactLine(c)}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || []).length === 0 && (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          )}
                          {(c.tags || []).map((t) => (
                            <span
                              key={t.id}
                              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                backgroundColor: t.color || "var(--accent)",
                                color: "#fff",
                              }}
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {channels.length === 0 && (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          )}
                          {channels.map((ch) => (
                            <span
                              key={ch}
                              className="rounded-control bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <GlassButton
                            type="button"
                            variant="ghost"
                            className="!px-2.5 !py-1.5 text-xs"
                            onClick={() =>
                              setExpandedId(open ? null : c.id)
                            }
                          >
                            {open ? "Zamknij" : "Więcej"}
                          </GlassButton>
                          <GlassButton
                            type="button"
                            variant="ghost"
                            className="!px-2.5 !py-1.5 text-xs"
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
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="!bg-[var(--surface-solid)]">
                        <td colSpan={5} className="!py-4">
                          <CustomerExtras
                            customer={c}
                            tags={tags}
                            assigned={assigned}
                            tagEditId={tagEditId}
                            setTagEditId={setTagEditId}
                            editId={editId}
                            setEditId={setEditId}
                            editPsid={editPsid}
                            setEditPsid={setEditPsid}
                            onToggleTag={toggleCustomerTag}
                            onSavePsid={savePsid}
                            onRemove={removeCustomer}
                            onMessage={() => {
                              setMessageFor(c);
                              setChannel("messenger");
                              setMessageText("");
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              Brak klientów pasujących do filtra.
            </p>
          )}
        </div>

        {/* Mobile cards — compact */}
        <div className="divide-y divide-[var(--glass-border)] md:hidden">
          {visible.map((c) => {
            const psid = c.external_ids?.messenger || "";
            const assigned = new Set((c.tags || []).map((t) => t.id));
            const open = expandedId === c.id;
            return (
              <div key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="avatar-chip">{initials(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--text-bright)]">
                      {c.name || "Bez nazwy"}
                    </p>
                    <p className="text-sm text-[var(--muted)]">{contactLine(c)}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => (
                        <span
                          key={t.id}
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: t.color || "var(--accent)",
                            color: "#fff",
                          }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GlassButton
                    type="button"
                    variant="ghost"
                    className="!px-2.5 !py-1.5 text-xs"
                    onClick={() => setExpandedId(open ? null : c.id)}
                  >
                    {open ? "Zamknij" : "Więcej"}
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    className="!px-2.5 !py-1.5 text-xs"
                    disabled={
                      !psid &&
                      !c.external_ids?.instagram &&
                      !c.external_ids?.telegram
                    }
                    onClick={() => {
                      setMessageFor(c);
                      setChannel("messenger");
                      setMessageText("");
                    }}
                  >
                    Napisz
                  </GlassButton>
                </div>
                {open && (
                  <div className="mt-3 border-t border-glass-border pt-3">
                    <CustomerExtras
                      customer={c}
                      tags={tags}
                      assigned={assigned}
                      tagEditId={tagEditId}
                      setTagEditId={setTagEditId}
                      editId={editId}
                      setEditId={setEditId}
                      editPsid={editPsid}
                      setEditPsid={setEditPsid}
                      onToggleTag={toggleCustomerTag}
                      onSavePsid={savePsid}
                      onRemove={removeCustomer}
                      onMessage={() => {
                        setMessageFor(c);
                        setChannel("messenger");
                        setMessageText("");
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              Brak klientów pasujących do filtra.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function CustomerExtras({
  customer,
  tags,
  assigned,
  tagEditId,
  setTagEditId,
  editId,
  setEditId,
  editPsid,
  setEditPsid,
  onToggleTag,
  onSavePsid,
  onRemove,
  onMessage,
}: {
  customer: Customer;
  tags: CustomerTag[];
  assigned: Set<string>;
  tagEditId: string | null;
  setTagEditId: (id: string | null) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  editPsid: string;
  setEditPsid: (v: string) => void;
  onToggleTag: (c: Customer, t: CustomerTag) => void;
  onSavePsid: (c: Customer) => void;
  onRemove: (c: Customer) => void;
  onMessage: () => void;
}) {
  const psid = customer.external_ids?.messenger || "";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <GlassButton
          type="button"
          variant="ghost"
          className="!px-3 !py-1.5 text-xs"
          onClick={() =>
            setTagEditId(tagEditId === customer.id ? null : customer.id)
          }
        >
          Edytuj tagi
        </GlassButton>
        <GlassButton
          type="button"
          variant="ghost"
          className="!px-3 !py-1.5 text-xs"
          onClick={() => {
            setEditId(customer.id);
            setEditPsid(psid);
          }}
        >
          Edytuj PSID
        </GlassButton>
        <GlassButton
          type="button"
          variant="ghost"
          className="!px-3 !py-1.5 text-xs"
          onClick={onMessage}
        >
          Napisz
        </GlassButton>
        <GlassButton
          type="button"
          variant="ghost"
          className="!px-3 !py-1.5 text-xs"
          onClick={() => void onRemove(customer)}
        >
          Usuń
        </GlassButton>
      </div>

      {tagEditId === customer.id && (
        <div>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Kliknij tag, żeby dodać / usunąć
          </p>
          {tags.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Najpierw utwórz tag w „Dodaj / import”.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const on = assigned.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void onToggleTag(customer, t)}
                    className={[
                      "rounded-full border px-3 py-1 text-sm transition",
                      on
                        ? "border-transparent"
                        : "border-glass-border text-[var(--muted)] hover:text-[var(--text-bright)]",
                    ].join(" ")}
                    style={
                      on
                        ? {
                            backgroundColor: t.color || "var(--accent)",
                            color: "#fff",
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

      {editId === customer.id && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 space-y-1 text-sm">
            <span className="text-[var(--muted)]">Messenger PSID</span>
            <GlassInput
              value={editPsid}
              onChange={(e) => setEditPsid(e.target.value)}
            />
          </label>
          <GlassButton type="button" onClick={() => void onSavePsid(customer)}>
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
    </div>
  );
}
